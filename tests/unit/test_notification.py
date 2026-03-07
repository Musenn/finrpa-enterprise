"""Tests for the enterprise notification system.

Covers:
- Message template rendering (WeChat Work + DingTalk)
- Channel send functions (mocked HTTP)
- Fallback logic (WeChat fail -> DingTalk)
- Retry queue (Redis enqueue on total failure)
- Dispatch result aggregation
- Webhook config resolution
"""

import asyncio
import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from enterprise.notification.templates import (
    ApprovalNotificationContext,
    render_markdown,
    render_wecom_payload,
    render_dingtalk_payload,
    RISK_EMOJI,
    RISK_LABEL_CN,
    _timeout_display,
)
from enterprise.notification.channels import (
    ChannelType,
    SendResult,
    send_wecom,
    send_dingtalk,
)
from enterprise.notification.dispatcher import (
    WebhookConfig,
    NotificationAttempt,
    DispatchResult,
    dispatch_notifications,
    resolve_webhook_configs,
    _send_with_fallback,
    RETRY_QUEUE_KEY,
)


def _make_ctx(**overrides) -> ApprovalNotificationContext:
    defaults = {
        "approval_id": "apr_001",
        "task_id": "task_001",
        "risk_level": "high",
        "risk_reason": "Contains wire transfer keyword",
        "department_name": "对公信贷部",
        "business_line_name": "企业贷款",
        "operation_description": "Execute wire transfer 500万",
        "screenshot_url": "https://minio.example.com/screenshots/task_001.png",
        "approval_url": "https://app.example.com/approvals/apr_001",
        "timeout_seconds": 3600,
    }
    defaults.update(overrides)
    return ApprovalNotificationContext(**defaults)


# ============================================================
# Template tests
# ============================================================

class TestTimeoutDisplay(unittest.TestCase):
    def test_hours(self):
        assert _timeout_display(3600) == "1 小时"
        assert _timeout_display(7200) == "2 小时"

    def test_minutes(self):
        assert _timeout_display(1800) == "30 分钟"
        assert _timeout_display(300) == "5 分钟"


class TestRenderMarkdown(unittest.TestCase):
    def test_contains_risk_emoji(self):
        ctx = _make_ctx(risk_level="critical")
        md = render_markdown(ctx)
        assert "🔴" in md
        assert "严重风险" in md

    def test_contains_approval_id(self):
        ctx = _make_ctx()
        md = render_markdown(ctx)
        assert "apr_001" in md

    def test_contains_department(self):
        ctx = _make_ctx()
        md = render_markdown(ctx)
        assert "对公信贷部" in md

    def test_contains_business_line(self):
        ctx = _make_ctx()
        md = render_markdown(ctx)
        assert "企业贷款" in md

    def test_no_business_line(self):
        ctx = _make_ctx(business_line_name=None)
        md = render_markdown(ctx)
        assert "业务线" not in md

    def test_contains_screenshot_link(self):
        ctx = _make_ctx()
        md = render_markdown(ctx)
        assert "查看操作截图" in md
        assert "minio.example.com" in md

    def test_no_screenshot(self):
        ctx = _make_ctx(screenshot_url=None)
        md = render_markdown(ctx)
        assert "查看操作截图" not in md

    def test_contains_timeout(self):
        ctx = _make_ctx(timeout_seconds=1800)
        md = render_markdown(ctx)
        assert "30 分钟" in md

    def test_contains_approval_link(self):
        ctx = _make_ctx()
        md = render_markdown(ctx)
        assert "立即审批" in md

    def test_risk_levels(self):
        for level, emoji in RISK_EMOJI.items():
            ctx = _make_ctx(risk_level=level)
            md = render_markdown(ctx)
            assert emoji in md
            assert RISK_LABEL_CN[level] in md


class TestWecomPayload(unittest.TestCase):
    def test_msgtype(self):
        ctx = _make_ctx()
        payload = render_wecom_payload(ctx)
        assert payload["msgtype"] == "markdown"

    def test_has_content(self):
        ctx = _make_ctx()
        payload = render_wecom_payload(ctx)
        assert "content" in payload["markdown"]
        assert "apr_001" in payload["markdown"]["content"]


