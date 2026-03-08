# Day 3 — JWT Auth & Permission 代码清单

## 新增文件

| 文件路径 | 功能说明 |
|---------|---------|
| `enterprise/auth/jwt_service.py` | JWT 令牌创建与解码，企业级多维度 payload（部门角色对/业务线/特殊权限） |
| `enterprise/auth/schemas.py` | Pydantic 数据结构（LoginRequest/LoginResponse/EnterpriseTokenPayload/UserContext） |
| `enterprise/auth/permission.py` | 权限解析引擎 `resolve_permission()`，按优先级判定有效权限级别 |
| `enterprise/auth/dependencies.py` | FastAPI 依赖注入装饰器（get_current_user/require_admin/require_approver 等） |
| `enterprise/auth/routes.py` | 认证路由（POST /login + GET /me） |
| `tests/unit/test_auth_jwt.py` | JWT 服务单元测试 |
| `tests/unit/test_permission_resolver.py` | 权限解析引擎测试（覆盖 6 种权限场景） |
| `tests/unit/test_auth_dependencies.py` | 依赖注入测试 |

## 修改文件

| 文件路径 | 修改说明 |
|---------|---------|
| `skyvern/forge/api_app.py` | 注册企业认证路由到 `/api/v1` 前缀 |
