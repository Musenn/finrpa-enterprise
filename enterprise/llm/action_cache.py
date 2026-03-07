"""Action result cache for LLM decision reuse.

Caches LLM decisions (which element to interact with, action plan) keyed
by a hash of the page's DOM structure (with dynamic content stripped) and
the navigation goal.  On cache hit the LLM call is skipped entirely.

Cache invalidation:
- TTL expiry (default 24 hours)
- Manual clear via admin API
- DOM structure hash mismatch (page changed)
"""

import hashlib
import json
import logging
import re
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)

# Default time-to-live for cached action decisions (seconds)
DEFAULT_CACHE_TTL = 86400  # 24 hours


# ── DOM hashing ──────────────────────────────────────────────

# Patterns considered "dynamic" – stripped before hashing
_DYNAMIC_PATTERNS = [
    re.compile(r'\bid="[^"]*\d{6,}[^"]*"'),          # IDs with long numbers
    re.compile(r'\bdata-reactid="[^"]*"'),             # React internal IDs
    re.compile(r'\bdata-testid="[^"]*"'),              # Test IDs
    re.compile(r'\bstyle="[^"]*"'),                    # Inline styles
    re.compile(r'\bclass="[^"]*"'),                    # Class names (order varies)
    re.compile(r"<!--[\s\S]*?-->"),                     # HTML comments
    re.compile(r"\s+"),                                 # Collapse whitespace
]


_COMMENT_PATTERN = re.compile(r"<!--[\s\S]*?-->")


def _strip_dynamic_content(dom_html: str) -> str:
    """Remove dynamic / non-structural content from DOM HTML."""
    # Remove HTML comments first (replace with nothing)
    text = _COMMENT_PATTERN.sub("", dom_html)
    # Remove dynamic attributes
    for pat in _DYNAMIC_PATTERNS:
        text = pat.sub(" ", text)
    # Normalize all whitespace to single spaces and strip
    return re.sub(r"\s+", " ", text).strip()


def compute_dom_hash(dom_html: str) -> str:
    """Compute a stable SHA-256 hash of the structural DOM."""
    stripped = _strip_dynamic_content(dom_html)
    return hashlib.sha256(stripped.encode("utf-8")).hexdigest()


def compute_goal_hash(navigation_goal: str) -> str:
    """MD5 hash of the navigation goal text."""
    return hashlib.md5(navigation_goal.encode("utf-8")).hexdigest()


def build_cache_key(org_id: str, dom_hash: str, goal_hash: str) -> str:
    """Construct the Redis cache key for an action decision."""
    return f"action_cache:{org_id}:{dom_hash}:{goal_hash}"


# ── In-memory cache store (replaced by Redis in production) ──

class ActionCacheStore:
    """In-memory action cache with TTL support.

    Production deployments should swap this with a Redis-backed
    implementation.  The interface is kept minimal on purpose.
    """

    def __init__(self) -> None:
        # key -> (value_dict, expires_at_timestamp)
        self._store: dict[str, tuple[dict[str, Any], float]] = {}
        # Statistics
        self._hits = 0
        self._misses = 0
        self._sets = 0

    # ── read / write ─────────────────────────────────────────

    def get(self, key: str) -> dict[str, Any] | None:
        """Return cached value or None on miss / expiry."""
        entry = self._store.get(key)
        if entry is None:
            self._misses += 1
            return None

        value, expires_at = entry
        if datetime.utcnow().timestamp() > expires_at:
            del self._store[key]
            self._misses += 1
            logger.debug("Cache expired: %s", key)
            return None

        self._hits += 1
        logger.info("Cache hit: %s", key)
        return value

    def set(
        self,
        key: str,
        value: dict[str, Any],
        ttl: int = DEFAULT_CACHE_TTL,
    ) -> None:
        """Store a value with TTL (seconds)."""
        expires_at = datetime.utcnow().timestamp() + ttl
        self._store[key] = (value, expires_at)
        self._sets += 1
        logger.info("Cache set: %s (ttl=%ds)", key, ttl)

    # ── management ───────────────────────────────────────────

    def delete(self, key: str) -> bool:
        """Delete a single cache entry.  Returns True if existed."""
        if key in self._store:
            del self._store[key]
            return True
        return False

    def clear_by_prefix(self, prefix: str) -> int:
        """Delete all entries whose key starts with *prefix*.

        Returns the number of deleted entries.
        """
        keys_to_delete = [k for k in self._store if k.startswith(prefix)]
        for k in keys_to_delete:
            del self._store[k]
        return len(keys_to_delete)

    def clear_expired(self) -> int:
        """Remove all expired entries.  Returns count removed."""
        now = datetime.utcnow().timestamp()
        expired_keys = [
            k for k, (_, exp) in self._store.items() if now > exp
        ]
        for k in expired_keys:
            del self._store[k]
        return len(expired_keys)

    def clear_all(self) -> int:
        """Remove every entry.  Returns count removed."""
        count = len(self._store)
        self._store.clear()
        return count

    # ── statistics ───────────────────────────────────────────

    @property
    def stats(self) -> dict[str, Any]:
        """Return cache statistics."""
        total = self._hits + self._misses
        hit_rate = round(self._hits / total * 100, 1) if total > 0 else 0.0
        return {
            "total_entries": len(self._store),
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": hit_rate,
            "sets": self._sets,
        }

    def reset_stats(self) -> None:
        """Reset hit/miss counters."""
        self._hits = 0
        self._misses = 0
        self._sets = 0


# ── High-level helpers ───────────────────────────────────────

# Module-level singleton (can be replaced via configure_cache_store)
_cache_store = ActionCacheStore()


def get_cache_store() -> ActionCacheStore:
    """Return the module-level cache store singleton."""
    return _cache_store


def configure_cache_store(store: ActionCacheStore) -> None:
    """Replace the module-level cache store (for testing)."""
    global _cache_store
    _cache_store = store


def cache_action_decision(
    org_id: str,
    dom_html: str,
    navigation_goal: str,
    decision: dict[str, Any],
    ttl: int = DEFAULT_CACHE_TTL,
) -> str:
    """Cache an LLM action decision.  Returns the cache key."""
    dom_hash = compute_dom_hash(dom_html)
    goal_hash = compute_goal_hash(navigation_goal)
    key = build_cache_key(org_id, dom_hash, goal_hash)
    _cache_store.set(key, decision, ttl)
    return key


def lookup_cached_decision(
    org_id: str,
    dom_html: str,
    navigation_goal: str,
) -> dict[str, Any] | None:
    """Look up a cached action decision.  Returns None on miss."""
    dom_hash = compute_dom_hash(dom_html)
    goal_hash = compute_goal_hash(navigation_goal)
    key = build_cache_key(org_id, dom_hash, goal_hash)
    return _cache_store.get(key)
