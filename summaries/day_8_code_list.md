# Day 8 — Audit & Compliance 代码清单

## 新增文件

| 文件路径 | 功能说明 |
|---------|---------|
| `enterprise/audit/models.py` | 审计日志数据模型（AuditLogModel：10 种 action 类型/前后截图/脱敏值/哈希） |
| `enterprise/audit/sanitizer.py` | 输入值脱敏引擎（银行卡/密码/身份证/手机号 4 条规则 + SHA-256 哈希校验） |
| `enterprise/audit/storage.py` | MinIO 截图存储（按月分 bucket/结构化 object key/预签名 URL） |
| `enterprise/audit/logger.py` | 审计日志写入器（自动脱敏 + 持久化 + 降级告警不中断主流程） |
| `enterprise/audit/routes.py` | 审计查询 API（多维度筛选/分页/截图预签名 URL） |
| `tests/unit/test_audit.py` | 审计系统测试（44 个用例：脱敏规则/存储路径/日志写入/API 查询） |

## 修改文件

| 文件路径 | 修改说明 |
|---------|---------|
| `skyvern/forge/api_app.py` | 注册审计路由到 `/api/v1` 前缀 |
