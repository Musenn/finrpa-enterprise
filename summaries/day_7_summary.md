# Day 7 — 企业通知集成

## 今日改动

完成多渠道审批通知推送系统，支持企业微信和钉钉双通道，核心工作分四部分：

1. **消息模板引擎**：`enterprise/notification/templates.py` 实现了 `ApprovalNotificationContext` 数据类和两套消息渲染函数。企业微信使用 Markdown 格式消息，钉钉使用 ActionCard 交互式卡片消息。模板统一包含：风险等级 Emoji 标识（🟢🟡🟠🔴）、审批编号与关联任务、所属部门与业务线、风险原因与操作描述、MinIO 预签名截图链接、超时倒计时、一键审批按钮
2. **通道发送层**：`enterprise/notification/channels.py` 封装了 `send_wecom()` 和 `send_dingtalk()` 两个异步函数，基于 httpx 的异步 HTTP 客户端。每个通道独立处理 API 级错误码（企业微信 errcode、钉钉 errcode）和传输层错误（超时、连接失败），返回统一的 `SendResult` 数据结构
3. **通知调度器**：`enterprise/notification/dispatcher.py` 实现了 `dispatch_notifications()` 主调度函数。对每个目标用户执行「企业微信优先 → 钉钉降级」的双通道尝试；全部失败时将通知条目推入 Redis List（`notification:retry_queue`）等待定时重试；通过 `resolve_webhook_configs()` 从用户配置映射中解析目标用户的 Webhook 地址
4. **审计追踪**：每次发送尝试记录为 `NotificationAttempt`（包含审批 ID、目标用户、通道类型、成功/失败、错误信息、时间戳），聚合为 `DispatchResult` 供审计日志消费

新增测试 39 个（Day 7），累计 301 个，全部通过。

## 设计决策

### 企业微信 Markdown vs 钉钉 ActionCard

两个平台的消息能力不同，采用差异化适配而非强制统一：

- **企业微信**：Webhook 支持 text 和 markdown 两种消息类型。选择 markdown 因为它支持标题、加粗、引用块、链接等格式化元素，能清晰展示风险等级、部门信息等结构化内容
- **钉钉**：除 text 和 markdown 外，还支持 ActionCard（带按钮的交互式卡片）。选择 ActionCard 因为它原生支持「立即审批」按钮，用户点击后直接跳转到审批页面，无需从消息正文中手动复制链接

两套模板共享同一个 `ApprovalNotificationContext` 数据类，确保内容一致性的同时适配各平台的最佳展示形式。

### 降级策略：串行尝试而非并行广播

对每个用户的通知采用「企业微信 → 钉钉」串行尝试，而非同时广播到两个平台。原因：

- **避免重复通知**：审批人同时收到企业微信和钉钉的相同通知会造成信息噪音，尤其在高并发审批场景下
- **主备明确**：金融机构通常有明确的主要办公通讯工具（企业微信或钉钉），另一个仅作备用。串行尝试尊重这一优先级
- **成本可控**：Webhook 调用有频率限制（企业微信每分钟 20 条/机器人），避免不必要的调用消耗配额

### Redis List 重试队列而非内存队列

全部通道失败时，将通知推入 Redis List 而非进程内存队列：

- **持久性**：RPA 服务重启后，内存队列丢失，Redis List 持久化（Day 1 已开启 AOF）
- **可观测**：运维团队可以通过 `LLEN notification:retry_queue` 实时监控积压量
- **跨实例共享**：多实例部署时，任何实例都可以消费重试队列，避免单点瓶颈

### 通知不阻塞主流程

`dispatch_notifications()` 的设计原则是「尽力通知，永不阻塞」。通知发送失败不会抛出异常到调用方——所有错误被捕获并记录到 `DispatchResult`。这确保了通知系统的故障不会影响审批流程本身的正常运行。审批请求在 Day 6 的 Pub/Sub 机制中已经持久化，即使通知未送达，审批人仍可通过审批列表 API 查看待审批项。

## 金融企业场景下的工程意义

**及时性要求**：银行的大额转账、保险的巨额理赔等 critical 级别操作，超时时间仅 30 分钟。如果审批人未及时收到通知，操作将被自动拒绝，可能影响客户服务。多渠道通知 + 降级策略最大程度保障了通知的到达率。

**企业通讯生态适配**：中国金融机构的内部通讯工具主要为企业微信和钉钉。两者的 Webhook API 接口不同（payload 格式、错误码体系），统一的 `SendResult` 抽象和差异化的消息模板让系统同时适配两个生态，部署时按机构实际使用的工具配置即可。

**审计可追溯**：每一次通知尝试都留下完整的审计记录（谁被通知、通过什么渠道、是否成功、失败原因）。当出现「审批人声称未收到通知」的争议时，可以精确追溯通知链路的每一步。

**截图链接的安全考量**：操作截图存储在 MinIO 中，通过预签名 URL 嵌入通知消息。预签名 URL 具有时效性（通常 1 小时），过期后链接自动失效，避免了截图长期暴露在通讯工具的消息历史中的安全风险。

## 踩坑记录

1. **httpx AsyncClient 的 mock 模式**：unittest.mock 的 `AsyncMock` 需要正确模拟 `async with` 上下文管理器——必须同时设置 `__aenter__` 和 `__aexit__` 的返回值，否则 `async with httpx.AsyncClient() as client:` 会抛出 `TypeError`
2. **钉钉 ActionCard 的 singleURL 字段**：钉钉文档要求 ActionCard 的 `singleURL` 必须为非空字符串，即使暂无审批链接也不能传 `None`，否则 API 返回参数校验错误。处理方式为 `ctx.approval_url or ""`
