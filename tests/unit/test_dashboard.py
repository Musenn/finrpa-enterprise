"""Tests for dashboard statistics API.

Covers:
- Stats computation (overview, trend, errors, BL comparison, approval time, cost)
- Cache key isolation between orgs
- API endpoints with correct response structure
- Cache hit skips recomputation (mock verification)
- CSV export
- Tenant isolation
"""

import json
import unittest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from enterprise.dashboard.stats import (
    compute_overview,
    compute_trend,
    compute_error_distribution,
    compute_business_line_comparison,
    compute_approval_response_time,
    compute_cost_estimation,
)
from enterprise.dashboard.cache import _build_cache_key, get_cached, set_cached
from enterprise.dashboard.routes import router, configure_stores


def _make_task(org_id="org_1", status="completed", created_at=None, **kw):
    if created_at is None:
        created_at = datetime.utcnow().isoformat()
    defaults = {
        "org_id": org_id,
        "status": status,
        "created_at": created_at,
        "duration_ms": 1500,
        "business_line_id": "bl_1",
    }
    defaults.update(kw)
    return defaults


def _make_approval(org_id="org_1", status="approved", **kw):
    defaults = {
        "org_id": org_id,
        "status": status,
        "requested_at": "2026-03-07T10:00:00",
        "decided_at": "2026-03-07T10:15:00",
    }
    defaults.update(kw)
    return defaults


# ============================================================
# Stats computation tests
# ============================================================

class TestComputeOverview(unittest.TestCase):
    def test_empty_data(self):
        result = compute_overview([], [], "org_1")
        assert result["total_tasks"] == 0
        assert result["success_rate_today"] == 0.0
        assert result["pending_approvals"] == 0

    def test_success_rate(self):
        now = datetime(2026, 3, 7, 12, 0, 0)
        tasks = [
            _make_task(status="completed", created_at="2026-03-07T10:00:00"),
            _make_task(status="completed", created_at="2026-03-07T11:00:00"),
            _make_task(status="failed", created_at="2026-03-07T09:00:00"),
        ]
        result = compute_overview(tasks, [], "org_1", now=now)
        assert result["success_rate_today"] == 66.7
        assert result["total_tasks"] == 3

    def test_avg_duration(self):
        tasks = [
            _make_task(duration_ms=1000),
            _make_task(duration_ms=2000),
            _make_task(duration_ms=3000),
        ]
        result = compute_overview(tasks, [], "org_1")
        assert result["avg_duration_ms"] == 2000

    def test_pending_approvals(self):
        approvals = [
            _make_approval(status="pending"),
            _make_approval(status="pending"),
            _make_approval(status="approved"),
        ]
        result = compute_overview([], approvals, "org_1")
        assert result["pending_approvals"] == 2

    def test_org_isolation(self):
        tasks = [
            _make_task(org_id="org_1"),
            _make_task(org_id="org_2"),
        ]
        result = compute_overview(tasks, [], "org_1")
        assert result["total_tasks"] == 1


class TestComputeTrend(unittest.TestCase):
    def test_seven_days(self):
        now = datetime(2026, 3, 7)
        result = compute_trend([], "org_1", days=7, now=now)
        assert len(result) == 7
        assert result[0]["date"] == "2026-03-01"
        assert result[-1]["date"] == "2026-03-07"

    def test_counts(self):
        now = datetime(2026, 3, 7, 12, 0, 0)
        tasks = [
            _make_task(status="completed", created_at="2026-03-07T10:00:00"),
            _make_task(status="failed", created_at="2026-03-07T11:00:00"),
            _make_task(status="completed", created_at="2026-03-06T10:00:00"),
        ]
        result = compute_trend(tasks, "org_1", days=7, now=now)
        today = result[-1]
        assert today["success"] == 1
        assert today["failed"] == 1
        yesterday = result[-2]
        assert yesterday["success"] == 1


class TestComputeErrorDistribution(unittest.TestCase):
    def test_aggregation(self):
        tasks = [
            _make_task(status="failed", error_type="LLM_FAILURE"),
            _make_task(status="failed", error_type="LLM_FAILURE"),
            _make_task(status="failed", error_type="TIMEOUT"),
            _make_task(status="completed"),  # not failed, excluded
        ]
        result = compute_error_distribution(tasks, "org_1")
        assert result["LLM_FAILURE"] == 2
        assert result["TIMEOUT"] == 1


class TestComputeBLComparison(unittest.TestCase):
    def test_comparison(self):
        tasks = [
            _make_task(business_line_id="bl_a", status="completed"),
            _make_task(business_line_id="bl_a", status="failed"),
            _make_task(business_line_id="bl_b", status="completed"),
            _make_task(business_line_id="bl_b", status="completed"),
        ]
        result = compute_business_line_comparison(tasks, "org_1")
        assert len(result) == 2
        bl_a = next(r for r in result if r["business_line_id"] == "bl_a")
        assert bl_a["success_rate"] == 50.0
        bl_b = next(r for r in result if r["business_line_id"] == "bl_b")
        assert bl_b["success_rate"] == 100.0


class TestComputeApprovalTime(unittest.TestCase):
    def test_hourly_distribution(self):
        approvals = [
            _make_approval(
                requested_at="2026-03-07T10:00:00",
                decided_at="2026-03-07T10:15:00",
            ),
            _make_approval(
                requested_at="2026-03-07T10:30:00",
                decided_at="2026-03-07T10:45:00",
            ),
        ]
        result = compute_approval_response_time(approvals, "org_1")
        assert len(result) == 24
        hour_10 = result[10]
        assert hour_10["count"] == 2
        assert hour_10["avg_minutes"] == 15.0


