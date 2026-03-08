# Day 11 — Dashboard API 代码清单

## 新增文件

| 文件路径 | 功能说明 |
|---------|---------|
| `enterprise/dashboard/stats.py` | 6 个统计计算函数（概览/趋势/错误分布/业务线对比/审批响应时间/成本估算） |
| `enterprise/dashboard/cache.py` | Redis 缓存层（租户隔离 key/60s TTL/降级直查） |
| `enterprise/dashboard/routes.py` | 统计 API（7 个端点：概览/趋势/错误/业务线/审批时间/成本/CSV 导出） |
| `tests/unit/test_dashboard.py` | 统计系统测试（27 个用例：计算逻辑/缓存命中/CSV 导出/权限控制） |

## 修改文件

| 文件路径 | 修改说明 |
|---------|---------|
| `skyvern/forge/api_app.py` | 注册 Dashboard 统计路由到 `/api/v1` 前缀 |
