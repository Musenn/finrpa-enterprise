"""Dashboard statistics API routes.

All endpoints require at least operator role. Statistics are filtered
by the user's org_id and cached in Redis with tenant-isolated keys.
"""

import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from enterprise.auth.dependencies import CurrentUser, require_any_operator, require_admin
from enterprise.auth.schemas import UserContext

from .cache import get_cached, set_cached
from .stats import (
    compute_overview,
    compute_trend,
    compute_error_distribution,
    compute_business_line_comparison,
    compute_approval_response_time,
    compute_cost_estimation,
)

router = APIRouter(prefix="/enterprise/dashboard", tags=["dashboard"])


# --- Data stores (in-memory for testing, production uses DB) ---

_task_store: list[dict] = []
_approval_store: list[dict] = []
_model_call_store: list[dict] = []
_redis_client = None


def configure_stores(
    tasks: list[dict],
    approvals: list[dict],
    model_calls: list[dict],
    redis=None,
):
    global _task_store, _approval_store, _model_call_store, _redis_client
    _task_store = tasks
    _approval_store = approvals
    _model_call_store = model_calls
    _redis_client = redis


# --- Response schemas ---

class OverviewResponse(BaseModel):
    success_rate_today: float
    success_rate_7d: float
    success_rate_30d: float
    avg_duration_ms: int
    pending_approvals: int
    needs_human_count: int
    status_distribution: dict[str, int]
    total_tasks: int


class TrendItem(BaseModel):
    date: str
    success: int
    failed: int
    total: int


class BLComparisonItem(BaseModel):
    business_line_id: str
    total_tasks: int
    completed: int
    success_rate: float


class ApprovalTimeItem(BaseModel):
    hour: int
    avg_minutes: float
    count: int


class CostBreakdownItem(BaseModel):
    model_tier: str
    total_calls: int
    cached_calls: int
    cache_hit_rate: float
    total_tokens: int
    estimated_cost_usd: float
    estimated_saved_usd: float


class CostResponse(BaseModel):
    total_cost_usd: float
    total_saved_usd: float
    breakdown: list[CostBreakdownItem]


# --- Routes ---

@router.get("/overview", response_model=OverviewResponse)
async def get_overview(
    user: UserContext = Depends(require_any_operator),
):
    """Get dashboard overview metrics."""
    if _redis_client:
        cached = await get_cached(_redis_client, user.org_id, "overview")
        if cached:
            return OverviewResponse(**cached)

    result = compute_overview(_task_store, _approval_store, user.org_id)

    if _redis_client:
        await set_cached(_redis_client, user.org_id, "overview", result)

    return OverviewResponse(**result)


@router.get("/trend", response_model=list[TrendItem])
async def get_trend(
    user: UserContext = Depends(require_any_operator),
    days: int = Query(7, ge=1, le=90),
):
    """Get daily success/failure trend."""
    params = {"days": days}
    if _redis_client:
        cached = await get_cached(_redis_client, user.org_id, "trend", params)
        if cached:
            return [TrendItem(**item) for item in cached]

    result = compute_trend(_task_store, user.org_id, days)

    if _redis_client:
        await set_cached(_redis_client, user.org_id, "trend", result, params)

    return [TrendItem(**item) for item in result]


@router.get("/errors", response_model=dict[str, int])
async def get_error_distribution(
    user: UserContext = Depends(require_any_operator),
):
    """Get error type distribution."""
    if _redis_client:
        cached = await get_cached(_redis_client, user.org_id, "errors")
        if cached:
            return cached

    result = compute_error_distribution(_task_store, user.org_id)

    if _redis_client:
        await set_cached(_redis_client, user.org_id, "errors", result)

    return result


@router.get("/business-lines", response_model=list[BLComparisonItem])
async def get_business_line_comparison(
    user: UserContext = Depends(require_any_operator),
):
    """Get task volume and success rate by business line."""
    if _redis_client:
        cached = await get_cached(_redis_client, user.org_id, "business_lines")
        if cached:
            return [BLComparisonItem(**item) for item in cached]

    result = compute_business_line_comparison(_task_store, user.org_id)

    if _redis_client:
        await set_cached(_redis_client, user.org_id, "business_lines", result)

    return [BLComparisonItem(**item) for item in result]


@router.get("/approval-time", response_model=list[ApprovalTimeItem])
async def get_approval_response_time(
    user: UserContext = Depends(require_any_operator),
):
    """Get approval response time distribution by hour."""
    if _redis_client:
        cached = await get_cached(_redis_client, user.org_id, "approval_time")
        if cached:
            return [ApprovalTimeItem(**item) for item in cached]

    result = compute_approval_response_time(_approval_store, user.org_id)

    if _redis_client:
        await set_cached(_redis_client, user.org_id, "approval_time", result)

    return [ApprovalTimeItem(**item) for item in result]


@router.get("/cost", response_model=CostResponse)
async def get_cost_estimation(
    user: UserContext = Depends(require_any_operator),
):
    """Get LLM cost estimation by model tier."""
    if _redis_client:
        cached = await get_cached(_redis_client, user.org_id, "cost")
        if cached:
            return CostResponse(**cached)

    result = compute_cost_estimation(_model_call_store, user.org_id)

    if _redis_client:
        await set_cached(_redis_client, user.org_id, "cost", result)

    return CostResponse(**result)


@router.get("/export")
async def export_statistics_csv(
    user: UserContext = Depends(require_admin),
):
    """Export dashboard statistics as CSV. Requires admin role."""
    overview = compute_overview(_task_store, _approval_store, user.org_id)
    trend = compute_trend(_task_store, user.org_id, days=30)

    output = io.StringIO()
    writer = csv.writer(output)

    # Overview section
    writer.writerow(["=== Overview ==="])
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Success Rate (Today)", f"{overview['success_rate_today']}%"])
    writer.writerow(["Success Rate (7d)", f"{overview['success_rate_7d']}%"])
    writer.writerow(["Success Rate (30d)", f"{overview['success_rate_30d']}%"])
    writer.writerow(["Avg Duration (ms)", overview["avg_duration_ms"]])
    writer.writerow(["Pending Approvals", overview["pending_approvals"]])
    writer.writerow(["Needs Human", overview["needs_human_count"]])
    writer.writerow(["Total Tasks", overview["total_tasks"]])
    writer.writerow([])

    # Trend section
    writer.writerow(["=== Daily Trend (30d) ==="])
    writer.writerow(["Date", "Success", "Failed", "Total"])
    for item in trend:
        writer.writerow([item["date"], item["success"], item["failed"], item["total"]])

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=dashboard_{user.org_id}_{datetime.utcnow().strftime('%Y%m%d')}.csv"
        },
    )
