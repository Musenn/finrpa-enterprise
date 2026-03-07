"""Notification dispatcher with fallback and retry queue.

Orchestrates the notification flow:
1. Resolve target users from approval routing (department + role)
2. Look up each user's webhook configuration
3. Try primary channel (WeChat Work), fallback to DingTalk on failure
4. On total failure, enqueue to Redis retry list
5. Record all send attempts for audit trail
"""

import json
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime

from .channels import ChannelType, SendResult, send_wecom, send_dingtalk
from .templates import (
    ApprovalNotificationContext,
    render_wecom_payload,
    render_dingtalk_payload,
)

logger = logging.getLogger(__name__)

RETRY_QUEUE_KEY = "notification:retry_queue"


@dataclass
class WebhookConfig:
    """Webhook configuration for a user."""

    user_id: str
    wecom_url: str | None = None
    dingtalk_url: str | None = None


@dataclass
class NotificationAttempt:
    """Record of a single notification attempt (for audit)."""

    approval_id: str
    target_user_id: str
    channel: str
    success: bool
    error: str | None = None
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.utcnow().isoformat()


@dataclass
class DispatchResult:
    """Aggregated result of dispatching notifications for one approval."""

    approval_id: str
    attempts: list[NotificationAttempt] = field(default_factory=list)
    queued_for_retry: int = 0

    @property
    def total_success(self) -> int:
        return sum(1 for a in self.attempts if a.success)

    @property
    def total_failed(self) -> int:
        return sum(1 for a in self.attempts if not a.success)


async def _send_with_fallback(
    ctx: ApprovalNotificationContext,
    config: WebhookConfig,
) -> list[NotificationAttempt]:
    """Try WeChat Work first, fall back to DingTalk on failure.

    Returns list of NotificationAttempt records (1 or 2).
    """
    attempts: list[NotificationAttempt] = []

    # Try WeChat Work first
    if config.wecom_url:
        payload = render_wecom_payload(ctx)
        result = await send_wecom(config.wecom_url, payload)
        attempts.append(NotificationAttempt(
            approval_id=ctx.approval_id,
            target_user_id=config.user_id,
            channel=ChannelType.WECOM.value,
            success=result.success,
            error=result.error,
        ))
        if result.success:
            return attempts

    # Fallback to DingTalk
    if config.dingtalk_url:
        payload = render_dingtalk_payload(ctx)
        result = await send_dingtalk(config.dingtalk_url, payload)
        attempts.append(NotificationAttempt(
            approval_id=ctx.approval_id,
            target_user_id=config.user_id,
            channel=ChannelType.DINGTALK.value,
            success=result.success,
            error=result.error,
        ))
        if result.success:
            return attempts

    # If no webhook configured at all, record as failed
    if not config.wecom_url and not config.dingtalk_url:
        attempts.append(NotificationAttempt(
            approval_id=ctx.approval_id,
            target_user_id=config.user_id,
            channel="none",
            success=False,
            error="No webhook configured for user",
        ))

    return attempts


async def _enqueue_retry(
    redis_client,
    ctx: ApprovalNotificationContext,
    config: WebhookConfig,
):
    """Push failed notification to Redis retry queue."""
    entry = {
        "approval_id": ctx.approval_id,
        "task_id": ctx.task_id,
        "risk_level": ctx.risk_level,
        "target_user_id": config.user_id,
        "wecom_url": config.wecom_url,
        "dingtalk_url": config.dingtalk_url,
        "enqueued_at": datetime.utcnow().isoformat(),
    }
    await redis_client.rpush(RETRY_QUEUE_KEY, json.dumps(entry))
    logger.info(
        "Enqueued notification retry for approval=%s user=%s",
        ctx.approval_id,
        config.user_id,
    )


async def dispatch_notifications(
    ctx: ApprovalNotificationContext,
    webhook_configs: list[WebhookConfig],
    redis_client=None,
) -> DispatchResult:
    """Dispatch approval notifications to all target users.

    Args:
        ctx: The notification context with approval details.
        webhook_configs: List of webhook configs for target users.
        redis_client: Optional Redis client for retry queue.

    Returns:
        DispatchResult with all attempt records.
    """
    result = DispatchResult(approval_id=ctx.approval_id)

    for config in webhook_configs:
        attempts = await _send_with_fallback(ctx, config)
        result.attempts.extend(attempts)

        # If all channels failed for this user, enqueue for retry
        if not any(a.success for a in attempts):
            if redis_client is not None:
                await _enqueue_retry(redis_client, ctx, config)
                result.queued_for_retry += 1

    logger.info(
        "Dispatch complete for approval=%s: %d success, %d failed, %d queued",
        ctx.approval_id,
        result.total_success,
        result.total_failed,
        result.queued_for_retry,
    )

    return result


def resolve_webhook_configs(
    user_configs: dict[str, WebhookConfig],
    target_user_ids: list[str],
) -> list[WebhookConfig]:
    """Resolve webhook configs for target users.

    Args:
        user_configs: Mapping of user_id -> WebhookConfig (from DB or config).
        target_user_ids: List of user IDs to notify.

    Returns:
        List of WebhookConfig for users that have configs.
    """
    configs = []
    for uid in target_user_ids:
        if uid in user_configs:
            configs.append(user_configs[uid])
        else:
            # User has no webhook config — create a placeholder for audit
            configs.append(WebhookConfig(user_id=uid))
    return configs
