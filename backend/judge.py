import json
import logging
import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import anthropic

from config import settings
from events import publish_event
from models import Argument, ArgumentAnalysis, Debate, DebateAgent as DebateAgentModel

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("uvicorn.error")

MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 4096

FALLBACK_SYNTHESIS = {
    "synthesis": {
        "bottom_line": "Synthesis could not be completed. Review the arguments manually.",
        "confidence_level": "uncertain",
        "arguments_for": [],
        "arguments_against": [],
        "areas_of_agreement": [],
        "unresolved_tensions": [],
        "key_insights": [],
        "evidence_gaps": [],
        "nuanced_conclusion": "The synthesizer could not produce a valid analysis. Please review the raw transcript.",
    }
}


def _build_synthesizer_system_prompt(
    topic: str,
    context: str | None,
    agents: list[DebateAgentModel],
) -> str:
    pro_agents = [a for a in agents if a.side == "pro"]
    con_agents = [a for a in agents if a.side == "con"]

    def agent_block(a: DebateAgentModel) -> str:
        return (
            f"  - Prefix: {a.argument_prefix}, Title: {a.title}\n"
            f"    Expertise: {a.expertise}\n"
            f"    Priorities: {a.priorities}"
        )

    pro_list = "\n".join(agent_block(a) for a in pro_agents)
    con_list = "\n".join(agent_block(a) for a in con_agents)

    prompt = f"""\
You are a synthesis analyst. You have just observed a dialectical exploration where multiple \
analysts examined a proposition from different angles. Your job is NOT to pick a winner — \
it is to synthesize the collective insight into actionable understanding.

Proposition: {topic}
{"Context: " + context if context else ""}

FOR analysts:
{pro_list}

AGAINST analysts:
{con_list}

SYNTHESIS PRINCIPLES:
1. Do NOT pick a winner or declare one side superior.
2. Rank arguments by genuine evidential strength, not rhetorical skill.
3. Highlight where analysts AGREED — these convergence points are likely the most reliable conclusions.
4. Be honest about what is genuinely uncertain or unresolvable with available evidence.
5. Note the self-assessed confidence levels from the analysts themselves.
6. Produce actionable insight, not just academic analysis.
7. When analysts conceded points, treat those concessions as high-signal data.

You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.
Output format:
{{
  "synthesis": {{
    "bottom_line": "A 2-3 sentence executive summary of what the exploration revealed. Not who won, but what the collective analysis suggests.",
    "confidence_level": "high|moderate|low|uncertain",
    "arguments_for": [
      {{
        "argument": "The core claim",
        "strength": "strong|moderate|weak",
        "supporting_evidence": "Key evidence cited by analysts",
        "agent_confidence": 8,
        "caveats": "Important limitations or conditions"
      }}
    ],
    "arguments_against": [
      {{
        "argument": "The core counter-claim",
        "strength": "strong|moderate|weak",
        "supporting_evidence": "Key evidence cited",
        "agent_confidence": 7,
        "caveats": "Limitations"
      }}
    ],
    "areas_of_agreement": [
      "Points where both sides converged or one side conceded"
    ],
    "unresolved_tensions": [
      {{
        "tension": "Description of what remains genuinely debatable",
        "why_unresolved": "Why the analysts couldn't resolve this",
        "what_would_resolve_it": "What evidence or data would settle this"
      }}
    ],
    "key_insights": [
      "Non-obvious insights that emerged from the exploration"
    ],
    "evidence_gaps": [
      "Important questions that couldn't be answered without more data"
    ],
    "nuanced_conclusion": "A 2-3 paragraph balanced conclusion that a decision-maker could actually use. Not 'X wins' but 'Here is what the evidence suggests, here is where it is uncertain, and here is what to consider.'"
  }}
}}"""

    return prompt


def _build_synthesizer_user_message(
    arguments: list[Argument],
    agents: list[DebateAgentModel],
    rounds_info: list[dict],
) -> str:
    agent_map = {a.id: a for a in agents}

    msg = "=== FULL EXPLORATION TRANSCRIPT ===\n"

    # Group arguments by round
    args_by_round: dict[int, list[Argument]] = {}
    for arg in arguments:
        rn = None
        for ri in rounds_info:
            if ri["id"] == arg.round_id:
                rn = ri["round_number"]
                break
        if rn is not None:
            args_by_round.setdefault(rn, []).append(arg)

    for round_number in sorted(args_by_round.keys()):
        ri = next(r for r in rounds_info if r["round_number"] == round_number)
        msg += f"\n--- Round {round_number} ({ri['round_type']}) ---\n"

        round_args = sorted(args_by_round[round_number], key=lambda a: a.created_at)
        for arg in round_args:
            agent = agent_map.get(arg.agent_id)
            agent_title = agent.title if agent else "Unknown"
            side = arg.agent_side.upper()

            msg += f"\n[{side} — {agent_title} ({arg.argument_index})]"
            msg += f"\n  Type: {arg.arg_type}"
            if arg.targets:
                msg += f"\n  Targets: {json.dumps(arg.targets)}"
            msg += f"\n  Claim: {arg.claim or '(none)'}"
            msg += f"\n  Grounds: {arg.grounds or '(none)'}"
            msg += f"\n  Warrant: {arg.warrant or '(none)'}"
            msg += f"\n  Backing: {arg.backing or '(none)'}"
            msg += f"\n  Qualifier: {arg.qualifier or '(none)'}"
            # Include agent self-assessed confidence if available
            if arg.raw_response:
                for raw_arg in arg.raw_response.get("arguments", []):
                    if raw_arg.get("id") == arg.argument_index and "confidence" in raw_arg:
                        msg += f"\n  Agent Confidence: {raw_arg['confidence']}/10"
                        break
            if arg.summary:
                msg += f"\n  Summary: {arg.summary}"
            msg += "\n"

    msg += "\n=== END TRANSCRIPT ===\n"
    msg += "\nSynthesize this exploration now. Respond with JSON only."
    return msg


