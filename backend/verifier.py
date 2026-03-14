import json
import logging
import re
from uuid import UUID

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from events import publish_event
from models import Argument, Debate, DebateAgent, Round
from search import web_search

logger = logging.getLogger("uvicorn.error")

MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 8192
MAX_SEARCHES = 5

SEARCH_TOOL = {
    "name": "web_search",
    "description": "Search the web to independently verify a factual claim made during the deliberation.",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Specific factual query to verify a claim"}
        },
        "required": ["query"],
    },
}

FALLBACK_REPORT = {
    "verified_claims": [],
    "shared_blind_spots": [],
    "missing_perspectives": [],
    "logical_gaps": [],
    "overall_reliability": "unknown",
    "reliability_explanation": "Verification could not be completed",
}

SYSTEM_PROMPT = """\
You are a rigorous fact-checker and critical analyst. You have been given the \
complete transcript of a council deliberation with citations.

YOUR TASK: Independently verify key factual claims, identify logical gaps, \
and flag potential issues. You are NOT on any side — you are accountable \
only to the truth.

FOR EACH MAJOR FACTUAL CLAIM:
1. Is this claim verifiable?
2. If citations were provided, do they actually support the claim?
3. Use web_search to independently verify important claims
4. Are there counter-facts that no council member mentioned?
5. Is the claim current or potentially outdated?

ALSO CHECK FOR:
- Shared assumptions: things ALL council members took for granted that might be wrong
- Missing perspectives: important angles nobody explored
- Logical gaps: reasoning that jumps from A to C without B
- Statistical misuse: cherry-picked data, correlation vs causation

You have a maximum of 5 web searches — use them on the most important claims.

You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.
Output format:
{
  "verified_claims": [
    {
      "claim": "The specific factual claim",
      "source_argument": "A1",
      "verification_status": "verified|partially_true|disputed|unverifiable|false",
      "explanation": "What your verification found",
      "corrected_claim": "Corrected version if needed, null otherwise"
    }
  ],
  "shared_blind_spots": [
    {
      "assumption": "What all council members assumed",
      "challenge": "Why this assumption might be wrong",
      "impact": "How this affects the deliberation's conclusions"
    }
  ],
  "missing_perspectives": [
    "Important angles nobody explored"
  ],
  "logical_gaps": [
    {
      "argument_id": "B2",
      "gap": "Description of the logical gap",
      "severity": "significant|minor"
    }
  ],
  "overall_reliability": "high|moderate|low",
  "reliability_explanation": "Summary of the deliberation's factual reliability"
}"""


def _build_user_message(
    topic: str,
    context: str | None,
    arguments: list[Argument],
    agents: list[DebateAgent],
    rounds: list[Round],
) -> str:
    agent_map = {a.id: a for a in agents}
    round_map = {r.id: r for r in rounds}

    msg = f"Topic: {topic}\n"
    if context:
        msg += f"Context: {context}\n"

    msg += "\nCouncil members:\n"
    for a in agents:
        msg += f"  - {a.argument_prefix} ({a.title}): {a.expertise}\n"

    msg += "\n=== FULL DELIBERATION TRANSCRIPT ===\n"

    # Group arguments by round
    args_by_round: dict[int, list[Argument]] = {}
    for arg in arguments:
        rnd = round_map.get(arg.round_id)
        if rnd:
            args_by_round.setdefault(rnd.round_number, []).append(arg)

    for round_number in sorted(args_by_round.keys()):
        rnd = next(r for r in rounds if r.round_number == round_number)
        msg += f"\n--- Round {round_number} ({rnd.round_type}) ---\n"

        round_args = sorted(args_by_round[round_number], key=lambda a: a.created_at)
        for arg in round_args:
            agent = agent_map.get(arg.agent_id)
            prefix = agent.argument_prefix if agent else "?"
            title = agent.title if agent else "Unknown"

            msg += f"\n[{prefix} — {title} ({arg.argument_index})]"
            msg += f"\n  Stance: {arg.stance} | Confidence: {arg.confidence}/10"
            msg += f"\n  Claim: {arg.claim or '(none)'}"
            msg += f"\n  Grounds: {arg.grounds or '(none)'}"
            msg += f"\n  Warrant: {arg.warrant or '(none)'}"
            if arg.citations:
                msg += "\n  Citations:"
                for cite in arg.citations:
                    msg += f"\n    [{cite.get('source_type', 'web')}] {cite.get('title', '')} — {cite.get('url', '')}"
            else:
                msg += "\n  [No sources cited]"
            msg += "\n"

    msg += "\n=== END TRANSCRIPT ===\n"
    msg += "\nVerify the key factual claims now. Use web_search for the most important ones. Respond with JSON only."
    return msg


