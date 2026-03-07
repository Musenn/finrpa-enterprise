# Day 4 — 多维度租户隔离中间件

## 今日改动

完成请求级别的多维度租户上下文注入和数据隔离机制，核心工作分四部分：

1. **租户上下文**：`enterprise/tenant/context.py` 基于 Python `ContextVar` 实现了请求级别的 `TenantContext`，存储当前用户的完整可见性范围——所属组织、可见部门 ID 列表、可见业务线 ID 列表、是否拥有全组织可见权限。采用 `frozen=True` 的 dataclass 确保上下文在请求生命周期内不可变
2. **FastAPI 中间件**：`enterprise/tenant/middleware.py` 实现了 `TenantIsolationMiddleware`，在每个请求进入时从 Bearer token 解析出用户上下文，构建 `TenantContext` 并写入 `ContextVar`。登录、健康检查、文档等路由走白名单跳过。请求结束后通过 `reset_tenant_context()` 清理上下文，防止跨请求泄漏
3. **查询过滤器**：`enterprise/tenant/query_filter.py` 提供 `apply_tenant_filter()` 函数，对 `task_extensions` 表的 SELECT 查询自动追加多维度过滤条件。全组织可见用户仅过滤 `org_id`；受限用户通过 `department_id IN (...) OR business_line_id IN (...)` 进行行级过滤；无权限用户匹配不可能条件返回空集
4. **业务路由**：`enterprise/tenant/routes.py` 新增两个接口——`GET /enterprise/tasks`（基于租户上下文返回过滤后的任务列表）和 `GET /enterprise/admin/visibility`（仅管理员可访问的可见性诊断 API，输入 user_id 返回该用户的完整权限视图）

在 `skyvern/forge/api_app.py` 中注册了中间件和路由。新增测试 25 个（Day 4），累计 133 个，全部通过。

## 设计决策

### ContextVar vs 请求对象属性

存储请求级别的租户信息有两种方案：

- **挂在 Request 对象上**（如 `request.state.tenant`）：需要在每个需要租户信息的函数中传递 `Request` 对象，侵入性强，且 SQLAlchemy 事件监听器等深层代码难以拿到 `Request`
- **ContextVar（当前方案）**：Python 3.7+ 的原生协程上下文变量，asyncio 框架下每个协程自动拥有独立的上下文副本。任何层级的代码只需 `get_tenant_context()` 即可获取当前请求的租户信息，无需层层传参

选择 ContextVar 的核心理由：查询过滤器运行在 SQLAlchemy 层，距离 FastAPI 路由层很远，通过 ContextVar 可以实现零耦合的跨层通信。

### 中间件的容错策略

中间件在遇到以下情况时选择放行而非拒绝：无 Authorization header、非 Bearer 格式、token 解析失败。原因是中间件的职责仅限于「设置上下文」，而非「强制认证」——认证由下游的 `get_current_user` 依赖函数负责。这种职责分离避免了中间件和依赖函数的重复校验，也保证了 Skyvern 原有的 API Key 认证路径不受影响。

### 全组织可见权限的判定规则

以下用户获得全组织可见权限（`has_full_org_visibility=True`）：
- `super_admin` 或 `org_admin` 角色持有者
- 拥有 `cross_org_read` 特殊权限的用户（风控部、合规部）

这个判定发生在中间件层而非查询层，确保一次判定、全程生效。查询过滤器只需检查 `has_full_org_visibility` 布尔值，不再重复解析角色和权限。

### 过滤条件的 OR 语义

受限用户的过滤条件是 `department_id IN (可见部门) OR business_line_id IN (可见业务线)`，而非 AND。AND 语义会导致跨业务线操作员无法看到非本部门但属于自己业务线的任务。OR 语义确保「只要部门或业务线任一维度命中，数据即可见」，符合项目规范中跨业务线操作员的可见性定义。

## 金融企业场景下的工程意义

**自动数据隔离**：银行系统中最危险的安全漏洞之一是数据越权——对公信贷部的操作员看到了个人金融部的客户数据。传统做法是在每个 API 端点手动添加 WHERE 过滤条件，一旦遗漏就是数据泄露事故。ContextVar + 查询过滤器的组合将数据隔离逻辑集中到一处，开发者编写新查询时不需要关心租户过滤，中间件和过滤器自动处理。

**可见性诊断的运维价值**：银行 IT 运维团队经常收到「为什么我看不到某条任务」的工单。`/admin/visibility` 接口直接返回目标用户的完整权限视图（部门角色、业务线、特殊权限、最终可见范围），运维人员无需逐表查库，一次 API 调用即可定位问题。

**请求级别的上下文隔离**：asyncio 环境下，多个请求可能在同一线程中并发执行。ContextVar 保证每个协程拥有独立的上下文副本，不存在跨请求的数据污染风险。即使在高并发场景下，用户 A 的请求永远不会看到用户 B 的租户上下文。

## 踩坑记录

1. **TenantContext 的不可变性**：最初使用普通 dataclass，在测试中发现可以直接修改 `ctx.org_id`，存在请求处理过程中上下文被意外篡改的风险。改为 `frozen=True` 后，任何修改操作都会抛出 `AttributeError`，从语言层面杜绝了上下文篡改
2. **中间件注册顺序**：Starlette 的中间件执行顺序是后注册先执行（栈式），需要确保 `TenantIsolationMiddleware` 在 CORS 中间件之后注册，否则预检请求（OPTIONS）会因缺少 CORS header 而被浏览器拒绝
