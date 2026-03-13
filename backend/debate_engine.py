import asyncio
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agent import CouncilAgent
from events import publish_event
from models import AgentPosition, Argument, Debate, DebateAgent, Round

logger = logging.getLogger("uvicorn.error")

# Only allow 1 concurrent deliberation to avoid overloading Claude API
_semaphore = asyncio.Semaphore(1)

# Track running deliberation tasks so they can be cancelled
_running_tasks: dict[uuid.UUID, asyncio.Task] = {}


def get_running_task(debate_id: uuid.UUID) -> asyncio.Task | None:
    return _running_tasks.get(debate_id)


def format_conversation_history(arguments: list[Argument], agents_map: dict) -> list[dict]:
    """Group arguments by agent turn for injection into agent prompts.

    Groups consecutive arguments from the same agent into one entry.
    Each entry: {agent_prefix, agent_title, seat_number, arguments: [...], summary}
    """
    entries: list[dict] = []
    current_agent_id = None
    current_entry: dict | None = None

    for arg in arguments:
        if arg.agent_id != current_agent_id:
            if current_entry:
                entries.append(current_entry)
            agent = agents_map.get(arg.agent_id)
            if not agent:
                current_agent_id = None
                current_entry = None
                continue
            current_agent_id = arg.agent_id
            current_entry = {
                "agent_prefix": agent.argument_prefix,
                "agent_title": agent.title,
                "seat_number": agent.seat_number,
                "arguments": [],
                "summary": "",
            }

        current_entry["arguments"].append({
            "id": arg.argument_index,
            "type": arg.arg_type,
            "stance": arg.stance or "neutral",
            "confidence": float(arg.confidence) if arg.confidence else 5.0,
            "claim": arg.claim or "",
        })
        if arg.summary:
            current_entry["summary"] = arg.summary

    if current_entry:
        entries.append(current_entry)

    return entries


async def run_deliberation(debate_id: uuid.UUID, db_session_factory) -> None:
    """Orchestrate a full council deliberation from start to finish."""
    # Register current task so it can be cancelled from the stop endpoint
    _running_tasks[debate_id] = asyncio.current_task()
    try:
        async with _semaphore:
            async with db_session_factory() as db:
                try:
                    await _run_deliberation_inner(debate_id, db)
                except asyncio.CancelledError:
                    logger.info("Deliberation %s was stopped by user", debate_id)
                    try:
                        debate = await db.get(Debate, debate_id)
                        if debate and debate.status not in ("completed", "error", "stopped", "deleted"):
                            debate.status = "stopped"
                            await db.commit()
                        await publish_event(str(debate_id), "debate_stopped", {"message": "Deliberation stopped by user"})
                    except Exception:
                        logger.exception("Failed to set stopped status for deliberation %s", debate_id)
                except Exception as e:
                    logger.exception("Deliberation %s failed: %s", debate_id, e)
                    try:
                        debate = await db.get(Debate, debate_id)
                        if debate:
                            debate.status = "error"
                            await db.commit()
                        await publish_event(str(debate_id), "error", {"message": str(e)})
                    except Exception:
                        logger.exception("Failed to set error status for deliberation %s", debate_id)
    finally:
        _running_tasks.pop(debate_id, None)


