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

FALLBACK_VERDICT = {
    "verdict": "DRAW",
    "confidence": 0.5,
    "score": {"pro": 50, "con": 50},
    "executive_summary": "Judge analysis could not be parsed. Review arguments manually.",
    "recommendation": "Re-run the debate or review the raw transcript.",
}


def _build_judge_system_prompt(
    topic: str,
    context: str | None,
    agents: list[DebateAgentModel],
) -> str:
    pro_agents = [a for a in agents if a.side == "pro"]
    con_agents = [a for a in agents if a.side == "con"]
    is_panel = len(pro_agents) > 1 or len(con_agents) > 1

    def agent_block(a: DebateAgentModel) -> str:
        return (
            f"  - Prefix: {a.argument_prefix}, Title: {a.title}\n"
            f"    Expertise: {a.expertise}\n"
            f"    Priorities: {a.priorities}"
        )

    pro_list = "\n".join(agent_block(a) for a in pro_agents)
    con_list = "\n".join(agent_block(a) for a in con_agents)

    panel_section = ""
    if is_panel:
        panel_section = """
- panel_dynamics (object, only for multi-agent panels):
    - coordination: How well agents on the same side coordinated
    - coverage: Whether the panel covered the topic broadly
    - synergy: Whether arguments built on each other
    - strongest_agent: Prefix of strongest contributor per side
    - weakest_agent: Prefix of weakest contributor per side"""

    prompt = f"""\
You are an expert debate judge. Evaluate the following debate with rigorous analytical precision.

Proposition: {topic}
{"Context: " + context if context else ""}

PRO panel:
{pro_list}

CON panel:
{con_list}

Analysis framework — evaluate every argument using ALL of the following:

1. Toulmin scoring (0.0-10.0 per dimension per argument):
   - claim_score: Clarity and specificity of the claim
   - grounds_score: Quality and relevance of evidence
   - warrant_score: Logical connection between grounds and claim
   - backing_score: Additional support and credibility
   - qualifier_score: Appropriate hedging and scope limitation
   - overall_strength: Holistic assessment

2. Fallacy detection: For each fallacy found, specify type, explanation, severity (low/medium/high)

3. Logical dependency mapping: Which arguments depend on or respond to which, and whether defeating one collapses a chain

4. Evidence quality: Per side — specificity, relevance, recency, authority

5. Rebuttal effectiveness: Did rebuttals steelman or strawman the opponent?

6. Consistency check: Any contradictions within a side?
{panel_section}

You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.
Output format:
{{
  "verdict": "PRO|CON|DRAW",
  "confidence": 0.0-1.0,
  "score": {{"pro": 0-100, "con": 0-100}},
  "executive_summary": "2-3 sentence summary of the outcome",
  "recommendation": "Actionable recommendation based on the debate",
  "argument_analysis": [
    {{
      "argument_index": "A1",
      "claim_score": 7.5,
      "grounds_score": 8.0,
      "warrant_score": 7.0,
      "backing_score": 6.5,
      "qualifier_score": 7.0,
      "overall_strength": 7.2,
      "fallacies": [
        {{"type": "appeal_to_authority", "explanation": "...", "severity": "low"}}
      ],
      "notes": "Brief commentary on this argument"
    }}
  ],
  "dependency_graph": [
    {{"from": "B1", "to": "A1", "relationship": "rebuts"}}
  ],
  "evidence_quality": {{
    "pro": {{"specificity": 7, "relevance": 8, "recency": 6, "authority": 7}},
    "con": {{"specificity": 6, "relevance": 7, "recency": 7, "authority": 6}}
  }},
  "rebuttal_assessment": {{
    "pro": "Assessment of pro rebuttals",
    "con": "Assessment of con rebuttals"
  }},
  "consistency": {{
    "pro": "Any contradictions found",
    "con": "Any contradictions found"
  }}
}}"""

    return prompt


