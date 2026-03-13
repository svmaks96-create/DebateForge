import hashlib
import json
import logging
from urllib.parse import urlparse

import redis.asyncio as aioredis
from tavily import AsyncTavilyClient

from config import settings

logger = logging.getLogger(__name__)

CACHE_TTL = 3600  # 1 hour

ACADEMIC_DOMAINS = {
    "scholar.google.com", "arxiv.org", "pubmed.ncbi.nlm.nih.gov",
    "jstor.org", "sciencedirect.com", "springer.com", "nature.com",
    "ieee.org", "acm.org", "researchgate.net", "ssrn.com",
}

NEWS_DOMAINS = {
    "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "nytimes.com",
    "washingtonpost.com", "theguardian.com", "bloomberg.com", "cnbc.com",
    "wsj.com", "ft.com", "economist.com", "forbes.com", "cnn.com",
    "aljazeera.com", "npr.org", "politico.com", "axios.com",
}


def _infer_source_type(url: str) -> str:
    try:
        domain = urlparse(url).hostname or ""
        domain = domain.removeprefix("www.")
    except Exception:
        return "web"

    if domain.endswith(".gov") or domain.endswith(".gov.uk"):
        return "government"
    if domain.endswith(".edu") or domain in ACADEMIC_DOMAINS:
        return "academic"
    if domain in NEWS_DOMAINS:
        return "news"
    # Company/org blogs
    if any(domain.endswith(s) for s in (".medium.com", ".substack.com")):
        return "blog"
    return "web"


def _cache_key(query: str) -> str:
    return f"search:{hashlib.md5(query.encode()).hexdigest()}"


async def web_search(query: str, max_results: int = 5) -> list[dict]:
    if not settings.TAVILY_API_KEY:
        logger.warning("TAVILY_API_KEY not set — skipping web search")
        return []

    redis = aioredis.from_url(settings.REDIS_URL)
    try:
        # Check cache
        cached = await redis.get(_cache_key(query))
        if cached:
            logger.info(f"Search cache hit: {query[:60]}")
            return json.loads(cached)

        # Search
        client = AsyncTavilyClient(api_key=settings.TAVILY_API_KEY)
        response = await client.search(
            query=query,
            max_results=max_results,
            include_answer=False,
        )

        results = []
        for item in response.get("results", []):
            results.append({
                "url": item.get("url", ""),
                "title": item.get("title", ""),
                "snippet": item.get("content", "")[:500],
                "date": item.get("published_date"),
                "source_type": _infer_source_type(item.get("url", "")),
            })

        # Cache
        await redis.set(_cache_key(query), json.dumps(results), ex=CACHE_TTL)
        logger.info(f"Search completed: {query[:60]} → {len(results)} results")
        return results

    except Exception as e:
        logger.warning(f"Web search failed for '{query[:60]}': {e}")
        return []
    finally:
        await redis.aclose()
