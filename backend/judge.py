import json
import logging
import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import anthropic

from config import settings
from events import publish_event
from models import AgentPosition, Argument, Debate, DebateAgent, Round

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("uvicorn.error")

MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 4096

FALLBACK_SYNTHESIS = {
    "synthesis": {
        "bottom_line": "Synthesis could not be parsed. Review the deliberation transcript.",
        "confidence_level": "uncertain",
        "themes": [],
        "council_consensus": [],
        "major_disagreements": [],
        "individual_positions": [],
        "blind_spots": [],
        "key_insights": [],
        "open_questions": [],
        "nuanced_conclusion": "Please re-run the synthesis.",
    }
}


def _build_synthesizer_system_prompt(
    topic: str,
    context: str | None,
    agents: list[DebateAgent],
) -> str:
    agent_list = "\n".join(
        f"  - Seat {a.seat_number + 1} ({a.argument_prefix}): {a.title}\n"
        f"    Expertise: {a.expertise}\n"
        f"    Priorities: {a.priorities}"
        for a in agents
    )

    prompt = f"""\
You are an expert analyst synthesizing a council deliberation. Your job is to organize the \
collective insight by THEME, not by agent. Do NOT pick a winner or side. Identify the key \
themes that emerged and show how each council member weighed in on each theme.

Topic: {topic}
{"Context: " + context if context else ""}

Council members:
{agent_list}

SYNTHESIS PRINCIPLES:
1. Organize by THEME (3-6 key themes), not by agent.
2. For each theme: summarize, list each council member's perspective (with stance + confidence), rate consensus level, note key tension if low consensus.
3. Highlight where the council AGREED — convergence points are high-signal.
4. When agents conceded points or changed their thinking, treat those as high-signal data.
5. Be honest about what is genuinely uncertain or unresolvable.
6. Extract non-obvious insights from cross-pollination of different expertise areas.
7. Do NOT pick a winner or declare one position superior.
8. Produce actionable insight, not just academic analysis.

You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.
Output format:
{{
  "synthesis": {{
    "bottom_line": "2-3 sentence executive summary of what the deliberation revealed. Not who won, but what the collective analysis suggests.",
    "confidence_level": "high|moderate|low|uncertain",
    "themes": [
      {{
        "theme": "Theme name (e.g., Valuation Risk)",
        "summary": "What the council thinks about this theme",
        "perspectives": [
          {{"agent_title": "...", "agent_prefix": "A", "stance": "supportive|critical|mixed|neutral", "view": "This agent's perspective on this theme", "confidence": 8}}
        ],
        "consensus_level": "high|medium|low",
        "key_tension": "What is debated on this theme (null if high consensus)"
      }}
    ],
    "council_consensus": [
      "Points where all or most council members agreed"
    ],
    "major_disagreements": [
      {{
        "topic": "What they disagree about",
        "camps": [
          {{"agents": ["A", "C"], "position": "Their shared position"}},
          {{"agents": ["B"], "position": "The opposing position"}}
        ],
        "why_unresolvable": "Why this couldn't be resolved in the deliberation"
      }}
    ],
    "individual_positions": [
      {{
        "agent_prefix": "A",
        "agent_title": "...",
        "overall_stance": "supportive|critical|mixed|uncertain",
        "confidence": 7,
        "position_summary": "...",
        "key_concerns": [...],
        "key_supports": [...],
        "would_change_mind": "..."
      }}
    ],
    "blind_spots": ["Important dimensions not adequately addressed by the council"],
    "key_insights": ["Non-obvious insights that emerged from cross-pollination of perspectives"],
    "open_questions": ["Unanswered questions from the deliberation"],
    "nuanced_conclusion": "3-4 paragraph balanced conclusion organized by themes. What the evidence suggests, where it is uncertain, and what a decision-maker should consider."
  }}
}}"""

    return prompt


