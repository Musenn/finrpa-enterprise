"""Redis Pub/Sub based approval wait mechanism.

When a high-risk operation is detected, the executing coroutine creates an
approval request and then subscribes to a Redis channel keyed by approval_id.
The coroutine suspends until it receives an approve/reject message or the
configured timeout elapses.

This module provides:
- create_approval_and_wait(): main entry point for task coroutines
- publish_decision(): called by the approval API when approver acts
- ApprovalDecision: the message schema on the channel
"""

import asyncio
import datetime
import json
import logging
from dataclasses import dataclass, asdict

from .models import (
    ApprovalRequestModel,
    ApprovalStatus,
    DEFAULT_TIMEOUTS,
    generate_approval_id,
)
from .routing import ApprovalRoute

logger = logging.getLogger(__name__)


CHANNEL_PREFIX = "approval:"


def _channel_name(approval_id: str) -> str:
    return f"{CHANNEL_PREFIX}{approval_id}"


@dataclass
class ApprovalDecision:
    """Message published to the approval channel."""

    approval_id: str
    status: str  # "approved" or "rejected"
    approver_user_id: str
    decision_note: str = ""

    def to_json(self) -> str:
        return json.dumps(asdict(self))

    @classmethod
    def from_json(cls, data: str) -> "ApprovalDecision":
        return cls(**json.loads(data))


async def publish_decision(
    redis_client,
    decision: ApprovalDecision,
) -> int:
    """Publish an approval decision to the waiting coroutine.

    Args:
        redis_client: An async Redis client (redis.asyncio.Redis).
        decision: The approval decision to publish.

    Returns:
        Number of subscribers that received the message.
    """
    channel = _channel_name(decision.approval_id)
    count = await redis_client.publish(channel, decision.to_json())
    logger.info(
        "Published decision to %s: status=%s, receivers=%d",
        channel,
        decision.status,
        count,
    )
    return count


def build_approval_request(
    task_id: str,
    org_id: str,
    department_id: str,
    risk_level: str,
    risk_reason: str,
    route: ApprovalRoute,
    business_line_id: str | None = None,
    operation_description: str | None = None,
    screenshot_path: str | None = None,
    timeout_override: int | None = None,
) -> ApprovalRequestModel:
    """Build an ApprovalRequestModel from risk detection + routing results.

    Does NOT persist to DB — caller is responsible for session.add() + commit().
    """
    timeout = timeout_override or DEFAULT_TIMEOUTS.get(risk_level, 3600)
    notify_str = ",".join(route.notify_department_ids) if route.notify_department_ids else None

    return ApprovalRequestModel(
        approval_id=generate_approval_id(),
        task_id=task_id,
        organization_id=org_id,
        department_id=department_id,
        business_line_id=business_line_id,
        risk_level=risk_level,
        risk_reason=risk_reason,
        operation_description=operation_description,
        screenshot_path=screenshot_path,
        approver_department_id=route.approver_department_id or department_id,
        approver_role=route.approver_role,
        notify_department_ids=notify_str,
        status=ApprovalStatus.PENDING.value,
        timeout_seconds=timeout,
    )


async def wait_for_decision(
    redis_client,
    approval_id: str,
    timeout_seconds: int,
) -> ApprovalDecision | None:
    """Subscribe to approval channel and wait for a decision or timeout.

    Args:
        redis_client: An async Redis client.
        approval_id: The approval request ID to wait on.
        timeout_seconds: Maximum seconds to wait before timeout.

    Returns:
        ApprovalDecision if a decision was received, None on timeout.
    """
    channel = _channel_name(approval_id)
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(channel)

    logger.info(
        "Coroutine subscribed to %s, waiting up to %ds",
        channel,
        timeout_seconds,
    )

    try:
        deadline = asyncio.get_event_loop().time() + timeout_seconds

        while True:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                logger.warning("Approval %s timed out after %ds", approval_id, timeout_seconds)
                return None

            try:
                message = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                    timeout=min(remaining, 2.0),
                )
            except asyncio.TimeoutError:
                continue

            if message is None:
                continue

            if message["type"] == "message":
                data = message["data"]
                if isinstance(data, bytes):
                    data = data.decode("utf-8")
                decision = ApprovalDecision.from_json(data)
                logger.info(
                    "Received decision for %s: %s by %s",
                    approval_id,
                    decision.status,
                    decision.approver_user_id,
                )
                return decision
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()


async def create_approval_and_wait(
    redis_client,
    db_session,
    task_id: str,
    org_id: str,
    department_id: str,
    risk_level: str,
    risk_reason: str,
    route: ApprovalRoute,
    business_line_id: str | None = None,
    operation_description: str | None = None,
    screenshot_path: str | None = None,
    timeout_override: int | None = None,
) -> ApprovalDecision | None:
    """Full approval flow: create request, persist, wait for decision.

    Args:
        redis_client: Async Redis client.
        db_session: SQLAlchemy async session.
        task_id: The Skyvern task ID.
        org_id: Organization ID.
        department_id: Source department ID.
        risk_level: Assessed risk level.
        risk_reason: Human-readable risk explanation.
        route: ApprovalRoute from the routing mapper.
        business_line_id: Optional business line ID.
        operation_description: Optional description of the operation.
        screenshot_path: Optional path to operation screenshot.
        timeout_override: Optional timeout in seconds (overrides default).

    Returns:
        ApprovalDecision if approved/rejected, None if timed out.
    """
    # Build and persist the approval request
    approval = build_approval_request(
        task_id=task_id,
        org_id=org_id,
        department_id=department_id,
        risk_level=risk_level,
        risk_reason=risk_reason,
        route=route,
        business_line_id=business_line_id,
        operation_description=operation_description,
        screenshot_path=screenshot_path,
        timeout_override=timeout_override,
    )
    db_session.add(approval)
    await db_session.commit()
    await db_session.refresh(approval)

    logger.info(
        "Created approval request %s for task %s (risk=%s, timeout=%ds)",
        approval.approval_id,
        task_id,
        risk_level,
        approval.timeout_seconds,
    )

    # Wait for decision via Redis Pub/Sub
    decision = await wait_for_decision(
        redis_client,
        approval.approval_id,
        approval.timeout_seconds,
    )

    # Update approval record based on outcome
    if decision is None:
        approval.status = ApprovalStatus.TIMEOUT.value
        approval.decided_at = datetime.datetime.utcnow()
    else:
        approval.status = decision.status
        approval.approver_user_id = decision.approver_user_id
        approval.decision_note = decision.decision_note
        approval.decided_at = datetime.datetime.utcnow()

    await db_session.commit()

    return decision
