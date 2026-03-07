"""Tests for Redis Pub/Sub approval wait mechanism."""

import asyncio
import json
import unittest

from enterprise.approval.pubsub import (
    ApprovalDecision,
    _channel_name,
    build_approval_request,
    wait_for_decision,
    publish_decision,
)
from enterprise.approval.routing import ApprovalRoute
from enterprise.approval.models import ApprovalStatus, DEFAULT_TIMEOUTS


class TestChannelName(unittest.TestCase):
    """Test channel naming."""

    def test_channel_prefix(self):
        assert _channel_name("apr_123") == "approval:apr_123"

    def test_channel_uniqueness(self):
        assert _channel_name("apr_a") != _channel_name("apr_b")


class TestApprovalDecision(unittest.TestCase):
    """Test ApprovalDecision serialization."""

    def test_to_json(self):
        d = ApprovalDecision(
            approval_id="apr_1",
            status="approved",
            approver_user_id="eu_1",
            decision_note="LGTM",
        )
        data = json.loads(d.to_json())
        assert data["approval_id"] == "apr_1"
        assert data["status"] == "approved"
        assert data["approver_user_id"] == "eu_1"
        assert data["decision_note"] == "LGTM"

    def test_from_json_roundtrip(self):
        original = ApprovalDecision(
            approval_id="apr_2",
            status="rejected",
            approver_user_id="eu_2",
            decision_note="Risk too high",
        )
        restored = ApprovalDecision.from_json(original.to_json())
        assert restored.approval_id == original.approval_id
        assert restored.status == original.status
        assert restored.approver_user_id == original.approver_user_id
        assert restored.decision_note == original.decision_note

    def test_default_note_empty(self):
        d = ApprovalDecision(
            approval_id="apr_3",
            status="approved",
            approver_user_id="eu_3",
        )
        assert d.decision_note == ""

    def test_from_json_minimal(self):
        data = json.dumps({
            "approval_id": "apr_4",
            "status": "approved",
            "approver_user_id": "eu_4",
            "decision_note": "",
        })
        d = ApprovalDecision.from_json(data)
        assert d.approval_id == "apr_4"


class TestBuildApprovalRequest(unittest.TestCase):
    """Test building approval request objects."""

    def _make_route(self, **kwargs):
        defaults = {
            "requires_approval": True,
            "approver_department_id": "dept_a",
            "approver_role": "approver",
            "notify_department_ids": [],
        }
        defaults.update(kwargs)
        return ApprovalRoute(**defaults)

    def test_basic_fields(self):
        route = self._make_route()
        req = build_approval_request(
            task_id="task_1",
            org_id="org_1",
            department_id="dept_src",
            risk_level="high",
            risk_reason="Contains wire transfer",
            route=route,
        )
        assert req.task_id == "task_1"
        assert req.organization_id == "org_1"
        assert req.department_id == "dept_src"
        assert req.risk_level == "high"
        assert req.risk_reason == "Contains wire transfer"
        assert req.approver_department_id == "dept_a"
        assert req.approver_role == "approver"
        assert req.status == ApprovalStatus.PENDING.value

    def test_default_timeout_high(self):
        route = self._make_route()
        req = build_approval_request(
            task_id="t", org_id="o", department_id="d",
            risk_level="high", risk_reason="r", route=route,
        )
        assert req.timeout_seconds == DEFAULT_TIMEOUTS["high"]

    def test_default_timeout_critical(self):
        route = self._make_route()
        req = build_approval_request(
            task_id="t", org_id="o", department_id="d",
            risk_level="critical", risk_reason="r", route=route,
        )
        assert req.timeout_seconds == DEFAULT_TIMEOUTS["critical"]

    def test_timeout_override(self):
        route = self._make_route()
        req = build_approval_request(
            task_id="t", org_id="o", department_id="d",
            risk_level="high", risk_reason="r", route=route,
            timeout_override=120,
        )
        assert req.timeout_seconds == 120

    def test_notify_departments_serialized(self):
        route = self._make_route(notify_department_ids=["dept_risk", "dept_audit"])
        req = build_approval_request(
            task_id="t", org_id="o", department_id="d",
            risk_level="critical", risk_reason="r", route=route,
        )
        assert req.notify_department_ids == "dept_risk,dept_audit"

    def test_no_notify_departments(self):
        route = self._make_route(notify_department_ids=[])
        req = build_approval_request(
            task_id="t", org_id="o", department_id="d",
            risk_level="high", risk_reason="r", route=route,
        )
        assert req.notify_department_ids is None

    def test_optional_fields(self):
        route = self._make_route()
        req = build_approval_request(
            task_id="t", org_id="o", department_id="d",
            risk_level="high", risk_reason="r", route=route,
            business_line_id="bl_1",
            operation_description="Wire transfer 500万",
            screenshot_path="/screenshots/task_1.png",
        )
        assert req.business_line_id == "bl_1"
        assert req.operation_description == "Wire transfer 500万"
        assert req.screenshot_path == "/screenshots/task_1.png"

    def test_approval_id_generated(self):
        route = self._make_route()
        req = build_approval_request(
            task_id="t", org_id="o", department_id="d",
            risk_level="high", risk_reason="r", route=route,
        )
        assert req.approval_id.startswith("apr_")


