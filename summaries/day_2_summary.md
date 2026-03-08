# Day 2 — 多维度权限数据模型

## 今日改动

完成企业级多维度权限体系的数据库模型层，核心工作分四部分：

1. **7 张权限表**：`enterprise/auth/models.py` 使用 SQLAlchemy 定义完整的组织-部门-用户-权限关系模型——`Organization`（组织/机构，含行业类型）、`Department`（部门，隶属组织）、`BusinessLine`（业务线，隶属组织）、`User`（用户，隶属组织）、`UserDepartmentRole`（用户-部门-角色关联，支持一人多部门）、`UserBusinessLine`（用户-业务线关联，支持跨业务线）、`SpecialPermission`（特殊权限，如 cross_org_read/cross_org_approve）

2. **权限枚举与约束**：`enterprise/auth/enums.py` 定义 4 种核心枚举——`RoleType`（super_admin/org_admin/operator/approver/viewer）、`PermissionLevel`（NONE/READ/OPERATE/APPROVE）、`SpecialPermissionType`（cross_org_read/cross_org_approve）、`IndustryType`（banking/insurance/securities）。`enterprise/auth/constraints.py` 实现数据库级约束——operator/approver 角色互斥（同一用户在同一部门不能同时持有两种角色）、部门唯一性、特殊权限合法性校验

3. **Alembic 迁移**：`alembic/versions/2026_03_07_0001-enterprise_permission_tables.py` 创建全部 7 张表及索引，修改 `alembic/env.py` 注册企业模型 metadata。`scripts/seed_demo_data.py` 和 `tests/fixtures/seed_demo_data.sql` 提供演示用组织架构种子数据

4. **全局唯一 ID**：`enterprise/auth/id.py` 实现带前缀的 UUID 生成器（如 `org_xxxx`、`dept_xxxx`、`user_xxxx`），在数据库 ID 中直接体现实体类型，便于日志排查和跨表关联

新增测试 57 个，全部通过。

## 设计决策

| 决策 | 理由 |
|------|------|
| 一人多部门多角色模型 | 金融机构中同一员工可能在多个部门任职（如风控部+信贷部），扁平的 user-role 无法表达这种多维关系 |
| operator/approver 互斥约束 | 金融合规要求"操作与审批分离"（dual control），同一用户在同一部门不能既是操作者又是审批者 |
| 业务线独立于部门 | 银行的业务线（对公/零售/同业）与行政部门（信贷部/风控部）正交，用户可能属于信贷部但负责对公和零售两条业务线 |
| 特殊权限单独建表 | cross_org_read 等穿透权限是少数用户（风控/合规）的特权，混入角色表会增加查询复杂度 |
| 带前缀的 UUID | `org_`、`dept_`、`user_` 前缀让日志和调试输出中的 ID 可读性大幅提升 |

## 踩坑记录

1. **SQLAlchemy 2.0 的 mapped_column 语法**：Skyvern 使用 SQLAlchemy 2.0，声明式模型需要 `mapped_column()` 而非旧版的 `Column()`，否则类型检查器会报错
2. **Alembic autogenerate 的局限性**：复合唯一约束（如 `(user_id, department_id)` 在 `UserDepartmentRole` 上）需要在迁移脚本中手动添加，`alembic revision --autogenerate` 不会自动检测 Python 层面定义的 `UniqueConstraint`
