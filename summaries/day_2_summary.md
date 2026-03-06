# Day 2 - Multi-Dimensional Permission Data Model

## Changes

### New Files
| File | Description |
|------|-------------|
| `enterprise/auth/enums.py` | Three enum classes: `RoleType` (5 roles), `RiskLevel` (4 levels), `SpecialPermissionType` (2 cross-org permissions) |
| `enterprise/auth/id.py` | ID generator functions reusing Skyvern's `generate_id()` with enterprise-specific prefixes (`dept_`, `bl_`, `eu_`, `sp_`, `te_`) |
| `enterprise/auth/models.py` | 7 SQLAlchemy 2.0 async models covering the full permission schema |
| `enterprise/auth/constraints.py` | PostgreSQL trigger DDL for operator/approver mutual exclusion + application-layer async validation |
| `alembic/versions/2026_03_07_0001-enterprise_permission_tables.py` | Alembic migration creating all 7 tables with indexes, constraints, and the exclusion trigger |
| `tests/fixtures/seed_demo_data.sql` | Demo dataset: 1 org, 6 departments, 4 business lines, 16 users with full role/permission assignments |
| `scripts/seed_demo_data.py` | CLI script to import seed SQL into PostgreSQL (supports psycopg2 and SQLAlchemy fallback) |
| `tests/unit/test_auth_models.py` | 57 unit tests covering enums, ID generators, model structure, constraints, and validation logic |

### Modified Files
| File | Change |
|------|--------|
| `alembic/env.py` | Added `import enterprise.auth.models` to register enterprise models with `Base.metadata` for autogenerate support |

## Design Decisions

### Three-Dimensional RBAC: Department x Business Line x Role

Traditional flat RBAC (user -> role -> permission) is insufficient for financial institutions. A bank operator's access scope is determined by three orthogonal dimensions:

1. **Department** - organizational hierarchy (Corporate Credit, Personal Finance, etc.)
2. **Business Line** - functional classification (Corp Loan, Retail Credit, Wealth Mgmt, etc.)
3. **Role** - action capability (operator, approver, viewer, admin)

This design uses three separate association tables rather than a single flattened permission table. The rationale: a user can belong to one department with role X, while simultaneously being authorized on multiple business lines. Embedding all three dimensions into a single row would create a Cartesian explosion and complicate queries.

### Operator/Approver Mutual Exclusion (Dual Control)

Financial regulations require separation of duties: the person who initiates a transaction cannot be the same person who approves it. This is enforced at two layers:

1. **Database trigger** (`check_operator_approver_exclusion`): Fires on INSERT/UPDATE to `user_department_roles`. This is the authoritative enforcement - it cannot be bypassed by application bugs.
2. **Application validation** (`validate_role_exclusion`): An async function that checks before attempting the INSERT. This provides a clean error message before hitting the database, improving UX.

A CHECK constraint was not viable because the exclusion spans multiple rows (same user_id + department_id, different role values). PostgreSQL does not support multi-row CHECK constraints.

### ID Generation Strategy

Enterprise models reuse Skyvern's existing `generate_id()` function, which produces timestamp-based numeric IDs. Each entity type prepends a semantic prefix (`dept_`, `eu_`, etc.). This approach was chosen over UUIDs for two reasons:
- Consistency with Skyvern's existing ID patterns (e.g., `org_`, `tsk_`)
- Prefix-based IDs are immediately human-readable in logs and debug sessions

### Composite Primary Keys on Association Tables

`user_department_roles` and `user_business_lines` use composite primary keys (user_id + department_id / business_line_id) instead of surrogate keys. This naturally prevents duplicate assignments at the database level without additional unique constraints, and aligns with the semantic meaning of these tables as relationship mappings.

## Financial Enterprise Context

### Problem Addressed
In a bank with 50+ departments and dozens of business lines, manually managing individual user permissions is operationally infeasible and audit-risky. This data model enables:

- **Batch authorization**: Assign a role at the department level; all users in that department inherit the role's capabilities scoped to their assigned business lines.
- **Cross-department oversight**: Risk management and compliance departments need read access across all departments. The `special_permissions` table grants this without polluting per-department role assignments.
- **Audit traceability**: Every permission has a `created_at` timestamp and `granted_by` field, supporting regulatory audit trails.

### Seed Data Design
The demo dataset models a realistic bank structure (China Merchants Bank) with:
- An inactive user (for testing deactivation logic)
- A cross-business-line operator (Corp Loan + International Settlement)
- Risk viewers with `cross_org_read` permissions
- Compliance approvers with both `cross_org_read` and `cross_org_approve`

These scenarios directly map to permission matrix test cases that will be validated in Day 3's auth middleware.

## Issues Encountered

1. **SQLAlchemy Column `default` vs `server_default`**: The `default` parameter on a Column is a Python-side default applied during `__init__`. However, when constructing model instances without a database session (e.g., in unit tests), `default` values backed by callables may not behave as expected. For `risk_level`, the default is a string constant (`"low"`), but it only applies at INSERT time, not at Python object construction. Unit tests were adjusted to verify the Column's default configuration rather than testing runtime attribute values on detached instances.

2. **Skyvern dependency chain in tests**: Importing `enterprise.auth.models` triggers `skyvern.__init__`, which in turn imports `structlog`, `litellm`, and other heavy dependencies. For Day 2 unit tests this is acceptable, but Day 3+ should consider a lightweight test fixture that mocks the Skyvern import chain to reduce test startup time.