def _build_synthesizer_user_message(
    arguments: list[Argument],
    agents: list[DebateAgent],
    rounds_info: list[dict],
    positions: list[AgentPosition],
) -> str:
    agent_map = {a.id: a for a in agents}

    msg = "=== FULL DELIBERATION TRANSCRIPT ===\n"

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
            agent_prefix = agent.argument_prefix if agent else "?"

            msg += f"\n[{agent_prefix} — {agent_title} ({arg.argument_index})]"
            msg += f"\n  Type: {arg.arg_type}"
            msg += f"\n  Stance: {arg.stance}"
            msg += f"\n  Confidence: {arg.confidence}/10" if arg.confidence else ""
            if arg.targets:
                msg += f"\n  Targets: {json.dumps(arg.targets)}"
            msg += f"\n  Claim: {arg.claim or '(none)'}"
            msg += f"\n  Grounds: {arg.grounds or '(none)'}"
            msg += f"\n  Warrant: {arg.warrant or '(none)'}"
            msg += f"\n  Backing: {arg.backing or '(none)'}"
            msg += f"\n  Qualifier: {arg.qualifier or '(none)'}"
            if arg.summary:
                msg += f"\n  Summary: {arg.summary}"
            msg += "\n"

    msg += "\n=== END TRANSCRIPT ===\n"

    # Append final position statements
    if positions:
        msg += "\n=== FINAL POSITION STATEMENTS ===\n"
        for pos in positions:
            agent = agent_map.get(pos.agent_id)
            agent_title = agent.title if agent else "Unknown"
            agent_prefix = agent.argument_prefix if agent else "?"

            msg += f"\n[{agent_prefix} — {agent_title}]"
            msg += f"\n  Overall Stance: {pos.overall_stance}"
            msg += f"\n  Confidence: {pos.confidence}/10" if pos.confidence else ""
            msg += f"\n  Position: {pos.position_summary}"
            if pos.key_concerns:
                msg += f"\n  Key Concerns: {json.dumps(pos.key_concerns)}"
            if pos.key_supports:
                msg += f"\n  Key Supports: {json.dumps(pos.key_supports)}"
            if pos.would_change_mind:
                msg += f"\n  Would Change Mind If: {pos.would_change_mind}"
            msg += "\n"
        msg += "\n=== END POSITIONS ===\n"

    msg += "\nSynthesize this deliberation now. Organize by THEME, not by agent. Respond with JSON only."
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


async def synthesize_deliberation(
    debate_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    """Synthesize a completed council deliberation with theme-based analysis."""
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

    # Load all arguments
    args_result = await db.execute(
        select(Argument)
        .where(Argument.debate_id == debate_id)
        .order_by(Argument.created_at)
    )
    arguments = args_result.scalars().all()

    # Load rounds
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

    # Load final positions
    positions_result = await db.execute(
        select(AgentPosition)
        .where(AgentPosition.debate_id == debate_id)
        .order_by(AgentPosition.created_at)
    )
    positions = positions_result.scalars().all()

    if not arguments:
        logger.warning("No arguments found for debate %s, using fallback synthesis", debate_id)
        debate.synthesis = FALLBACK_SYNTHESIS
        debate.status = "completed"
        debate.completed_at = datetime.now(timezone.utc)
        await db.commit()
        await publish_event(str(debate_id), "debate_complete", {
            "bottom_line": FALLBACK_SYNTHESIS["synthesis"]["bottom_line"],
            "confidence_level": FALLBACK_SYNTHESIS["synthesis"]["confidence_level"],
        })
        return

    # Build prompts
    system_prompt = _build_synthesizer_system_prompt(debate.topic, debate.context, agents)
    user_message = _build_synthesizer_user_message(arguments, agents, rounds_info, positions)

    # Call Claude with retry
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

    # Save synthesis to debate
    debate.synthesis = synthesis_data
    debate.status = "completed"
    debate.completed_at = datetime.now(timezone.utc)
    await db.commit()

    # Publish completion SSE
    synthesis = synthesis_data.get("synthesis", {})
    await publish_event(str(debate_id), "debate_complete", {
        "bottom_line": synthesis.get("bottom_line", ""),
        "confidence_level": synthesis.get("confidence_level", "uncertain"),
    })

    logger.info("Synthesis completed for debate %s: confidence=%s",
                debate_id, synthesis.get("confidence_level"))
