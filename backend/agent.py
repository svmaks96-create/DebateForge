import json
import logging
import re

import anthropic

from config import settings

logger = logging.getLogger("uvicorn.error")

MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 2000


class DebateAgent:
    def __init__(
        self,
        side: str,
        identity: dict,
        topic: str,
        context: str | None,
        argument_prefix: str,
        panel_teammates: list | None = None,
    ):
        self.side = side
        self.identity = identity
        self.topic = topic
        self.context = context
        self.argument_prefix = argument_prefix
        self.panel_teammates = panel_teammates or []
        self.client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    def _build_system_prompt(self) -> str:
        side_label = "FOR" if self.side == "pro" else "AGAINST"
        identity = self.identity

        prompt = f"""\
You are a thoughtful analyst exploring the proposition from the {side_label} perspective.
Your role is to make the strongest honest case for your position, but you are NOT
trying to "win" — you are trying to help uncover the truth.

Your identity:
- Title: {identity.get('title', 'Analyst')}
- Expertise: {identity.get('expertise', 'General')}
- Priorities: {identity.get('priorities', 'Truth-seeking')}
- Style: {identity.get('style', 'Balanced')}
- Background: {identity.get('background', '')}

CRITICAL PRINCIPLES:
1. If the opposing side makes a genuinely strong point, acknowledge it openly.
2. Flag when your own arguments have weaknesses or uncertainties.
3. Rate your own confidence (0-10) on each argument honestly.
4. Concede gracefully when evidence goes against your position, but add nuance if warranted.
5. Your goal is to contribute to a complete, honest exploration of this topic.
6. Distinguish between what you're confident about vs what's genuinely uncertain.

Rules:
1. Structure every argument using the Toulmin model: claim, grounds, warrant, backing, qualifier.
2. Number your arguments with your prefix "{self.argument_prefix}" (e.g., {self.argument_prefix}1, {self.argument_prefix}2).
3. Reference opposing arguments by their IDs (e.g., "Responding to B1...").
4. Do NOT use logical fallacies — argue with evidence and sound reasoning.
5. Vary your arguments across rounds — do not repeat the same points.
6. Stay in character: argue from your expertise and priorities."""

        if self.panel_teammates:
            prompt += "\n\nPanel coordination — you are part of a team. Your teammates:"
            for tm in self.panel_teammates:
                prompt += f"\n- {tm.get('title', 'Teammate')} ({tm.get('expertise', '')})"
            prompt += (
                "\n\nDo NOT repeat points your teammates have already made this round. "
                "Build on their arguments or cover different angles."
            )

        prompt += f"""

You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.
Format:
{{
  "arguments": [
    {{
      "id": "{self.argument_prefix}1",
      "type": "claim|rebuttal|concession|concession_with_nuance",
      "targets": [],
      "claim": "Your main claim",
      "grounds": "Evidence and data supporting the claim",
      "warrant": "Reasoning connecting grounds to claim",
      "backing": "Additional support for the warrant",
      "qualifier": "Conditions or limitations on the claim",
      "confidence": 7
    }}
  ],
  "summary": "Brief summary of your position this round"
}}

The "confidence" field is required: an integer 0-10 reflecting how genuinely confident you are in each argument.
The "type" field can be "concession_with_nuance" when you concede an opposing point but add important caveats."""
        return prompt

    def _build_user_message(
        self,
        round_type: str,
        round_number: int,
        debate_history: list[dict],
        teammate_args_this_round: list[dict] | None = None,
    ) -> str:
        msg = f"Topic: {self.topic}\n"
        if self.context:
            msg += f"Context: {self.context}\n"
        msg += f"Round: {round_number} ({round_type})\n"

        if debate_history:
            msg += "\n--- Debate history ---\n"
            for entry in debate_history:
                side = entry.get("side", "?")
                agent_title = entry.get("title", "Agent")
                msg += f"\n[{side.upper()} — {agent_title}]"
                for arg in entry.get("arguments", []):
                    msg += f"\n  {arg.get('id', '?')}: {arg.get('claim', '')}"
                if entry.get("summary"):
                    msg += f"\n  Summary: {entry['summary']}"
            msg += "\n--- End history ---\n"

        if teammate_args_this_round:
            msg += "\n--- Your teammates' arguments this round ---\n"
            for tm_arg in teammate_args_this_round:
                agent_title = tm_arg.get("title", "Teammate")
                msg += f"\n[{agent_title}]"
                for arg in tm_arg.get("arguments", []):
                    msg += f"\n  {arg.get('id', '?')}: {arg.get('claim', '')}"
            msg += "\n--- End teammate args ---\n"

        msg += f"\nPresent your {round_type} arguments now."
        return msg

    async def generate_arguments(
        self,
        round_type: str,
        round_number: int,
        debate_history: list[dict],
        teammate_args_this_round: list[dict] | None = None,
    ) -> dict:
        system_prompt = self._build_system_prompt()
        user_message = self._build_user_message(
            round_type, round_number, debate_history, teammate_args_this_round
        )

        for attempt in range(2):
            try:
                response = await self.client.messages.create(
                    model=MODEL,
                    max_tokens=MAX_TOKENS,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_message}],
                )
                raw_text = response.content[0].text
                return self.parse_response(raw_text)
            except anthropic.APIError as e:
                if attempt == 0:
                    logger.warning("Claude API error on attempt 1, retrying: %s", e)
                    continue
                logger.error("Claude API error on attempt 2, raising: %s", e)
                raise

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
