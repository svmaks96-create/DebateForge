import asyncio
import json
import logging
from uuid import UUID

import redis.asyncio as redis

from config import settings

logger = logging.getLogger("uvicorn.error")

_redis: redis.Redis | None = None


async def get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


class EventBus:
    """Wraps Redis pub/sub for SSE streaming of debate events."""

    def __init__(self, redis_client: redis.Redis):
        self._redis = redis_client

    @staticmethod
    def _channel(debate_id: UUID | str) -> str:
        return f"debate:{debate_id}:events"

    @staticmethod
    def _format_sse(event_type: str, data: dict) -> str:
        return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"

    async def publish(self, debate_id: UUID | str, event_type: str, data: dict) -> None:
        payload = json.dumps({"type": event_type, **data})
        channel = self._channel(debate_id)
        await self._redis.publish(channel, payload)
        logger.info("SSE publish [%s] %s", channel, event_type)

    async def subscribe(self, debate_id: UUID | str):
        """Async generator that yields SSE-formatted strings from the Redis channel."""
        pubsub = self._redis.pubsub()
        channel = self._channel(debate_id)
        await pubsub.subscribe(channel)
        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    payload = json.loads(message["data"])
                    event_type = payload.pop("type", "message")
                    yield self._format_sse(event_type, payload)
                except (json.JSONDecodeError, KeyError):
                    yield self._format_sse("message", {"raw": message["data"]})
        except asyncio.CancelledError:
            logger.info("SSE subscriber disconnected from %s", channel)
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()


async def get_event_bus() -> EventBus:
    r = await get_redis()
    return EventBus(r)


# Convenience function used by debate_engine and judge
async def publish_event(debate_id: str, event_type: str, data: dict) -> None:
    bus = await get_event_bus()
    await bus.publish(debate_id, event_type, data)