class TestDingtalkPayload(unittest.TestCase):
    def test_msgtype(self):
        ctx = _make_ctx()
        payload = render_dingtalk_payload(ctx)
        assert payload["msgtype"] == "actionCard"

    def test_has_title(self):
        ctx = _make_ctx()
        payload = render_dingtalk_payload(ctx)
        assert "审批请求" in payload["actionCard"]["title"]

    def test_has_approval_button(self):
        ctx = _make_ctx()
        payload = render_dingtalk_payload(ctx)
        assert payload["actionCard"]["singleTitle"] == "立即审批"
        assert "approvals/apr_001" in payload["actionCard"]["singleURL"]

    def test_has_text(self):
        ctx = _make_ctx()
        payload = render_dingtalk_payload(ctx)
        text = payload["actionCard"]["text"]
        assert "apr_001" in text
        assert "对公信贷部" in text


# ============================================================
# Channel tests (mocked HTTP)
# ============================================================

class TestSendWecom(unittest.IsolatedAsyncioTestCase):
    @patch("enterprise.notification.channels.httpx.AsyncClient")
    async def test_success(self, mock_client_cls):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = '{"errcode": 0, "errmsg": "ok"}'
        mock_resp.json.return_value = {"errcode": 0, "errmsg": "ok"}

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        result = await send_wecom("https://hook.example.com/wecom", {"msgtype": "markdown"})
        assert result.success is True
        assert result.channel == "wecom"

    @patch("enterprise.notification.channels.httpx.AsyncClient")
    async def test_api_error(self, mock_client_cls):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = '{"errcode": 45009, "errmsg": "api freq out of limit"}'
        mock_resp.json.return_value = {"errcode": 45009, "errmsg": "api freq out of limit"}

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        result = await send_wecom("https://hook.example.com/wecom", {})
        assert result.success is False
        assert "api freq out of limit" in result.error

    @patch("enterprise.notification.channels.httpx.AsyncClient")
    async def test_http_error(self, mock_client_cls):
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.text = "Internal Server Error"

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        result = await send_wecom("https://hook.example.com/wecom", {})
        assert result.success is False
        assert result.status_code == 500

    @patch("enterprise.notification.channels.httpx.AsyncClient")
    async def test_timeout(self, mock_client_cls):
        import httpx
        mock_client = AsyncMock()
        mock_client.post.side_effect = httpx.TimeoutException("connect timeout")
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        result = await send_wecom("https://hook.example.com/wecom", {})
        assert result.success is False
        assert "Timeout" in result.error


class TestSendDingtalk(unittest.IsolatedAsyncioTestCase):
    @patch("enterprise.notification.channels.httpx.AsyncClient")
    async def test_success(self, mock_client_cls):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = '{"errcode": 0, "errmsg": "ok"}'
        mock_resp.json.return_value = {"errcode": 0, "errmsg": "ok"}

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        result = await send_dingtalk("https://oapi.dingtalk.com/robot/send", {})
        assert result.success is True
        assert result.channel == "dingtalk"

    @patch("enterprise.notification.channels.httpx.AsyncClient")
    async def test_api_error(self, mock_client_cls):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = '{"errcode": 310000, "errmsg": "sign not match"}'
        mock_resp.json.return_value = {"errcode": 310000, "errmsg": "sign not match"}

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        result = await send_dingtalk("https://oapi.dingtalk.com/robot/send", {})
        assert result.success is False
        assert "sign not match" in result.error


# ============================================================
# Dispatcher tests
# ============================================================

