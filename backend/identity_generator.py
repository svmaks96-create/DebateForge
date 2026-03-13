import json
import logging

import anthropic

from config import settings

logger = logging.getLogger("uvicorn.error")

SYSTEM_PROMPT = """\
You are an expert at assembling diverse expert councils for deliberation. Given a topic, \
generate a council of independent experts who each bring a unique, complementary perspective.

Rules:
- Each expert must have a natural reason to care about this topic from their domain.
- Do NOT assign sides or positions — each expert will form their own view during deliberation.
- At least one expert should be naturally skeptical or risk-focused (e.g., risk analyst, auditor, critic).
- At least one should have deep domain expertise directly relevant to the topic area.
- Avoid redundancy — each seat must unlock a unique dimension of analysis.
- The combination of perspectives should create productive tension and cover blind spots.
- Make them feel like real professionals with genuine expertise, not caricatures.

Each identity must have exactly these fields:
- title: A short role title (e.g., "Senior Platform Architect", "Behavioral Economist")
- expertise: Their domain knowledge and technical/business skills
- priorities: What they care about most and optimize for
- style: How they communicate and reason — their analytical approach
- background: Brief professional background that explains their perspective

You MUST respond with valid JSON only, no markdown, no explanation. Format:
{"council": [<list of identities>]}
"""


async def generate_council(
    topic: str,
    context: str | None,
    council_size: int,
) -> dict:
    """Generate a diverse council of experts for deliberation on a topic."""
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    user_msg = f"Topic: {topic}\n"
    if context:
        user_msg += f"Context: {context}\n"
    user_msg += f"\nGenerate a council of {council_size} experts."

    for attempt in range(2):
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        )

        text = response.content[0].text

        # Tier 1: Direct JSON parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Tier 2: Extract JSON from code block
        if "```" in text:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start != -1 and end > start:
                try:
                    return json.loads(text[start:end])
                except json.JSONDecodeError:
                    pass

        # Tier 3: Find any JSON object in the text
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass

        if attempt == 0:
            logger.warning("Council generation JSON parse failed, retrying")
            continue

        raise ValueError(
            f"Failed to parse council generation response after 2 attempts: {text[:200]}"
        )


# Keep backward-compatible alias used by routes
async def generate_identities(
    topic: str,
    context: str | None,
    council_size: int,
) -> dict:
    return await generate_council(topic, context, council_size)
