"""Dashboard statistics computation.

Computes all operational metrics from in-memory stores (will be
replaced by DB queries in production). Each function accepts a
data source and filter parameters, returning structured results.
"""

from collections import Counter, defaultdict
from datetime import datetime, timedelta


def compute_overview(
    tasks: list[dict],
    approvals: list[dict],
    org_id: str,
    now: datetime | None = None,
) -> dict:
    """Compute overview metrics: success rates, avg duration, pending counts."""
    if now is None:
        now = datetime.utcnow()

    org_tasks = [t for t in tasks if t.get("org_id") == org_id]

    def success_rate(task_list):
        if not task_list:
            return 0.0
        completed = sum(1 for t in task_list if t.get("status") == "completed")
        return round(completed / len(task_list) * 100, 1)

    def tasks_in_range(days):
        cutoff = (now - timedelta(days=days)).isoformat()
        return [t for t in org_tasks if t.get("created_at", "") >= cutoff]

    today_tasks = tasks_in_range(1)
    week_tasks = tasks_in_range(7)
    month_tasks = tasks_in_range(30)

    # Average execution duration (ms)
    durations = [t["duration_ms"] for t in org_tasks if t.get("duration_ms")]
    avg_duration = round(sum(durations) / len(durations)) if durations else 0

    # Status distribution
    status_counts = Counter(t.get("status", "unknown") for t in org_tasks)

    # Pending approvals and NEEDS_HUMAN
    org_approvals = [a for a in approvals if a.get("org_id") == org_id]
    pending_approvals = sum(1 for a in org_approvals if a.get("status") == "pending")
    needs_human = status_counts.get("needs_human", 0)

    return {
        "success_rate_today": success_rate(today_tasks),
        "success_rate_7d": success_rate(week_tasks),
        "success_rate_30d": success_rate(month_tasks),
        "avg_duration_ms": avg_duration,
        "pending_approvals": pending_approvals,
        "needs_human_count": needs_human,
        "status_distribution": dict(status_counts),
        "total_tasks": len(org_tasks),
    }


def compute_trend(
    tasks: list[dict],
    org_id: str,
    days: int = 7,
    now: datetime | None = None,
) -> list[dict]:
    """Compute daily success/failure trend for the given time range."""
    if now is None:
        now = datetime.utcnow()

    org_tasks = [t for t in tasks if t.get("org_id") == org_id]
    result = []

    for offset in range(days - 1, -1, -1):
        day = now - timedelta(days=offset)
        day_str = day.strftime("%Y-%m-%d")
        day_tasks = [
            t for t in org_tasks
            if t.get("created_at", "")[:10] == day_str
        ]
        success = sum(1 for t in day_tasks if t.get("status") == "completed")
        failed = sum(1 for t in day_tasks if t.get("status") == "failed")

        result.append({
            "date": day_str,
            "success": success,
            "failed": failed,
            "total": len(day_tasks),
        })

    return result


def compute_error_distribution(
    tasks: list[dict],
    org_id: str,
) -> dict[str, int]:
    """Aggregate errors by type."""
    org_tasks = [t for t in tasks if t.get("org_id") == org_id and t.get("status") == "failed"]
    error_counts = Counter(t.get("error_type", "UNKNOWN") for t in org_tasks)
    return dict(error_counts)


def compute_business_line_comparison(
    tasks: list[dict],
    org_id: str,
) -> list[dict]:
    """Compare task volume and success rate across business lines."""
    org_tasks = [t for t in tasks if t.get("org_id") == org_id]
    bl_groups: dict[str, list] = defaultdict(list)

    for t in org_tasks:
        bl = t.get("business_line_id", "unassigned")
        bl_groups[bl].append(t)

    result = []
    for bl_id, bl_tasks in sorted(bl_groups.items()):
        total = len(bl_tasks)
        completed = sum(1 for t in bl_tasks if t.get("status") == "completed")
        rate = round(completed / total * 100, 1) if total > 0 else 0.0
        result.append({
            "business_line_id": bl_id,
            "total_tasks": total,
            "completed": completed,
            "success_rate": rate,
        })

    return result


def compute_approval_response_time(
    approvals: list[dict],
    org_id: str,
) -> list[dict]:
    """Compute approval response time distribution by hour of day."""
    org_approvals = [
        a for a in approvals
        if a.get("org_id") == org_id and a.get("decided_at")
    ]

    hourly: dict[int, list[float]] = defaultdict(list)
    for a in org_approvals:
        try:
            requested = datetime.fromisoformat(a["requested_at"])
            decided = datetime.fromisoformat(a["decided_at"])
            duration_min = (decided - requested).total_seconds() / 60
            hour = requested.hour
            hourly[hour].append(duration_min)
        except (ValueError, KeyError):
            continue

    result = []
    for hour in range(24):
        times = hourly.get(hour, [])
        result.append({
            "hour": hour,
            "avg_minutes": round(sum(times) / len(times), 1) if times else 0,
            "count": len(times),
        })

    return result


def compute_cost_estimation(
    model_calls: list[dict],
    org_id: str,
) -> dict:
    """Estimate LLM costs by model tier and cache hit rate."""
    org_calls = [c for c in model_calls if c.get("org_id") == org_id]

    # Price per 1K tokens (approximate)
    PRICE_PER_1K = {
        "light": 0.001,
        "standard": 0.01,
        "heavy": 0.05,
    }

    tier_stats: dict[str, dict] = defaultdict(lambda: {"calls": 0, "cached": 0, "tokens": 0})
    for call in org_calls:
        tier = call.get("model_tier", "standard")
        tier_stats[tier]["calls"] += 1
        tier_stats[tier]["tokens"] += call.get("tokens", 0)
        if call.get("cache_hit"):
            tier_stats[tier]["cached"] += 1

    total_cost = 0.0
    saved_cost = 0.0
    breakdown = []

    for tier, stats in sorted(tier_stats.items()):
        price = PRICE_PER_1K.get(tier, 0.01)
        cost = stats["tokens"] / 1000 * price
        cache_rate = round(stats["cached"] / stats["calls"] * 100, 1) if stats["calls"] else 0
        saved = stats["cached"] * (stats["tokens"] / max(stats["calls"], 1)) / 1000 * price
        total_cost += cost
        saved_cost += saved

        breakdown.append({
            "model_tier": tier,
            "total_calls": stats["calls"],
            "cached_calls": stats["cached"],
            "cache_hit_rate": cache_rate,
            "total_tokens": stats["tokens"],
            "estimated_cost_usd": round(cost, 4),
            "estimated_saved_usd": round(saved, 4),
        })

    return {
        "total_cost_usd": round(total_cost, 4),
        "total_saved_usd": round(saved_cost, 4),
        "breakdown": breakdown,
    }
