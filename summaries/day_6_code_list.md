# Day 6 — Approval Engine 代码清单

## 新增文件

| 文件路径 | 功能说明 |
|---------|---------|
| `enterprise/approval/models.py` | 审批请求数据模型（ApprovalRequestModel/ApprovalStatus 枚举/超时配置） |
| `enterprise/approval/pubsub.py` | Redis Pub/Sub 审批等待机制（build/wait/publish 三函数 + 完整审批流封装） |
| `enterprise/approval/routes.py` | 审批 API（GET /pending + POST /approve + POST /reject），三层权限校验 |
| `tests/unit/test_approval_model.py` | 审批模型测试 |
| `tests/unit/test_approval_pubsub.py` | Pub/Sub 机制测试 |
| `tests/unit/test_approval_routes.py` | 审批 API 测试（权限/幂等性/状态转换） |

## 修改文件

| 文件路径 | 修改说明 |
|---------|---------|
| `skyvern/forge/api_app.py` | 注册审批路由到 `/api/v1` 前缀 |
