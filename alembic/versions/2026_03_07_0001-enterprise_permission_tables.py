"""Create enterprise permission tables.

Revision ID: ent_001
Revises: None (appended to existing Skyvern migrations)
Create Date: 2026-03-07

Tables created:
    - departments
    - business_lines
    - enterprise_users
    - user_department_roles
    - user_business_lines
    - special_permissions
    - task_extensions

Constraints:
    - operator/approver mutual exclusion trigger on user_department_roles
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision = "ent_001"
down_revision = None  # Will be set to the latest Skyvern migration
branch_labels = ("enterprise",)
depends_on = None


def upgrade() -> None:
    # --- departments ---
    op.create_table(
        "departments",
        sa.Column("department_id", sa.String(), primary_key=True),
        sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.organization_id"), nullable=False),
        sa.Column("parent_id", sa.String(), sa.ForeignKey("departments.department_id"), nullable=True),
        sa.Column("department_name", sa.String(), nullable=False),
        sa.Column("department_code", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("modified_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("organization_id", "department_code", name="uq_org_dept_code"),
        sa.Index("idx_dept_org", "organization_id"),
        sa.Index("idx_dept_parent", "parent_id"),
    )

    # --- business_lines ---
    op.create_table(
        "business_lines",
        sa.Column("business_line_id", sa.String(), primary_key=True),
        sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.organization_id"), nullable=False),
        sa.Column("line_name", sa.String(), nullable=False),
        sa.Column("line_code", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("modified_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("organization_id", "line_code", name="uq_org_line_code"),
        sa.Index("idx_bl_org", "organization_id"),
    )

    # --- enterprise_users ---
    op.create_table(
        "enterprise_users",
        sa.Column("user_id", sa.String(), primary_key=True),
        sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.organization_id"), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("modified_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("organization_id", "username", name="uq_org_username"),
        sa.Index("idx_eu_org", "organization_id"),
    )

    # --- user_department_roles ---
    op.create_table(
        "user_department_roles",
        sa.Column("user_id", sa.String(), sa.ForeignKey("enterprise_users.user_id"), primary_key=True),
        sa.Column("department_id", sa.String(), sa.ForeignKey("departments.department_id"), primary_key=True),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "role IN ('super_admin', 'org_admin', 'operator', 'approver', 'viewer')",
            name="ck_valid_role",
        ),
    )

    # --- user_business_lines ---
    op.create_table(
        "user_business_lines",
        sa.Column("user_id", sa.String(), sa.ForeignKey("enterprise_users.user_id"), primary_key=True),
        sa.Column("business_line_id", sa.String(), sa.ForeignKey("business_lines.business_line_id"), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    # --- special_permissions ---
    op.create_table(
        "special_permissions",
        sa.Column("permission_id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("enterprise_users.user_id"), nullable=False),
        sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.organization_id"), nullable=False),
        sa.Column("permission_type", sa.String(), nullable=False),
        sa.Column("granted_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "permission_type", name="uq_user_permission_type"),
        sa.CheckConstraint(
            "permission_type IN ('cross_org_read', 'cross_org_approve')",
            name="ck_valid_permission_type",
        ),
        sa.Index("idx_sp_user", "user_id"),
    )

    # --- task_extensions ---
    op.create_table(
        "task_extensions",
        sa.Column("extension_id", sa.String(), primary_key=True),
        sa.Column("task_id", sa.String(), nullable=False, unique=True),
        sa.Column("organization_id", sa.String(), sa.ForeignKey("organizations.organization_id"), nullable=False),
        sa.Column("department_id", sa.String(), sa.ForeignKey("departments.department_id"), nullable=False),
        sa.Column("business_line_id", sa.String(), sa.ForeignKey("business_lines.business_line_id"), nullable=True),
        sa.Column("risk_level", sa.String(), nullable=False, server_default="low"),
        sa.Column("created_by", sa.String(), sa.ForeignKey("enterprise_users.user_id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("modified_at", sa.DateTime(), nullable=False),
        sa.Index("idx_te_org_dept", "organization_id", "department_id"),
        sa.Index("idx_te_org_bl", "organization_id", "business_line_id"),
        sa.Index("idx_te_task", "task_id"),
        sa.CheckConstraint(
            "risk_level IN ('low', 'medium', 'high', 'critical')",
            name="ck_valid_risk_level",
        ),
    )

    # --- operator/approver mutual exclusion trigger ---
    op.execute("""
        CREATE OR REPLACE FUNCTION check_operator_approver_exclusion()
        RETURNS TRIGGER AS $$
        DECLARE
            conflicting_role TEXT;
        BEGIN
            IF NEW.role = 'operator' THEN
                SELECT role INTO conflicting_role
                FROM user_department_roles
                WHERE user_id = NEW.user_id
                  AND department_id = NEW.department_id
                  AND role = 'approver';
            ELSIF NEW.role = 'approver' THEN
                SELECT role INTO conflicting_role
                FROM user_department_roles
                WHERE user_id = NEW.user_id
                  AND department_id = NEW.department_id
                  AND role = 'operator';
            END IF;

            IF conflicting_role IS NOT NULL THEN
                RAISE EXCEPTION 'Dual control violation: user % cannot hold both operator and approver roles in department %',
                    NEW.user_id, NEW.department_id;
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trg_operator_approver_exclusion
            BEFORE INSERT OR UPDATE ON user_department_roles
            FOR EACH ROW
            EXECUTE FUNCTION check_operator_approver_exclusion();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_operator_approver_exclusion ON user_department_roles;")
    op.execute("DROP FUNCTION IF EXISTS check_operator_approver_exclusion();")
    op.drop_table("task_extensions")
    op.drop_table("special_permissions")
    op.drop_table("user_business_lines")
    op.drop_table("user_department_roles")
    op.drop_table("enterprise_users")
    op.drop_table("business_lines")
    op.drop_table("departments")
