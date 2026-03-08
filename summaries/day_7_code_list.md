# Day 7 — Notification System 代码清单

## 新增文件

| 文件路径 | 功能说明 |
|---------|---------|
| `enterprise/notification/__init__.py` | 通知模块初始化 |
| `enterprise/notification/templates.py` | 消息模板引擎（企业微信 Markdown + 钉钉 ActionCard），含风险 Emoji/截图链接/审批按钮 |
| `enterprise/notification/channels.py` | 通道发送层（send_wecom/send_dingtalk），httpx 异步 HTTP + 统一 SendResult |
| `enterprise/notification/dispatcher.py` | 通知调度器：企业微信优先→钉钉降级→Redis 重试队列，含审计追踪 |
| `tests/unit/test_notification.py` | 通知系统测试（39 个用例：模板渲染/通道发送/降级策略/重试队列） |
