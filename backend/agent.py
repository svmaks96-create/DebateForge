import json
import logging
import re

import anthropic

from config import settings
from search import web_search

logger = logging.getLogger("uvicorn.error")

MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 2000
MAX_SEARCHES_PER_TURN = 3

SEARCH_TOOL = {
    "name": "web_search",
    "description": "Search the web for real evidence, data, statistics, or recent news to support or challenge a claim. Use this when making factual claims that benefit from real-world evidence.",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Specific factual search query"}
        },
        "required": ["query"],
    },
}


class CouncilAgent:
    def __init__(
        self,
        identity: dict,
        topic: str,
        context: str | None,
        argument_prefix: str,
        seat_number: int,
        council_members: list[dict],
    ):
        self.identity = identity
        self.topic = topic
        self.context = context
        self.argument_prefix = argument_prefix
        self.seat_number = seat_number
        self.council_members = council_members
        self.client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    def _build_system_prompt(self) -> str:
        identity = self.identity
        title = identity.get("title", "Analyst")

        prompt = f"""\
You are {title}, participating in a council deliberation as an independent expert.
Your position on the topic is NOT pre-assigned — it emerges naturally from your role,
expertise, and priorities. You may be supportive, critical, mixed, or neutral on any point.

Your identity:
- Title: {title}
- Expertise: {identity.get('expertise', 'General')}
- Priorities: {identity.get('priorities', 'Truth-seeking')}
- Style: {identity.get('style', 'Balanced')}
- Background: {identity.get('background', '')}

Other council members at the table:"""

        for member in self.council_members:
            if member["seat_number"] == self.seat_number:
                continue
            prefix = chr(ord("A") + member["seat_number"])
            prompt += f"\n- Seat {member['seat_number'] + 1} ({prefix}): {member.get('title', 'Member')} — {member.get('expertise', '')}"

        prompt += f"""

PRINCIPLES:
1. Your position emerges from your expertise and priorities — you are NOT assigned a side.
2. For each argument, honestly label your stance: supportive | critical | mixed | neutral.
3. Rate your confidence 0-10 on each argument honestly.
4. Acknowledge strong points from other members, even when you disagree overall.
5. Flag genuine uncertainties and limitations in your own reasoning.
6. You may agree, disagree, question, or build on any other member's points.
7. Distinguish between what you're confident about vs what's genuinely uncertain.

RULES:
1. Structure every argument using the Toulmin model: claim, grounds, warrant, backing, qualifier.
2. Number your arguments with your prefix "{self.argument_prefix}" (e.g., {self.argument_prefix}1, {self.argument_prefix}2).
3. Reference other members' arguments by their IDs (e.g., "Responding to B1...").
4. Do NOT use logical fallacies — argue with evidence and sound reasoning.
5. Vary your arguments across rounds — do not repeat the same points.
6. Stay in character: argue from your expertise and priorities.

== EVIDENCE ==
You have access to a web_search tool. Use it to find real evidence when making
factual claims about data, statistics, studies, or current events. You should:
- Search BEFORE making claims that rely on specific numbers or facts
- Cite your sources in the citations field of each argument
- Be honest if search results contradict your position
- Max 3 searches per round — choose queries wisely
- Not every argument needs citations — logical reasoning is also valuable

You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.
Format:
{{
  "arguments": [
    {{
      "id": "{self.argument_prefix}1",
      "type": "claim|rebuttal|concession|concession_with_nuance|question|build_on",
      "stance": "supportive|critical|mixed|neutral",
      "targets": [],
      "claim": "Your main claim",
      "grounds": "Evidence and data supporting the claim",
      "warrant": "Reasoning connecting grounds to claim",
      "backing": "Additional support for the warrant",
      "qualifier": "Conditions or limitations on the claim",
      "confidence": 7,
      "citations": [
        {{"url": "...", "title": "...", "snippet": "...", "date": "...", "source_type": "news|academic|government|web"}}
      ]
    }}
  ],
  "summary": "Brief summary of your perspective this round"
}}

The "confidence" field is required: an integer 0-10 reflecting how genuinely confident you are.
The "stance" field is required: how you feel about this particular point.
The "citations" field: list of sources from your web searches (empty list [] if none).
The "type" field options:
- "claim": a new point or assertion
- "rebuttal": directly countering another member's argument
- "concession": acknowledging another member's point is valid
- "concession_with_nuance": conceding but adding important caveats
- "question": raising a question for the council to consider
- "build_on": extending or strengthening another member's argument"""
        return prompt

    def _build_user_message(
        self,
        round_type: str,
        round_number: int,
        conversation_history: list[dict],
    ) -> str:
        msg = f"Topic: {self.topic}\n"
        if self.context:
            msg += f"Context: {self.context}\n"
        msg += f"Round: {round_number} ({round_type})\n"

        if conversation_history:
            msg += "\n--- Conversation history ---\n"
            for entry in conversation_history:
                agent_prefix = entry.get("agent_prefix", "?")
                agent_title = entry.get("agent_title", "Member")
                msg += f"\n[{agent_prefix} — {agent_title}]"
                for arg in entry.get("arguments", []):
                    stance = arg.get("stance", "neutral")
                    confidence = arg.get("confidence", "?")
                    msg += f"\n  {arg.get('id', '?')} [{stance}, confidence:{confidence}]: {arg.get('claim', '')}"
                if entry.get("summary"):
                    msg += f"\n  Summary: {entry['summary']}"
            msg += "\n--- End history ---\n"

        msg += f"\nPresent your {round_type} arguments now."
        return msg

    async def generate_arguments(
        self,
        round_type: str,
        round_number: int,
        conversation_history: list[dict],
    ) -> dict:
        system_prompt = self._build_system_prompt()
        user_message = self._build_user_message(
            round_type, round_number, conversation_history
        )

        messages = [{"role": "user", "content": user_message}]
        search_count = 0

        for attempt in range(2):
            try:
                response = await self.client.messages.create(
                    model=MODEL,
                    max_tokens=MAX_TOKENS,
                    system=system_prompt,
                    messages=messages,
                    tools=[SEARCH_TOOL],
                )

                # Tool-use loop: handle web_search calls
                while response.stop_reason == "tool_use" and search_count < MAX_SEARCHES_PER_TURN:
                    # Collect all tool_use blocks from the response
                    assistant_content = response.content
                    tool_results = []

                    for block in assistant_content:
                        if block.type == "tool_use" and block.name == "web_search":
                            search_count += 1
                            query = block.input.get("query", "")
                            logger.info(
                                "Agent %s searching (%d/%d): %s",
                                self.argument_prefix, search_count, MAX_SEARCHES_PER_TURN, query[:80],
                            )
                            results = await web_search(query)
                            formatted = self._format_search_results(results)
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": formatted,
                            })

                    if not tool_results:
                        break

                    messages.append({"role": "assistant", "content": assistant_content})
                    messages.append({"role": "user", "content": tool_results})

                    response = await self.client.messages.create(
                        model=MODEL,
                        max_tokens=MAX_TOKENS,
                        system=system_prompt,
                        messages=messages,
                        tools=[SEARCH_TOOL],
                    )

                # Extract final text response
                raw_text = ""
                for block in response.content:
                    if hasattr(block, "text"):
                        raw_text += block.text

                if not raw_text:
                    logger.warning("Agent %s returned no text, using fallback", self.argument_prefix)
                    return self._fallback_response()

                return self.parse_response(raw_text)

            except anthropic.APIError as e:
                if attempt == 0:
                    logger.warning("Claude API error on attempt 1, retrying: %s", e)
                    messages = [{"role": "user", "content": user_message}]
                    search_count = 0
                    continue
                logger.error("Claude API error on attempt 2, raising: %s", e)
                raise

    def _format_search_results(self, results: list[dict]) -> str:
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

    def _fallback_response(self) -> dict:
        return {
            "arguments": [
                {
                    "id": f"{self.argument_prefix}1",
                    "type": "claim",
                    "stance": "neutral",
                    "targets": [],
                    "claim": "Unable to generate structured response",
                    "grounds": "",
                    "warrant": "",
                    "backing": "",
                    "qualifier": "",
                    "confidence": 5,
                    "citations": [],
                }
            ],
            "summary": "Fallback response",
        }

    async def generate_final_position(
        self,
        conversation_history: list[dict],
    ) -> dict:
        identity = self.identity
        title = identity.get("title", "Analyst")

        system_prompt = f"""\
You are {title}. The council deliberation has concluded. Reflect on the full discussion
and state your final position.

Your identity:
- Title: {title}
- Expertise: {identity.get('expertise', 'General')}
- Priorities: {identity.get('priorities', 'Truth-seeking')}
- Style: {identity.get('style', 'Balanced')}
- Background: {identity.get('background', '')}

You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.
Format:
{{
  "overall_stance": "supportive|critical|mixed|uncertain",
  "confidence": 7,
  "position_summary": "2-3 sentence summary of your final position",
  "key_concerns": [
    {{"concern": "Description of concern", "severity": "high|medium|low"}}
  ],
  "key_supports": [
    {{"point": "Description of supporting point", "confidence": 8}}
  ],
  "would_change_mind": "What evidence or arguments would change your position"
}}

Be honest. If the deliberation changed your thinking, say so. If you remain firm, explain why."""

        msg = f"Topic: {self.topic}\n"
        if self.context:
            msg += f"Context: {self.context}\n"

        msg += "\n--- Full deliberation transcript ---\n"
        for entry in conversation_history:
            agent_prefix = entry.get("agent_prefix", "?")
            agent_title = entry.get("agent_title", "Member")
            msg += f"\n[{agent_prefix} — {agent_title}]"
            for arg in entry.get("arguments", []):
                stance = arg.get("stance", "neutral")
                confidence = arg.get("confidence", "?")
                msg += f"\n  {arg.get('id', '?')} [{stance}, confidence:{confidence}]: {arg.get('claim', '')}"
            if entry.get("summary"):
                msg += f"\n  Summary: {entry['summary']}"
        msg += "\n--- End transcript ---\n"

        msg += "\nState your final position now."

        for attempt in range(2):
            try:
                response = await self.client.messages.create(
                    model=MODEL,
                    max_tokens=MAX_TOKENS,
                    system=system_prompt,
                    messages=[{"role": "user", "content": msg}],
                )
                raw_text = response.content[0].text
                return self._parse_position_response(raw_text)
            except anthropic.APIError as e:
                if attempt == 0:
                    logger.warning("Claude API error on attempt 1, retrying: %s", e)
                    continue
                logger.error("Claude API error on attempt 2, raising: %s", e)
                raise

    def _parse_position_response(self, raw_text: str) -> dict:
        # Try 1: direct JSON parse
        try:
            data = json.loads(raw_text)
            if "overall_stance" in data:
                return data
        except json.JSONDecodeError:
            pass

        # Try 2: extract from markdown code block
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(1))
                if "overall_stance" in data:
                    return data
            except json.JSONDecodeError:
                pass

        # Try 3: fallback
        logger.warning("Could not parse position response as JSON, using fallback")
        return {
            "overall_stance": "uncertain",
            "confidence": 5,
            "position_summary": raw_text[:300],
            "key_concerns": [],
            "key_supports": [],
            "would_change_mind": "Unable to parse structured response",
        }

    def parse_response(self, raw_text: str) -> dict:
        # Try 1: direct JSON parse
        try:
            data = json.loads(raw_text)
            if "arguments" in data and "summary" in data:
                return data
        except json.JSONDecodeError:
            pass

        # Try 2: extract from markdown code block
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(1))
                if "arguments" in data and "summary" in data:
                    return data
            except json.JSONDecodeError:
                pass

        # Try 3: fallback
        logger.warning("Could not parse agent response as JSON, using fallback")
        return {
            "arguments": [
                {
                    "id": f"{self.argument_prefix}1",
                    "type": "claim",
                    "stance": "neutral",
                    "targets": [],
                    "claim": raw_text[:200],
                    "grounds": "",
                    "warrant": "",
                    "backing": "",
                    "qualifier": "",
                    "confidence": 5,
                }
            ],
            "summary": raw_text,
        }