async def _run_deliberation_inner(debate_id: uuid.UUID, db: AsyncSession) -> None:
    # Load debate
    debate = await db.get(Debate, debate_id)
    if not debate:
        raise ValueError(f"Debate {debate_id} not found")

    # Load agents ordered by seat_number
    agents_result = await db.execute(
        select(DebateAgent)
        .where(DebateAgent.debate_id == debate_id)
        .order_by(DebateAgent.seat_number)
    )
    agents = agents_result.scalars().all()
    agents_map = {a.id: a for a in agents}

    # Build council_members list for agent prompts
    council_members = [
        {
            "seat_number": a.seat_number,
            "title": a.title,
            "expertise": a.expertise,
            "priorities": a.priorities,
            "style": a.style,
            "background": a.background or "",
        }
        for a in agents
    ]

    # Create Round rows from format_config
    format_config = debate.format_config or {}
    rounds_config = format_config.get("rounds", [{"type": "opening", "word_limit": 300}])

    round_rows = []
    for i, rc in enumerate(rounds_config, start=1):
        r = Round(
            debate_id=debate_id,
            round_number=i,
            round_type=rc["type"],
            status="pending",
        )
        db.add(r)
        round_rows.append(r)
    await db.flush()

    # Set debate to running
    debate.status = "running"
    await db.commit()

    await publish_event(str(debate_id), "debate_start", {
        "topic": debate.topic,
        "council_size": debate.council_size,
        "total_rounds": len(round_rows),
    })

    # Track all arguments across the deliberation
    all_arguments: list[Argument] = []

    # === DISCUSSION ROUNDS ===
    for round_row in round_rows:
        round_row.status = "active"
        round_row.started_at = datetime.now(timezone.utc)
        await db.commit()

        await publish_event(str(debate_id), "round_start", {
            "round_number": round_row.round_number,
            "round_type": round_row.round_type,
        })

        # Each agent speaks in seat order
        for agent_row in agents:
            identity = {
                "title": agent_row.title,
                "expertise": agent_row.expertise,
                "priorities": agent_row.priorities,
                "style": agent_row.style,
                "background": agent_row.background or "",
            }

            agent = CouncilAgent(
                identity=identity,
                topic=debate.topic,
                context=debate.context,
                argument_prefix=agent_row.argument_prefix,
                seat_number=agent_row.seat_number,
                council_members=council_members,
                enable_search=debate.enable_search,
            )

            # Full conversation history: all prior rounds + earlier agents this round
            conversation_history = format_conversation_history(all_arguments, agents_map)

            response = await agent.generate_arguments(
                round_type=round_row.round_type,
                round_number=round_row.round_number,
                conversation_history=conversation_history,
            )

            # Save arguments to DB
            for arg_data in response.get("arguments", []):
                arg = Argument(
                    round_id=round_row.id,
                    debate_id=debate.id,
                    agent_id=agent_row.id,
                    argument_index=arg_data.get("id", f"{agent_row.argument_prefix}?"),
                    arg_type=arg_data.get("type", "claim"),
                    stance=arg_data.get("stance", "neutral"),
                    confidence=_to_decimal(arg_data.get("confidence", 5)),
                    targets=arg_data.get("targets"),
                    claim=arg_data.get("claim"),
                    grounds=arg_data.get("grounds"),
                    warrant=arg_data.get("warrant"),
                    backing=arg_data.get("backing"),
                    qualifier=arg_data.get("qualifier"),
                    summary=response.get("summary"),
                    citations=arg_data.get("citations", []),
                    raw_response=response,
                )
                db.add(arg)
                all_arguments.append(arg)

            await db.commit()

            # Publish SSE for each argument individually
            for arg_data in response.get("arguments", []):
                await publish_event(str(debate.id), "argument", {
                    "seat_number": agent_row.seat_number,
                    "agent_prefix": agent_row.argument_prefix,
                    "agent_title": agent_row.title,
                    "argument_index": arg_data.get("id", "?"),
                    "arg_type": arg_data.get("type", "claim"),
                    "stance": arg_data.get("stance", "neutral"),
                    "confidence": arg_data.get("confidence", 5),
                    "targets": arg_data.get("targets", []),
                    "claim": arg_data.get("claim", ""),
                    "summary": response.get("summary", ""),
                    "round_number": round_row.round_number,
                })

        round_row.status = "completed"
        round_row.completed_at = datetime.now(timezone.utc)
        await db.commit()

        await publish_event(str(debate_id), "round_end", {
            "round_number": round_row.round_number,
        })

    # === REFLECTING PHASE ===
    debate.status = "reflecting"
    await db.commit()
    await publish_event(str(debate_id), "reflecting_start", {})

    full_history = format_conversation_history(all_arguments, agents_map)

    for agent_row in agents:
        identity = {
            "title": agent_row.title,
            "expertise": agent_row.expertise,
            "priorities": agent_row.priorities,
            "style": agent_row.style,
            "background": agent_row.background or "",
        }

        agent = CouncilAgent(
            identity=identity,
            topic=debate.topic,
            context=debate.context,
            argument_prefix=agent_row.argument_prefix,
            seat_number=agent_row.seat_number,
            council_members=council_members,
        )

        position_data = await agent.generate_final_position(full_history)

        position = AgentPosition(
            debate_id=debate.id,
            agent_id=agent_row.id,
            overall_stance=position_data.get("overall_stance", "uncertain"),
            confidence=_to_decimal(position_data.get("confidence", 5)),
            position_summary=position_data.get("position_summary", ""),
            key_concerns=position_data.get("key_concerns"),
            key_supports=position_data.get("key_supports"),
            would_change_mind=position_data.get("would_change_mind"),
        )
        db.add(position)
        await db.commit()

        await publish_event(str(debate_id), "position", {
            "agent_prefix": agent_row.argument_prefix,
            "agent_title": agent_row.title,
            "overall_stance": position_data.get("overall_stance", "uncertain"),
            "confidence": position_data.get("confidence", 5),
            "position_summary": position_data.get("position_summary", ""),
        })

    # === VERIFICATION PHASE (optional) ===
    verification_report = None
    if debate.enable_verification:
        debate.status = "verifying"
        await db.commit()

        from verifier import verify_deliberation
        verification_report = await verify_deliberation(debate_id, db)

    # === SYNTHESIZING PHASE ===
    debate.status = "synthesizing"
    await db.commit()
    await publish_event(str(debate_id), "synthesis_start", {})

    from judge import synthesize_deliberation
    await synthesize_deliberation(debate_id, db, verification_report=verification_report)

    logger.info("Deliberation %s completed successfully", debate_id)


def _to_decimal(val) -> Decimal | None:
    if val is None:
        return None
    try:
        return Decimal(str(val))
    except Exception:
        return None
