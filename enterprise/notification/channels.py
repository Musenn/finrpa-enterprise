"""Notification channel implementations.

Each channel is responsible for delivering a message payload to its
respective platform (WeChat Work, DingTalk). Channels are stateless
and communicate via HTTP webhooks.
"""

import logging
from dataclasses import dataclass
from enum import Enum

import httpx

logger = logging.getLogger(__name__)

# Timeout for webhook HTTP requests (connect, read)
WEBHOOK_TIMEOUT = httpx.Timeout(connect=5.0, read=10.0, write=5.0, pool=5.0)


class ChannelType(str, Enum):
    WECOM = "wecom"
    DINGTALK = "dingtalk"


@dataclass
class SendResult:
    """Result of a notification send attempt."""

    success: bool
    channel: str
    status_code: int | None = None
    error: str | None = None
    response_body: str | None = None


async def send_wecom(webhook_url: str, payload: dict) -> SendResult:
    """Send a message via WeChat Work (企业微信) webhook.

    Args:
        webhook_url: The WeChat Work webhook URL.
        payload: The message payload (from render_wecom_payload).

    Returns:
        SendResult with success status and details.
    """
    try:
        async with httpx.AsyncClient(timeout=WEBHOOK_TIMEOUT) as client:
            resp = await client.post(webhook_url, json=payload)
            body = resp.text

            # WeChat Work returns {"errcode": 0, "errmsg": "ok"} on success
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    if data.get("errcode", -1) == 0:
                        return SendResult(
                            success=True,
                            channel=ChannelType.WECOM.value,
                            status_code=200,
                            response_body=body,
                        )
                    else:
                        return SendResult(
                            success=False,
                            channel=ChannelType.WECOM.value,
                            status_code=200,
                            error=f"WeChat API error: {data.get('errmsg', 'unknown')}",
                            response_body=body,
                        )
                except Exception:
                    pass

            return SendResult(
                success=False,
                channel=ChannelType.WECOM.value,
                status_code=resp.status_code,
                error=f"HTTP {resp.status_code}",
                response_body=body,
            )

    except httpx.TimeoutException as e:
        logger.warning("WeChat Work webhook timeout: %s", e)
        return SendResult(
            success=False,
            channel=ChannelType.WECOM.value,
            error=f"Timeout: {e}",
        )
    except Exception as e:
        logger.error("WeChat Work webhook error: %s", e)
        return SendResult(
            success=False,
            channel=ChannelType.WECOM.value,
            error=str(e),
        )


async def send_dingtalk(webhook_url: str, payload: dict) -> SendResult:
    """Send a message via DingTalk (钉钉) webhook.

    Args:
        webhook_url: The DingTalk webhook URL.
        payload: The message payload (from render_dingtalk_payload).

    Returns:
        SendResult with success status and details.
    """
    try:
        async with httpx.AsyncClient(timeout=WEBHOOK_TIMEOUT) as client:
            resp = await client.post(webhook_url, json=payload)
            body = resp.text

            # DingTalk returns {"errcode": 0, "errmsg": "ok"} on success
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    if data.get("errcode", -1) == 0:
                        return SendResult(
                            success=True,
                            channel=ChannelType.DINGTALK.value,
                            status_code=200,
                            response_body=body,
                        )
                    else:
                        return SendResult(
                            success=False,
                            channel=ChannelType.DINGTALK.value,
                            status_code=200,
                            error=f"DingTalk API error: {data.get('errmsg', 'unknown')}",
                            response_body=body,
                        )
                except Exception:
                    pass

            return SendResult(
                success=False,
                channel=ChannelType.DINGTALK.value,
                status_code=resp.status_code,
                error=f"HTTP {resp.status_code}",
                response_body=body,
            )

    except httpx.TimeoutException as e:
        logger.warning("DingTalk webhook timeout: %s", e)
        return SendResult(
            success=False,
            channel=ChannelType.DINGTALK.value,
            error=f"Timeout: {e}",
        )
    except Exception as e:
        logger.error("DingTalk webhook error: %s", e)
        return SendResult(
            success=False,
            channel=ChannelType.DINGTALK.value,
            error=str(e),
        )
