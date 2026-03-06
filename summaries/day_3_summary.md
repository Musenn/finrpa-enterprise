# Day 3 — JWT 认证与多维度权限验证

## 今日改动

完成企业级认证体系和权限验证引擎的全部实现，核心工作分四部分：

1. **认证层（JWT）**：`enterprise/auth/jwt_service.py` 实现了企业级 JWT 令牌的创建和解码。与 Skyvern 原有的简单 `{sub, exp}` 令牌不同，企业令牌的 payload 包含完整的权限上下文——所有部门-角色对、所有业务线 ID、跨组织特殊权限标志。`enterprise/auth/schemas.py` 定义了 `LoginRequest`、`LoginResponse`、`EnterpriseTokenPayload`、`UserContext` 等数据结构
2. **权限解析引擎**：`enterprise/auth/permission.py` 实现了 `resolve_permission()` 函数，给定用户上下文和目标资源的组织/部门/业务线信息，返回有效权限级别（NONE/READ/OPERATE/APPROVE）。判断逻辑按优先级递减：管理员直接放行 → 部门匹配按角色判断 → 业务线匹配按角色判断 → 跨组织特殊权限 → 无权限
3. **FastAPI 依赖注入**：`enterprise/auth/dependencies.py` 提供了一组可复用的 `Depends()` 装饰器：`get_current_user`（从 Bearer token 解析用户上下文）、`require_any_operator`、`require_approver`、`require_cross_org_viewer`、`require_admin`、`require_department_operator(dept_id)` 工厂函数、`require_department_role(dept_id, min_role)` 工厂函数
4. **路由注册**：`enterprise/auth/routes.py` 实现了 `/api/v1/enterprise/auth/login` 登录接口和 `/api/v1/enterprise/auth/me` 用户信息接口；在 `skyvern/forge/api_app.py` 中注册企业路由

新增测试 51 个（Day 3），累计 108 个，全部通过。

## 设计决策

### JWT Payload 的信息密度取舍

企业令牌将用户的全部权限信息编码进 JWT payload，包括每个部门的角色和所有业务线 ID。这意味着令牌体积比 Skyvern 原版大得多。方案对比：

- **胖令牌（当前方案）**：所有权限信息嵌入 JWT，每次请求直接从令牌解析权限，无需查库。优点是权限验证零数据库开销，适合高频 API 调用场景；缺点是令牌较大（约 500-800 字节），且权限变更后需要重新签发令牌才能生效
- **瘦令牌 + 数据库查询**：JWT 只存 user_id，每次请求从数据库加载权限。优点是权限变更实时生效；缺点是每个请求增加 3-4 次数据库查询（用户表、部门角色表、业务线表、特殊权限表），在高并发场景下是不可接受的性能开销

选择胖令牌的原因：金融机构的组织架构变动频率极低（月/季度级别），权限实时生效的需求优先级低于接口响应性能。令牌有效期内权限变更的问题，后续通过 Redis 令牌黑名单机制解决。

### 权限解析的优先级设计

`resolve_permission()` 的判断逻辑经过刻意排序：

1. 先检查组织是否匹配（不同组织直接返回 NONE，短路后续所有判断）
2. super_admin/org_admin 在组织内拥有最高权限，一旦命中直接返回 APPROVE
3. 部门匹配优先于业务线匹配（行政归属是主要权限锚点）
4. 跨组织特殊权限作为最后兜底（风控/合规的穿透读取权限）

这个优先级保证了：普通员工的权限边界由部门和业务线共同决定，管理员不受限制，风控/合规的跨部门读取不会被普通部门角色覆盖。

### 依赖注入的分层设计

`get_current_user` 是最底层的依赖，只负责令牌解析和验证，返回 `UserContext`。上层的 `require_*` 系列函数依赖 `get_current_user` 的输出做进一步的角色检查。这种分层的好处是：

- 路由可以只注入 `CurrentUser` 类型标注来获取用户信息，不强制角色要求
- 需要强制角色时，通过 `Depends(require_any_operator)` 叠加
- `require_department_operator(dept_id)` 是工厂函数，返回一个闭包，支持在路由定义时指定目标部门 ID

### 登录接口与 Skyvern 原有认证的并存

没有替换 Skyvern 的 `get_current_org()` 认证逻辑，而是在 `/api/v1/enterprise/auth/` 路径下新增独立的登录入口。Skyvern 原有的 API Key 认证仍然可用于非企业场景（如外部系统集成、CI/CD 调用）。企业用户通过用户名密码登录获取 JWT，两种认证机制在路由层面互不干扰。

## 金融企业场景下的工程意义

**零查库的权限验证**：银行业务系统的 API 调用频率远高于一般 SaaS 产品（批量任务执行时可能在数秒内产生上百次 API 调用）。将权限信息编码进 JWT 后，每次请求的权限验证完全在内存中完成，不产生数据库 round-trip，直接减少了数据库负载并降低了 P99 延迟。

**六种权限场景的完整覆盖**：测试用例直接对应项目规范中的权限矩阵——普通操作员、跨业务线操作员、部门审批员、风控只读、合规审批、系统管理员。每个场景都验证了正向和反向（越权）两个方向，确保权限边界无遗漏。

**依赖注入的声明式安全**：开发者在编写新路由时，通过 `Depends(require_approver)` 一行代码即可强制审批权限检查，将安全逻辑从业务代码中分离。这种声明式的安全模式降低了因开发疏忽导致的权限绕过风险。

## 踩坑记录

1. **`require_any_operator` 的语义澄清**：最初将 approver 也视为 operator 的超集（因为 approver 级别更高），但项目规范明确要求 operator 和 approver 互斥。因此 `is_any_operator` 只匹配 super_admin、org_admin、operator 三种角色，不包含 approver。这保证了审批员无法绕过分离控制直接执行操作
