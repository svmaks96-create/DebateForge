import json
import logging

import anthropic

from config import settings

logger = logging.getLogger("uvicorn.error")

SYSTEM_PROMPT = """\
You are an expert at designing realistic debate panel participants. Given a debate topic, \
generate role-based identities for agents who will argue pro and con sides.

Rules:
- Each identity must represent a realistic stakeholder who would NATURALLY argue their assigned side.
- Identities on the SAME side must bring DIFFERENT perspectives — they should complement each other, not duplicate.
- Make them feel like real team members with genuine expertise, not caricatures or stereotypes.
- Pro and con identities should create interesting tension when debating each other.

Each identity must have exactly these fields:
- title: A short role title (e.g., "Senior Platform Architect")
- expertise: Their domain knowledge and technical/business skills
- priorities: What they care about most and optimize for
- style: How they argue and communicate — their rhetorical approach
- background: Brief professional background that explains their perspective

You MUST respond with valid JSON only, no markdown, no explanation. Format:
{"pro": [<list of identities>], "con": [<list of identities>]}
"""


async def generate_identities(
    topic: str,
    context: str | None,
    pro_count: int,
    con_count: int,
) -> dict:
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    user_msg = f"Debate topic: {topic}\n"
    if context:
        user_msg += f"Context: {context}\n"
    user_msg += f"\nGenerate {pro_count} pro identities and {con_count} con identities."

    for attempt in range(2):
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        )

        text = response.content[0].text

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try extracting JSON from a code block
            if "```" in text:
                start = text.find("{")
                end = text.rfind("}") + 1
                if start != -1 and end > start:
                    try:
                        return json.loads(text[start:end])
                    except json.JSONDecodeError:
                        pass

            if attempt == 0:
                logger.warning("Identity generation JSON parse failed, retrying")
                continue

            raise ValueError(f"Failed to parse identity generation response after 2 attempts: {text[:200]}")
