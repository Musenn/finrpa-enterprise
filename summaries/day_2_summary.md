# Day 2 — 多维度权限体系数据模型

## 今日改动

完成企业级三维度权限体系的全部数据模型实现，核心工作分四部分：

1. **权限模型层**：在 `enterprise/auth/` 下新增 4 个模块——`enums.py`（角色、风险等级、特殊权限三组枚举）、`id.py`（复用 Skyvern 的 `generate_id()` 并加上 `dept_`、`bl_`、`eu_` 等语义前缀的 ID 生成器）、`models.py`（7 张表的 SQLAlchemy 2.0 模型定义）、`constraints.py`（PostgreSQL 触发器 DDL 与应用层互斥校验函数）
2. **数据库迁移**：编写 Alembic 迁移脚本 `2026_03_07_0001-enterprise_permission_tables.py`，一次性创建 departments、business_lines、enterprise_users、user_department_roles、user_business_lines、special_permissions、task_extensions 共 7 张表，包含全部索引、约束和操作员/审批员互斥触发器
3. **模拟数据**：`tests/fixtures/seed_demo_data.sql` 包含 1 个银行组织、6 个部门、4 条业务线、16 个用户的完整数据集，覆盖权限矩阵中的所有场景组合；`scripts/seed_demo_data.py` 提供 CLI 入口，支持 psycopg2 和 SQLAlchemy 两种导入方式
4. **单元测试**：`tests/unit/test_auth_models.py` 包含 57 个测试用例，覆盖枚举完整性、ID 生成器前缀格式、模型表结构（表名、主键、列、约束、关系）、应用层互斥校验逻辑、DDL 事件注册等

修改文件：`alembic/env.py` 增加了 `import enterprise.auth.models` 以将企业模型注册到 `Base.metadata`，为后续 autogenerate 提供支持。

## 设计决策

### 三维度 RBAC 的表结构选择：多表关联 vs 扁平化单表

传统 RBAC 用一张 user_roles 表即可描述「谁有什么权限」，但金融机构的权限边界由三个正交维度决定：部门（行政归属）、业务线（功能分类）、角色（操作能力）。一个用户可以属于对公信贷部、同时被授权对公贷款和国际结算两条业务线、在部门内担任 operator 角色。

如果将三个维度压到一张表里，比如 `(user_id, dept_id, bl_id, role)`，就会出现笛卡尔积膨胀——一个跨两条业务线的操作员需要两行记录，且业务线变动时需要联动修改多行。最终选择拆为三张关联表：`user_department_roles`（用户-部门-角色）、`user_business_lines`（用户-业务线）、`special_permissions`（跨部门特殊权限），各自独立维护，查询时做 JOIN 组合。

### 操作员/审批员互斥约束的实现层级

金融监管要求创建任务的人不能审批同一任务（双重控制原则），对应到数据模型就是同一用户在同一部门下不能同时持有 operator 和 approver 两个角色。

这个约束跨越多行（同一 user_id + department_id，不同 role 值），无法用单行 CHECK 约束表达。方案对比：

- **应用层校验**：在 INSERT 前先查询是否存在冲突角色，若有则拒绝。优点是错误提示友好、逻辑清晰；缺点是存在竞态条件（两个并发请求可能同时通过校验），且应用层 bug 可能绕过校验
- **数据库触发器**：在 `user_department_roles` 表上创建 BEFORE INSERT OR UPDATE 触发器，由 PostgreSQL 在事务内强制执行。优点是无法被绕过、自带行锁消除竞态；缺点是错误信息对前端不友好

最终采用双层防御：应用层校验 + 数据库触发器。日常请求由应用层返回清晰的错误提示，触发器作为兜底保障，确保即使应用层出现逻辑漏洞，违规数据也无法落库。

### ID 生成策略：复用 Skyvern 的时间戳 ID + 语义前缀

企业模型的主键复用 Skyvern 现有的 `generate_id()` 函数（基于时间戳的数字 ID），各实体类型添加语义前缀（`dept_`、`eu_`、`sp_` 等）。没有选择 UUID 的原因：

- Skyvern 原有的 organizations、tasks 等表已经使用 `org_`、`tsk_` 前缀格式，保持一致性有利于调试时快速识别数据来源
- 带前缀的 ID 在日志中一眼即可辨别实体类型，UUID 则需要反查

### 关联表使用复合主键而非代理键

`user_department_roles` 和 `user_business_lines` 使用 `(user_id, department_id)` / `(user_id, business_line_id)` 作为复合主键，不额外添加自增 ID。复合主键从数据库层面天然阻止了重复分配，语义上也更准确——这些表描述的是「关系」而非「实体」。

## 金融企业场景下的工程意义

**批量授权的基础**：银行一个对公信贷部可能有数十名操作员，逐人配置权限是运维噩梦。三维度模型支持「按部门批量授角色 + 按业务线批量授数据范围」的模式，一次操作可覆盖一组人。

**跨部门监督机制的数据支撑**：风险管理部和合规审计部在银行体系中天然需要穿透式只读权限。`special_permissions` 表通过 `cross_org_read` / `cross_org_approve` 两种类型，将这种跨部门权限从普通的部门-角色体系中独立出来，避免为这两个部门创建大量冗余的部门-角色关联记录。

**审计可追溯**：所有权限记录携带 `created_at` 时间戳，`special_permissions` 额外记录 `granted_by`（授权人）。监管审计时可以回答「谁在什么时候授予了这个人跨部门查看权限」这类问题。

**模拟数据覆盖真实场景**：种子数据刻意包含了离职用户（`is_active=false`）、跨业务线操作员（对公贷款+国际结算）、风控部全组织只读用户、合规部同时拥有 `cross_org_read` 和 `cross_org_approve` 的审批员——这些不是假想场景，而是银行日常运营中的常见角色配置。Day 3 的权限中间件将直接使用这批数据进行边界测试。

## 踩坑记录

1. **SQLAlchemy Column `default` 与 `server_default` 的行为差异**：`TaskExtensionModel` 的 `risk_level` 字段设置了 `default=RiskLevel.LOW.value`，期望在不显式赋值时自动填充 `"low"`。但 SQLAlchemy 的 `default` 参数是 SQL INSERT 时由引擎注入的，纯 Python 层面构造模型实例（不经过 Session）时不会触发。单元测试中直接实例化后断言 `te.risk_level == "low"` 会失败。修正方式：测试改为验证 Column 的 default 配置值，而非运行时属性
2. **Skyvern 的重依赖链拖慢测试启动**：导入 `enterprise.auth.models` 会触发 `skyvern.__init__` → `structlog` → `litellm` 等一系列导入，首次安装需要额外处理。后续 Day 3+ 考虑引入轻量级 mock 来隔离 Skyvern 的导入链，缩短测试冷启动时间