class TestSendWithFallback(unittest.IsolatedAsyncioTestCase):
    @patch("enterprise.notification.dispatcher.send_wecom")
    async def test_wecom_success_no_fallback(self, mock_wecom):
        mock_wecom.return_value = SendResult(success=True, channel="wecom", status_code=200)
        ctx = _make_ctx()
        config = WebhookConfig(user_id="eu_1", wecom_url="https://wecom.example.com")

        attempts = await _send_with_fallback(ctx, config)
        assert len(attempts) == 1
        assert attempts[0].success is True
        assert attempts[0].channel == "wecom"

    @patch("enterprise.notification.dispatcher.send_dingtalk")
    @patch("enterprise.notification.dispatcher.send_wecom")
    async def test_wecom_fail_fallback_dingtalk(self, mock_wecom, mock_dingtalk):
        mock_wecom.return_value = SendResult(success=False, channel="wecom", error="timeout")
        mock_dingtalk.return_value = SendResult(success=True, channel="dingtalk", status_code=200)

        ctx = _make_ctx()
        config = WebhookConfig(
            user_id="eu_1",
            wecom_url="https://wecom.example.com",
            dingtalk_url="https://dingtalk.example.com",
        )

        attempts = await _send_with_fallback(ctx, config)
        assert len(attempts) == 2
        assert attempts[0].success is False
        assert attempts[0].channel == "wecom"
        assert attempts[1].success is True
        assert attempts[1].channel == "dingtalk"

    @patch("enterprise.notification.dispatcher.send_dingtalk")
    @patch("enterprise.notification.dispatcher.send_wecom")
    async def test_both_fail(self, mock_wecom, mock_dingtalk):
        mock_wecom.return_value = SendResult(success=False, channel="wecom", error="fail")
        mock_dingtalk.return_value = SendResult(success=False, channel="dingtalk", error="fail")

        ctx = _make_ctx()
        config = WebhookConfig(
            user_id="eu_1",
            wecom_url="https://wecom.example.com",
            dingtalk_url="https://dingtalk.example.com",
        )

        attempts = await _send_with_fallback(ctx, config)
        assert len(attempts) == 2
        assert all(not a.success for a in attempts)

    async def test_no_webhook_configured(self):
        ctx = _make_ctx()
        config = WebhookConfig(user_id="eu_1")

        attempts = await _send_with_fallback(ctx, config)
        assert len(attempts) == 1
        assert attempts[0].success is False
        assert "No webhook configured" in attempts[0].error

    @patch("enterprise.notification.dispatcher.send_dingtalk")
    async def test_only_dingtalk_configured(self, mock_dingtalk):
        mock_dingtalk.return_value = SendResult(success=True, channel="dingtalk", status_code=200)

        ctx = _make_ctx()
        config = WebhookConfig(user_id="eu_1", dingtalk_url="https://dingtalk.example.com")

        attempts = await _send_with_fallback(ctx, config)
        assert len(attempts) == 1
        assert attempts[0].success is True
        assert attempts[0].channel == "dingtalk"


