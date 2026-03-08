# Day 2 — Permission Data Model 代码清单

## 新增文件

| 文件路径 | 功能说明 |
|---------|---------|
| `enterprise/auth/models.py` | 7 张权限表 SQLAlchemy 模型（Organization/Department/BusinessLine/User/UserDepartmentRole/UserBusinessLine/SpecialPermission） |
| `enterprise/auth/enums.py` | 权限枚举定义（RoleType/PermissionLevel/SpecialPermissionType/IndustryType） |
| `enterprise/auth/constraints.py` | 数据库约束与校验规则（角色互斥/部门唯一性/特殊权限合法性） |
| `enterprise/auth/id.py` | 全局唯一 ID 生成器（UUID + 前缀格式） |
| `alembic/versions/2026_03_07_0001-enterprise_permission_tables.py` | Alembic 迁移脚本：创建 7 张企业权限表及索引 |
| `scripts/seed_demo_data.py` | 种子数据填充脚本（组织/部门/用户/角色关系） |
| `tests/fixtures/seed_demo_data.sql` | SQL 种子数据（演示用组织架构） |
| `tests/unit/test_auth_models.py` | 权限模型单元测试（57 个用例：枚举/约束/ID 生成/模型关系） |

## 修改文件

| 文件路径 | 修改说明 |
|---------|---------|
| `alembic/env.py` | 注册企业权限表 metadata，使 Alembic 能发现新模型 |
