"""Notification message templates for approval workflows.

Generates structured messages for WeChat Work and DingTalk webhooks,
including risk level indicators, operation details, and action links.
"""

from dataclasses import dataclass

RISK_EMOJI = {
    "low": "🟢",
    "medium": "🟡",
    "high": "🟠",
    "critical": "🔴",
}

RISK_LABEL_CN = {
    "low": "低风险",
    "medium": "中风险",
    "high": "高风险",
    "critical": "严重风险",
}


@dataclass
class ApprovalNotificationContext:
    """Context data for rendering approval notification messages."""

    approval_id: str
    task_id: str
    risk_level: str
    risk_reason: str
    department_name: str
    business_line_name: str | None
    operation_description: str | None
    screenshot_url: str | None  # MinIO presigned URL
    approval_url: str | None
    timeout_seconds: int
    approver_name: str | None = None


def _timeout_display(seconds: int) -> str:
    """Convert seconds to human-readable timeout string."""
    if seconds >= 3600:
        hours = seconds // 3600
        return f"{hours} 小时"
    minutes = seconds // 60
    return f"{minutes} 分钟"


def render_markdown(ctx: ApprovalNotificationContext) -> str:
    """Render approval notification as Markdown (used by WeChat Work).

    WeChat Work supports a subset of Markdown in its webhook messages.
    """
    emoji = RISK_EMOJI.get(ctx.risk_level, "⚪")
    label = RISK_LABEL_CN.get(ctx.risk_level, ctx.risk_level)

    lines = [
        f"### {emoji} 审批请求 — {label}",
        "",
        f"> **审批编号**: {ctx.approval_id}",
        f"> **关联任务**: {ctx.task_id}",
        f"> **所属部门**: {ctx.department_name}",
    ]

    if ctx.business_line_name:
        lines.append(f"> **业务线**: {ctx.business_line_name}")

    lines.extend([
        "",
        f"**风险原因**: {ctx.risk_reason}",
    ])

    if ctx.operation_description:
        lines.append(f"**操作描述**: {ctx.operation_description}")

    if ctx.screenshot_url:
        lines.append(f"[查看操作截图]({ctx.screenshot_url})")

    lines.extend([
        "",
        f"⏱ 超时时间: **{_timeout_display(ctx.timeout_seconds)}**",
    ])

    if ctx.approval_url:
        lines.append(f"[立即审批]({ctx.approval_url})")

    return "\n".join(lines)


def render_wecom_payload(ctx: ApprovalNotificationContext) -> dict:
    """Build WeChat Work (企业微信) webhook JSON payload."""
    return {
        "msgtype": "markdown",
        "markdown": {
            "content": render_markdown(ctx),
        },
    }


def render_dingtalk_payload(ctx: ApprovalNotificationContext) -> dict:
    """Build DingTalk (钉钉) webhook JSON payload.

    DingTalk uses ActionCard for rich interactive messages.
    """
    emoji = RISK_EMOJI.get(ctx.risk_level, "⚪")
    label = RISK_LABEL_CN.get(ctx.risk_level, ctx.risk_level)
    title = f"{emoji} 审批请求 — {label}"

    text_lines = [
        f"### {title}",
        "",
        f"- 审批编号: {ctx.approval_id}",
        f"- 关联任务: {ctx.task_id}",
        f"- 所属部门: {ctx.department_name}",
    ]

    if ctx.business_line_name:
        text_lines.append(f"- 业务线: {ctx.business_line_name}")

    text_lines.extend([
        "",
        f"**风险原因**: {ctx.risk_reason}",
    ])

    if ctx.operation_description:
        text_lines.append(f"**操作描述**: {ctx.operation_description}")

    if ctx.screenshot_url:
        text_lines.append(f"[查看操作截图]({ctx.screenshot_url})")

    text_lines.append(f"\n⏱ 超时时间: **{_timeout_display(ctx.timeout_seconds)}**")

    text = "\n".join(text_lines)

    payload: dict = {
        "msgtype": "actionCard",
        "actionCard": {
            "title": title,
            "text": text,
            "singleTitle": "立即审批",
            "singleURL": ctx.approval_url or "",
        },
    }

    return payload