class TestDispatchNotifications(unittest.IsolatedAsyncioTestCase):
    @patch("enterprise.notification.dispatcher._send_with_fallback")
    async def test_dispatch_success(self, mock_send):
        mock_send.return_value = [
            NotificationAttempt(
                approval_id="apr_1",
                target_user_id="eu_1",
                channel="wecom",
                success=True,
            )
        ]

        ctx = _make_ctx()
        configs = [WebhookConfig(user_id="eu_1", wecom_url="https://wecom.example.com")]
        result = await dispatch_notifications(ctx, configs)

        assert result.total_success == 1
        assert result.total_failed == 0
        assert result.queued_for_retry == 0

    @patch("enterprise.notification.dispatcher._send_with_fallback")
    async def test_dispatch_failure_enqueues_retry(self, mock_send):
        mock_send.return_value = [
            NotificationAttempt(
                approval_id="apr_1",
                target_user_id="eu_1",
                channel="wecom",
                success=False,
                error="timeout",
            )
        ]

        fake_redis = AsyncMock()
        ctx = _make_ctx()
        configs = [WebhookConfig(user_id="eu_1", wecom_url="https://wecom.example.com")]
        result = await dispatch_notifications(ctx, configs, redis_client=fake_redis)

        assert result.total_failed == 1
        assert result.queued_for_retry == 1
        fake_redis.rpush.assert_called_once()
        call_args = fake_redis.rpush.call_args
        assert call_args[0][0] == RETRY_QUEUE_KEY

    @patch("enterprise.notification.dispatcher._send_with_fallback")
    async def test_dispatch_no_redis_no_queue(self, mock_send):
        """If no Redis client provided, failures are not queued."""
        mock_send.return_value = [
            NotificationAttempt(
                approval_id="apr_1",
                target_user_id="eu_1",
                channel="wecom",
                success=False,
                error="fail",
            )
        ]

        ctx = _make_ctx()
        configs = [WebhookConfig(user_id="eu_1", wecom_url="https://wecom.example.com")]
        result = await dispatch_notifications(ctx, configs, redis_client=None)

        assert result.total_failed == 1
        assert result.queued_for_retry == 0

    @patch("enterprise.notification.dispatcher._send_with_fallback")
    async def test_dispatch_multiple_users(self, mock_send):
        async def side_effect(ctx, config):
            if config.user_id == "eu_1":
                return [NotificationAttempt(
                    approval_id=ctx.approval_id, target_user_id="eu_1",
                    channel="wecom", success=True,
                )]
            else:
                return [NotificationAttempt(
                    approval_id=ctx.approval_id, target_user_id="eu_2",
                    channel="wecom", success=False, error="fail",
                )]

        mock_send.side_effect = side_effect

        ctx = _make_ctx()
        configs = [
            WebhookConfig(user_id="eu_1", wecom_url="https://wecom.example.com"),
            WebhookConfig(user_id="eu_2", wecom_url="https://wecom2.example.com"),
        ]
        fake_redis = AsyncMock()
        result = await dispatch_notifications(ctx, configs, redis_client=fake_redis)

        assert result.total_success == 1
        assert result.total_failed == 1
        assert result.queued_for_retry == 1


class TestResolveWebhookConfigs(unittest.TestCase):
    def test_resolve_existing_users(self):
        configs_map = {
            "eu_1": WebhookConfig(user_id="eu_1", wecom_url="https://w1.example.com"),
            "eu_2": WebhookConfig(user_id="eu_2", dingtalk_url="https://d2.example.com"),
        }
        result = resolve_webhook_configs(configs_map, ["eu_1", "eu_2"])
        assert len(result) == 2
        assert result[0].wecom_url == "https://w1.example.com"
        assert result[1].dingtalk_url == "https://d2.example.com"

    def test_missing_user_gets_placeholder(self):
        configs_map = {
            "eu_1": WebhookConfig(user_id="eu_1", wecom_url="https://w1.example.com"),
        }
        result = resolve_webhook_configs(configs_map, ["eu_1", "eu_99"])
        assert len(result) == 2
        assert result[1].user_id == "eu_99"
        assert result[1].wecom_url is None
        assert result[1].dingtalk_url is None

    def test_empty_targets(self):
        result = resolve_webhook_configs({}, [])
        assert result == []


class TestDispatchResult(unittest.TestCase):
    def test_totals(self):
        r = DispatchResult(approval_id="apr_1", attempts=[
            NotificationAttempt("apr_1", "eu_1", "wecom", success=True),
            NotificationAttempt("apr_1", "eu_2", "wecom", success=False, error="fail"),
            NotificationAttempt("apr_1", "eu_2", "dingtalk", success=True),
        ])
        assert r.total_success == 2
        assert r.total_failed == 1

    def test_empty(self):
        r = DispatchResult(approval_id="apr_1")
        assert r.total_success == 0
        assert r.total_failed == 0


class TestNotificationAttempt(unittest.TestCase):
    def test_auto_timestamp(self):
        a = NotificationAttempt("apr_1", "eu_1", "wecom", success=True)
        assert a.timestamp != ""
        assert "T" in a.timestamp  # ISO format


if __name__ == "__main__":
    unittest.main()
