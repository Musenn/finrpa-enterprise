# Day 4 — Tenant Isolation Middleware 代码清单

## 新增文件

| 文件路径 | 功能说明 |
|---------|---------|
| `enterprise/tenant/context.py` | 基于 ContextVar 的请求级租户上下文（TenantContext），frozen dataclass 不可变 |
| `enterprise/tenant/middleware.py` | FastAPI 中间件，从 Bearer token 构建 TenantContext 并注入 ContextVar |
| `enterprise/tenant/query_filter.py` | SQL 查询过滤器 `apply_tenant_filter()`，自动追加多维度行级过滤条件 |
| `enterprise/tenant/routes.py` | 租户路由（GET /enterprise/tasks + GET /enterprise/admin/visibility 诊断 API） |
| `tests/unit/test_tenant_context.py` | TenantContext 单元测试 |
| `tests/unit/test_tenant_middleware.py` | 中间件测试（白名单/容错/上下文注入） |
| `tests/unit/test_tenant_query_filter.py` | 查询过滤器测试（全组织/受限/无权限三种场景） |

## 修改文件

| 文件路径 | 修改说明 |
|---------|---------|
| `skyvern/forge/api_app.py` | 注册 TenantIsolationMiddleware 和租户路由 |
