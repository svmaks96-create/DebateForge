import asyncio
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from agent import DebateAgent
from events import publish_event
from judge import synthesize_debate
from models import Argument, Debate, DebateAgent as DebateAgentModel, Round

logger = logging.getLogger("uvicorn.error")

# Only allow 1 concurrent debate to avoid overloading Claude API
_semaphore = asyncio.Semaphore(1)


def format_debate_history(arguments: list[Argument]) -> list[dict]:
    """Format all arguments so far into a readable list for agent prompts."""
    history: list[dict] = []
    # Group by agent
    agent_groups: dict[uuid.UUID, list[Argument]] = {}
    for arg in arguments:
        agent_groups.setdefault(arg.agent_id, []).append(arg)

    for agent_id, args in agent_groups.items():
        first = args[0]
        entry = {
            "side": first.agent_side,
            "title": "",  # filled below
            "arguments": [],
            "summary": "",
        }
        for arg in args:
            entry["arguments"].append({
                "id": arg.argument_index,
                "type": arg.arg_type,
                "claim": arg.claim or "",
                "summary": arg.summary or "",
            })
            if arg.summary:
                entry["summary"] = arg.summary
        history.append(entry)

    return history


async def run_debate(debate_id: uuid.UUID, db_session_factory) -> None:
    """Orchestrate a full debate from start to finish."""
    async with _semaphore:
        async with db_session_factory() as db:
            try:
                await _run_debate_inner(debate_id, db)
            except Exception as e:
                logger.exception("Debate %s failed: %s", debate_id, e)
                try:
                    debate = await db.get(Debate, debate_id)
                    if debate:
                        debate.status = "error"
                        await db.commit()
                    await publish_event(str(debate_id), "error", {"message": str(e)})
                except Exception:
                    logger.exception("Failed to set error status for debate %s", debate_id)


async def _run_debate_inner(debate_id: uuid.UUID, db: AsyncSession) -> None:
    # Load debate
    debate = await db.get(Debate, debate_id)
    if not debate:
        raise ValueError(f"Debate {debate_id} not found")

    # Load agents grouped by side
    agents_result = await db.execute(
        select(DebateAgentModel)
        .where(DebateAgentModel.debate_id == debate_id)
        .order_by(DebateAgentModel.position)
    )
    all_agents = agents_result.scalars().all()
    pro_agents = [a for a in all_agents if a.side == "pro"]
    con_agents = [a for a in all_agents if a.side == "con"]

    # Build identity dicts for agents
    agent_identities = {}
    for a in all_agents:
        agent_identities[a.id] = {
            "title": a.title,
            "expertise": a.expertise,
            "priorities": a.priorities,
            "style": a.style,
            "background": a.background or "",
        }

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
        "debate_id": str(debate_id),
        "topic": debate.topic,
        "total_rounds": len(round_rows),
    })

    # Collect all arguments across the debate for history tracking
    all_arguments: list[Argument] = []

    for round_row in round_rows:
        round_row.status = "active"
        round_row.started_at = datetime.now(timezone.utc)
        await db.commit()

        await publish_event(str(debate_id), "round_start", {
            "round_number": round_row.round_number,
            "round_type": round_row.round_type,
        })

        # Determine speaking order
        rt = round_row.round_type
        if rt in ("rebuttal", "cross_exam"):
            first_panel, second_panel = con_agents, pro_agents
        else:
            first_panel, second_panel = pro_agents, con_agents

        # First-speaking side
        await _run_panel(
            debate=debate,
            db=db,
            round_row=round_row,
            panel=first_panel,
            all_agents=all_agents,
            agent_identities=agent_identities,
            all_arguments=all_arguments,
        )

        # Second-speaking side
        await _run_panel(
            debate=debate,
            db=db,
            round_row=round_row,
            panel=second_panel,
            all_agents=all_agents,
            agent_identities=agent_identities,
            all_arguments=all_arguments,
        )

        round_row.status = "completed"
        round_row.completed_at = datetime.now(timezone.utc)
        await db.commit()

        await publish_event(str(debate_id), "round_end", {
            "round_number": round_row.round_number,
        })

    # Synthesis phase
    debate.status = "judging"
    await db.commit()
    await publish_event(str(debate_id), "synthesis_start", {})

    await synthesize_debate(debate_id, db)

    logger.info("Exploration %s completed successfully", debate_id)


async def _run_panel(
    debate: Debate,
    db: AsyncSession,
    round_row: Round,
    panel: list,
    all_agents: list,
    agent_identities: dict,
    all_arguments: list[Argument],
) -> None:
    """Run all agents in a panel sequentially for one round."""
    teammate_args_this_round: list[dict] = []

    for agent_row in panel:
        identity = agent_identities[agent_row.id]

        # Build teammate info (other agents on same side)
        teammates = [
            agent_identities[a.id]
            for a in all_agents
            if a.side == agent_row.side and a.id != agent_row.id
        ]

        agent = DebateAgent(
            side=agent_row.side,
            identity=identity,
            topic=debate.topic,
            context=debate.context,
            argument_prefix=agent_row.argument_prefix,
            panel_teammates=teammates,
        )

        # Build debate history from all prior arguments
        debate_history = _build_history_for_agent(all_arguments, agent_identities)

        response = await agent.generate_arguments(
            round_type=round_row.round_type,
            round_number=round_row.round_number,
            debate_history=debate_history,
            teammate_args_this_round=teammate_args_this_round,
        )

        # Save arguments to DB
        for arg_data in response.get("arguments", []):
            arg = Argument(
                round_id=round_row.id,
                debate_id=debate.id,
                agent_id=agent_row.id,
                agent_side=agent_row.side,
                argument_index=arg_data.get("id", f"{agent_row.argument_prefix}?"),
                arg_type=arg_data.get("type", "claim"),
                targets=arg_data.get("targets"),
                claim=arg_data.get("claim"),
                grounds=arg_data.get("grounds"),
                warrant=arg_data.get("warrant"),
                backing=arg_data.get("backing"),
                qualifier=arg_data.get("qualifier"),
                summary=response.get("summary"),
                raw_response=response,
            )
            db.add(arg)
            all_arguments.append(arg)

        await db.commit()

        # Publish SSE for each argument
        await publish_event(str(debate.id), "argument", {
            "side": agent_row.side,
            "agent_prefix": agent_row.argument_prefix,
            "agent_title": agent_row.title,
            "round_number": round_row.round_number,
            "arguments": response.get("arguments", []),
            "summary": response.get("summary", ""),
        })

        # Track teammate args for this round
        teammate_args_this_round.append({
            "title": identity["title"],
            "arguments": response.get("arguments", []),
        })


def _build_history_for_agent(
    all_arguments: list[Argument],
    agent_identities: dict,
) -> list[dict]:
    """Build debate history grouped by agent for prompt injection."""
    agent_groups: dict[uuid.UUID, list[Argument]] = {}
    for arg in all_arguments:
        agent_groups.setdefault(arg.agent_id, []).append(arg)

    history = []
    for agent_id, args in agent_groups.items():
        first = args[0]
        identity = agent_identities.get(agent_id, {})
        entry = {
            "side": first.agent_side,
            "title": identity.get("title", "Agent"),
            "arguments": [],
            "summary": "",
        }
        for arg in args:
            entry["arguments"].append({
                "id": arg.argument_index,
                "type": arg.arg_type,
                "claim": arg.claim or "",
                "summary": arg.summary or "",
            })
            if arg.summary:
                entry["summary"] = arg.summary
        history.append(entry)

    return history
