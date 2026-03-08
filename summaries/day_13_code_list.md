# Day 13 — Performance Optimization 代码清单

## 新增文件

| 文件路径 | 功能说明 |
|---------|---------|
| `enterprise/llm/action_cache.py` | Action 缓存引擎（DOM 哈希 + 目标哈希 → 缓存 key/动态内容剥除/TTL 过期/命中率统计） |
| `enterprise/llm/cache_routes.py` | 缓存管理 API（stats/按任务清除/过期清除/全量清除/重置计数器，admin 权限） |
| `tests/unit/test_action_cache.py` | 缓存测试（35 个用例：DOM 哈希/动态剥除/TTL 过期/缓存命中/API 管理） |

## 修改文件

| 文件路径 | 修改说明 |
|---------|---------|
| `skyvern/forge/api_app.py` | 注册缓存管理路由到 `/api/v1` 前缀 |