def _parse_synthesis_response(raw_text: str) -> dict | None:
    """Three-tier parse: direct JSON -> code block -> brace search."""
    # Try 1: direct parse
    try:
        data = json.loads(raw_text)
        if "synthesis" in data:
            return data
    except json.JSONDecodeError:
        pass

    # Try 2: code block extraction
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(1))
            if "synthesis" in data:
                return data
        except json.JSONDecodeError:
            pass

    # Try 3: find any JSON object in the text
    brace_start = raw_text.find("{")
    if brace_start >= 0:
        try:
            data = json.loads(raw_text[brace_start:])
            if "synthesis" in data:
                return data
        except json.JSONDecodeError:
            pass

    return None


async def synthesize_debate(
    debate_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    """Synthesize a completed dialectical exploration and save the synthesis."""
    # Load debate
    debate = await db.get(Debate, debate_id)
    if not debate:
        raise ValueError(f"Debate {debate_id} not found")

    # Load agents
    agents_result = await db.execute(
        select(DebateAgentModel)
        .where(DebateAgentModel.debate_id == debate_id)
        .order_by(DebateAgentModel.position)
    )
    agents = agents_result.scalars().all()

    # Load all arguments with round info
    from models import Round
    args_result = await db.execute(
        select(Argument)
        .where(Argument.debate_id == debate_id)
        .order_by(Argument.created_at)
    )
    arguments = args_result.scalars().all()

    rounds_result = await db.execute(
        select(Round)
        .where(Round.debate_id == debate_id)
        .order_by(Round.round_number)
    )
    rounds = rounds_result.scalars().all()
    rounds_info = [
        {"id": r.id, "round_number": r.round_number, "round_type": r.round_type}
        for r in rounds
    ]

    if not arguments:
        logger.warning("No arguments found for debate %s, using fallback synthesis", debate_id)
        debate.verdict = FALLBACK_SYNTHESIS
        debate.status = "completed"
        debate.completed_at = datetime.now(timezone.utc)
        await db.commit()
        await publish_event(str(debate_id), "debate_complete", {
            "debate_id": str(debate_id),
            "synthesis_preview": FALLBACK_SYNTHESIS["synthesis"]["bottom_line"],
            "confidence_level": FALLBACK_SYNTHESIS["synthesis"]["confidence_level"],
        })
        return

    # Build prompts
    system_prompt = _build_synthesizer_system_prompt(debate.topic, debate.context, agents)
    user_message = _build_synthesizer_user_message(arguments, agents, rounds_info)

    # Call Claude
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    synthesis_data = None

    for attempt in range(2):
        try:
            response = await client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )
            raw_text = response.content[0].text
            synthesis_data = _parse_synthesis_response(raw_text)
            if synthesis_data:
                break
            logger.warning("Synthesis response parse failed on attempt %d", attempt + 1)
        except anthropic.APIError as e:
            if attempt == 0:
                logger.warning("Synthesizer Claude API error on attempt 1, retrying: %s", e)
                continue
            logger.error("Synthesizer Claude API error on attempt 2: %s", e)

    if not synthesis_data:
        logger.error("Synthesizer could not produce valid output for debate %s, using fallback", debate_id)
        synthesis_data = FALLBACK_SYNTHESIS

    # Save synthesis to debate (stored in verdict column for backward compatibility)
    debate.verdict = synthesis_data
    debate.status = "completed"
    debate.completed_at = datetime.now(timezone.utc)
    await db.commit()

    # Publish completion SSE with synthesis preview
    synthesis = synthesis_data.get("synthesis", {})
    await publish_event(str(debate_id), "debate_complete", {
        "debate_id": str(debate_id),
        "synthesis_preview": synthesis.get("bottom_line", ""),
        "confidence_level": synthesis.get("confidence_level", "uncertain"),
    })

    logger.info("Synthesis completed for debate %s: confidence=%s",
                debate_id, synthesis.get("confidence_level"))


# Backward compatibility alias
judge_debate = synthesize_debate


def _to_decimal(val) -> Decimal | None:
    if val is None:
        return None
    try:
        return Decimal(str(val))
    except Exception:
        return None