class FakeRedis:
    """Minimal fake Redis client for Pub/Sub testing."""

    def __init__(self):
        self._channels: dict[str, asyncio.Queue] = {}
        self._publish_log: list[tuple[str, str]] = []

    async def publish(self, channel: str, message: str) -> int:
        self._publish_log.append((channel, message))
        if channel in self._channels:
            await self._channels[channel].put(message)
            return 1
        return 0

    def pubsub(self):
        return FakePubSub(self)


class FakePubSub:
    """Minimal fake Pub/Sub for testing."""

    def __init__(self, redis: FakeRedis):
        self._redis = redis
        self._channel: str | None = None
        self._queue: asyncio.Queue | None = None

    async def subscribe(self, channel: str):
        self._channel = channel
        self._queue = asyncio.Queue()
        self._redis._channels[channel] = self._queue

    async def unsubscribe(self, channel: str):
        if channel in self._redis._channels:
            del self._redis._channels[channel]

    async def close(self):
        pass

    async def get_message(self, ignore_subscribe_messages=True, timeout=1.0):
        if self._queue is None:
            return None
        try:
            data = await asyncio.wait_for(self._queue.get(), timeout=timeout)
            return {"type": "message", "data": data}
        except asyncio.TimeoutError:
            return None


class TestPublishDecision(unittest.IsolatedAsyncioTestCase):
    """Test publishing decisions to Redis."""

    async def test_publish_returns_subscriber_count(self):
        redis = FakeRedis()
        # Subscribe first so publish reaches someone
        ps = redis.pubsub()
        await ps.subscribe("approval:apr_1")

        decision = ApprovalDecision(
            approval_id="apr_1",
            status="approved",
            approver_user_id="eu_1",
        )
        count = await publish_decision(redis, decision)
        assert count == 1

    async def test_publish_no_subscriber(self):
        redis = FakeRedis()
        decision = ApprovalDecision(
            approval_id="apr_999",
            status="approved",
            approver_user_id="eu_1",
        )
        count = await publish_decision(redis, decision)
        assert count == 0

    async def test_publish_logs_message(self):
        redis = FakeRedis()
        decision = ApprovalDecision(
            approval_id="apr_1",
            status="rejected",
            approver_user_id="eu_2",
            decision_note="No",
        )
        await publish_decision(redis, decision)
        assert len(redis._publish_log) == 1
        channel, data = redis._publish_log[0]
        assert channel == "approval:apr_1"
        assert "rejected" in data


class TestWaitForDecision(unittest.IsolatedAsyncioTestCase):
    """Test the wait_for_decision coroutine."""

    async def test_receives_approval(self):
        redis = FakeRedis()

        async def approve_later():
            await asyncio.sleep(0.1)
            decision = ApprovalDecision(
                approval_id="apr_1",
                status="approved",
                approver_user_id="eu_1",
                decision_note="OK",
            )
            await redis.publish("approval:apr_1", decision.to_json())

        asyncio.create_task(approve_later())
        result = await wait_for_decision(redis, "apr_1", timeout_seconds=5)
        assert result is not None
        assert result.status == "approved"
        assert result.approver_user_id == "eu_1"

    async def test_receives_rejection(self):
        redis = FakeRedis()

        async def reject_later():
            await asyncio.sleep(0.1)
            decision = ApprovalDecision(
                approval_id="apr_2",
                status="rejected",
                approver_user_id="eu_2",
                decision_note="Too risky",
            )
            await redis.publish("approval:apr_2", decision.to_json())

        asyncio.create_task(reject_later())
        result = await wait_for_decision(redis, "apr_2", timeout_seconds=5)
        assert result is not None
        assert result.status == "rejected"
        assert result.decision_note == "Too risky"

    async def test_timeout_returns_none(self):
        redis = FakeRedis()
        result = await wait_for_decision(redis, "apr_3", timeout_seconds=1)
        assert result is None

    async def test_handles_bytes_message(self):
        redis = FakeRedis()

        async def send_bytes():
            await asyncio.sleep(0.1)
            decision = ApprovalDecision(
                approval_id="apr_4",
                status="approved",
                approver_user_id="eu_1",
            )
            # Simulate Redis returning bytes
            ps = redis.pubsub()
            await ps.subscribe("approval:apr_4")
            q = redis._channels.get("approval:apr_4")
            if q:
                await q.put(decision.to_json().encode("utf-8"))

        # We need to start wait first, then send
        redis_for_wait = FakeRedis()

        async def send_bytes_v2():
            await asyncio.sleep(0.1)
            decision = ApprovalDecision(
                approval_id="apr_4",
                status="approved",
                approver_user_id="eu_1",
            )
            channel = "approval:apr_4"
            if channel in redis_for_wait._channels:
                await redis_for_wait._channels[channel].put(
                    decision.to_json().encode("utf-8")
                )

        asyncio.create_task(send_bytes_v2())
        result = await wait_for_decision(redis_for_wait, "apr_4", timeout_seconds=5)
        assert result is not None
        assert result.status == "approved"


if __name__ == "__main__":
    unittest.main()