def _parse_verification_response(raw_text: str) -> dict | None:
    """Three-tier parse: direct JSON -> code block -> brace search."""
    # Try 1: direct parse
    try:
        data = json.loads(raw_text)
        if "verified_claims" in data or "overall_reliability" in data:
            return data
    except json.JSONDecodeError:
        pass

    # Try 2: code block extraction
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(1))
            if "verified_claims" in data or "overall_reliability" in data:
                return data
        except json.JSONDecodeError:
            pass

    # Try 3: find any JSON object in the text
    brace_start = raw_text.find("{")
    if brace_start >= 0:
        try:
            data = json.loads(raw_text[brace_start:])
            if "verified_claims" in data or "overall_reliability" in data:
                return data
        except json.JSONDecodeError:
            pass

    return None


def _format_search_results(results: list[dict]) -> str:
    if not results:
        return "No results found."
    lines = []
    for r in results:
        lines.append(f"[{r.get('source_type', 'web')}] {r.get('title', 'Untitled')}")
        lines.append(f"  URL: {r.get('url', '')}")
        if r.get("date"):
            lines.append(f"  Date: {r['date']}")
        lines.append(f"  {r.get('snippet', '')}")
        lines.append("")
    return "\n".join(lines)


async def verify_deliberation(debate_id: UUID, db: AsyncSession) -> dict:
    """Run adversarial verification on a completed deliberation."""
    # Load debate
    debate = await db.get(Debate, debate_id)
    if not debate:
        raise ValueError(f"Debate {debate_id} not found")

    # Load agents
    agents_result = await db.execute(
        select(DebateAgent)
        .where(DebateAgent.debate_id == debate_id)
        .order_by(DebateAgent.seat_number)
    )
    agents = agents_result.scalars().all()

    # Load arguments
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

    if not arguments:
        logger.warning("No arguments to verify for debate %s", debate_id)
        debate.verification_report = FALLBACK_REPORT
        await db.commit()
        return FALLBACK_REPORT

    # Publish SSE: verification starting
    await publish_event(str(debate_id), "verification_start", {})

    # Build prompt
    user_message = _build_user_message(
        debate.topic, debate.context, arguments, agents, rounds
    )

    # Call Claude with tool_use loop
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    messages = [{"role": "user", "content": user_message}]
    search_count = 0
    report = None

    for attempt in range(2):
        try:
            response = await client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=SYSTEM_PROMPT,
                messages=messages,
                tools=[SEARCH_TOOL],
            )

            # Tool-use loop: handle web_search calls
            while response.stop_reason == "tool_use" and search_count < MAX_SEARCHES:
                assistant_content = response.content
                tool_results = []

                for block in assistant_content:
                    if block.type == "tool_use" and block.name == "web_search":
                        search_count += 1
                        query = block.input.get("query", "")
                        logger.info(
                            "Verifier searching (%d/%d): %s",
                            search_count, MAX_SEARCHES, query[:80],
                        )
                        results = await web_search(query)
                        formatted = _format_search_results(results)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": formatted,
                        })

                if not tool_results:
                    break

                messages.append({"role": "assistant", "content": assistant_content})
                messages.append({"role": "user", "content": tool_results})

                response = await client.messages.create(
                    model=MODEL,
                    max_tokens=MAX_TOKENS,
                    system=SYSTEM_PROMPT,
                    messages=messages,
                    tools=[SEARCH_TOOL],
                )

            # Extract final text
            raw_text = ""
            for block in response.content:
                if hasattr(block, "text"):
                    raw_text += block.text

            if raw_text:
                report = _parse_verification_response(raw_text)
                if report:
                    break
                logger.warning("Verification response parse failed on attempt %d", attempt + 1)
            else:
                logger.warning("Verifier returned no text on attempt %d", attempt + 1)

        except anthropic.APIError as e:
            if attempt == 0:
                logger.warning("Verifier Claude API error on attempt 1, retrying: %s", e)
                messages = [{"role": "user", "content": user_message}]
                search_count = 0
                continue
            logger.error("Verifier Claude API error on attempt 2: %s", e)

    if not report:
        logger.error("Verification failed for debate %s, using fallback", debate_id)
        report = FALLBACK_REPORT

    # Save to database
    debate.verification_report = report
    await db.commit()

    # Publish SSE: verification complete
    await publish_event(str(debate_id), "verification_complete", {
        "overall_reliability": report.get("overall_reliability", "unknown"),
        "verified_count": len(report.get("verified_claims", [])),
        "blind_spots_count": len(report.get("shared_blind_spots", [])),
    })

    logger.info(
        "Verification completed for debate %s: reliability=%s, claims=%d",
        debate_id,
        report.get("overall_reliability"),
        len(report.get("verified_claims", [])),
    )

    return report
