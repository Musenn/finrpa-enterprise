"""Redis cache layer for dashboard statistics.

Ensures tenant isolation in cache keys and provides TTL management.
Cache keys follow the pattern: dashboard:{org_id}:{metric}:{params_hash}
"""

import hashlib
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_TTL = 60  # seconds
CACHE_PREFIX = "dashboard"


def _build_cache_key(org_id: str, metric: str, params: dict | None = None) -> str:
    """Build a tenant-isolated cache key."""
    parts = [CACHE_PREFIX, org_id, metric]
    if params:
        # Sort keys for deterministic hashing
        param_str = json.dumps(params, sort_keys=True)
        param_hash = hashlib.md5(param_str.encode()).hexdigest()[:8]
        parts.append(param_hash)
    return ":".join(parts)


async def get_cached(
    redis_client,
    org_id: str,
    metric: str,
    params: dict | None = None,
) -> Any | None:
    """Get cached statistics result.

    Returns parsed JSON data if cache hit, None if miss.
    """
    key = _build_cache_key(org_id, metric, params)
    try:
        data = await redis_client.get(key)
        if data is not None:
            logger.debug("Cache HIT: %s", key)
            return json.loads(data)
        logger.debug("Cache MISS: %s", key)
        return None
    except Exception as e:
        logger.warning("Cache read error for %s: %s", key, e)
        return None


async def set_cached(
    redis_client,
    org_id: str,
    metric: str,
    data: Any,
    params: dict | None = None,
    ttl: int = DEFAULT_TTL,
):
    """Store statistics result in cache."""
    key = _build_cache_key(org_id, metric, params)
    try:
        await redis_client.set(key, json.dumps(data), ex=ttl)
        logger.debug("Cache SET: %s (TTL=%ds)", key, ttl)
    except Exception as e:
        logger.warning("Cache write error for %s: %s", key, e)