def _build_judge_user_message(
    arguments: list[Argument],
    agents: list[DebateAgentModel],
    rounds_info: list[dict],
) -> str:
    agent_map = {a.id: a for a in agents}

    msg = "=== FULL DEBATE TRANSCRIPT ===\n"

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
            if arg.summary:
                msg += f"\n  Summary: {arg.summary}"
            msg += "\n"

    msg += "\n=== END TRANSCRIPT ===\n"
    msg += "\nEvaluate this debate now. Respond with JSON only."
    return msg


def _parse_judge_response(raw_text: str) -> dict | None:
    """Three-tier parse: direct JSON → code block → None."""
    # Try 1: direct parse
    try:
        data = json.loads(raw_text)
        if "verdict" in data:
            return data
    except json.JSONDecodeError:
        pass

    # Try 2: code block extraction
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(1))
            if "verdict" in data:
                return data
        except json.JSONDecodeError:
            pass

    # Try 3: find any JSON object in the text
    brace_start = raw_text.find("{")
    if brace_start >= 0:
        try:
            data = json.loads(raw_text[brace_start:])
            if "verdict" in data:
                return data
        except json.JSONDecodeError:
            pass

    return None


async def judge_debate(
    debate_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    """Evaluate a completed debate and save the verdict."""
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
        logger.warning("No arguments found for debate %s, using fallback verdict", debate_id)
        debate.verdict = FALLBACK_VERDICT
        debate.status = "completed"
        debate.completed_at = datetime.now(timezone.utc)
        await db.commit()
        await publish_event(str(debate_id), "debate_complete", {
            "debate_id": str(debate_id),
            "verdict": FALLBACK_VERDICT,
        })
        return

    # Build prompts
    system_prompt = _build_judge_system_prompt(debate.topic, debate.context, agents)
    user_message = _build_judge_user_message(arguments, agents, rounds_info)

    # Call Claude
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    verdict_data = None

    for attempt in range(2):
        try:
            response = await client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )
            raw_text = response.content[0].text
            verdict_data = _parse_judge_response(raw_text)
            if verdict_data:
                break
            logger.warning("Judge response parse failed on attempt %d", attempt + 1)
        except anthropic.APIError as e:
            if attempt == 0:
                logger.warning("Judge Claude API error on attempt 1, retrying: %s", e)
                continue
            logger.error("Judge Claude API error on attempt 2: %s", e)

    if not verdict_data:
        logger.error("Judge could not produce valid verdict for debate %s, using fallback", debate_id)
        verdict_data = FALLBACK_VERDICT

    # Save per-argument analysis rows
    for arg_analysis in verdict_data.get("argument_analysis", []):
        analysis_row = ArgumentAnalysis(
            debate_id=debate_id,
            argument_index=arg_analysis.get("argument_index", "?"),
            claim_score=_to_decimal(arg_analysis.get("claim_score")),
            grounds_score=_to_decimal(arg_analysis.get("grounds_score")),
            warrant_score=_to_decimal(arg_analysis.get("warrant_score")),
            backing_score=_to_decimal(arg_analysis.get("backing_score")),
            qualifier_score=_to_decimal(arg_analysis.get("qualifier_score")),
            overall_strength=_to_decimal(arg_analysis.get("overall_strength")),
            fallacies=arg_analysis.get("fallacies"),
            notes=arg_analysis.get("notes"),
        )
        db.add(analysis_row)

    # Save verdict to debate
    debate.verdict = verdict_data
    debate.status = "completed"
    debate.completed_at = datetime.now(timezone.utc)
    await db.commit()

    # Publish completion SSE
    await publish_event(str(debate_id), "debate_complete", {
        "debate_id": str(debate_id),
        "verdict": {
            "verdict": verdict_data.get("verdict"),
            "confidence": verdict_data.get("confidence"),
            "score": verdict_data.get("score"),
            "executive_summary": verdict_data.get("executive_summary"),
        },
    })

    logger.info("Judge completed for debate %s: %s", debate_id, verdict_data.get("verdict"))


def _to_decimal(val) -> Decimal | None:
    if val is None:
        return None
    try:
        return Decimal(str(val))
    except Exception:
        return None