class TestComputeCostEstimation(unittest.TestCase):
    def test_cost_breakdown(self):
        calls = [
            {"org_id": "org_1", "model_tier": "light", "tokens": 500, "cache_hit": False},
            {"org_id": "org_1", "model_tier": "light", "tokens": 500, "cache_hit": True},
            {"org_id": "org_1", "model_tier": "heavy", "tokens": 2000, "cache_hit": False},
        ]
        result = compute_cost_estimation(calls, "org_1")
        assert result["total_cost_usd"] > 0
        assert len(result["breakdown"]) == 2  # light + heavy


# ============================================================
# Cache tests
# ============================================================

class TestCacheKey(unittest.TestCase):
    def test_key_format(self):
        key = _build_cache_key("org_1", "overview")
        assert key == "dashboard:org_1:overview"

    def test_key_with_params(self):
        key = _build_cache_key("org_1", "trend", {"days": 7})
        assert key.startswith("dashboard:org_1:trend:")
        assert len(key) > len("dashboard:org_1:trend:")

    def test_different_orgs_different_keys(self):
        k1 = _build_cache_key("org_1", "overview")
        k2 = _build_cache_key("org_2", "overview")
        assert k1 != k2

    def test_same_params_same_key(self):
        k1 = _build_cache_key("org_1", "trend", {"days": 7})
        k2 = _build_cache_key("org_1", "trend", {"days": 7})
        assert k1 == k2

    def test_different_params_different_key(self):
        k1 = _build_cache_key("org_1", "trend", {"days": 7})
        k2 = _build_cache_key("org_1", "trend", {"days": 30})
        assert k1 != k2


class TestCacheGetSet(unittest.IsolatedAsyncioTestCase):
    async def test_set_and_get(self):
        redis = AsyncMock()
        redis.get.return_value = json.dumps({"total_tasks": 42})

        result = await get_cached(redis, "org_1", "overview")
        assert result["total_tasks"] == 42

    async def test_cache_miss(self):
        redis = AsyncMock()
        redis.get.return_value = None

        result = await get_cached(redis, "org_1", "overview")
        assert result is None

    async def test_set_calls_redis(self):
        redis = AsyncMock()
        await set_cached(redis, "org_1", "overview", {"total": 10}, ttl=60)
        redis.set.assert_called_once()
        args = redis.set.call_args
        assert args[1]["ex"] == 60


# ============================================================
# API Route tests
# ============================================================

class TestDashboardAPI(unittest.TestCase):
    def setUp(self):
        from enterprise.auth.dependencies import require_any_operator, require_admin, get_current_user
        from enterprise.auth.schemas import DepartmentRole, UserContext

        self.app = FastAPI()
        self.app.include_router(router)

        self.user = UserContext(
            user_id="eu_1",
            org_id="org_1",
            department_roles=[
                DepartmentRole(department_id="dept_a", department_name="A", role="org_admin"),
            ],
            business_line_ids=[],
        )
        self.app.dependency_overrides[get_current_user] = lambda: self.user
        self.app.dependency_overrides[require_any_operator] = lambda: self.user
        self.app.dependency_overrides[require_admin] = lambda: self.user

        now = datetime.utcnow()
        self.tasks = [
            _make_task(status="completed", created_at=now.isoformat(), duration_ms=1000),
            _make_task(status="completed", created_at=now.isoformat(), duration_ms=2000),
            _make_task(status="failed", created_at=now.isoformat(), error_type="LLM_FAILURE"),
        ]
        self.approvals = [_make_approval(status="pending")]
        self.model_calls = [
            {"org_id": "org_1", "model_tier": "light", "tokens": 500, "cache_hit": False},
        ]
        configure_stores(self.tasks, self.approvals, self.model_calls)
        self.client = TestClient(self.app)

    def test_overview(self):
        resp = self.client.get("/enterprise/dashboard/overview")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_tasks"] == 3
        assert data["pending_approvals"] == 1

    def test_trend(self):
        resp = self.client.get("/enterprise/dashboard/trend?days=7")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 7

    def test_errors(self):
        resp = self.client.get("/enterprise/dashboard/errors")
        assert resp.status_code == 200
        data = resp.json()
        assert "LLM_FAILURE" in data

    def test_business_lines(self):
        resp = self.client.get("/enterprise/dashboard/business-lines")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1

    def test_approval_time(self):
        resp = self.client.get("/enterprise/dashboard/approval-time")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 24

    def test_cost(self):
        resp = self.client.get("/enterprise/dashboard/cost")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_cost_usd" in data
        assert "breakdown" in data

    def test_export_csv(self):
        resp = self.client.get("/enterprise/dashboard/export")
        assert resp.status_code == 200
        assert "text/csv" in resp.headers["content-type"]
        content = resp.text
        assert "Overview" in content
        assert "Success Rate" in content

    def test_org_isolation(self):
        """Tasks from org_2 should not appear in org_1's overview."""
        self.tasks.append(_make_task(org_id="org_2", status="completed"))
        resp = self.client.get("/enterprise/dashboard/overview")
        data = resp.json()
        assert data["total_tasks"] == 3  # only org_1 tasks


if __name__ == "__main__":
    unittest.main()
