"""Database-level constraint enforcement for enterprise permission rules.

The operator/approver mutual exclusion constraint cannot be expressed as a
simple CHECK constraint because it spans multiple rows. We implement it as:
1. A database trigger (for PostgreSQL) that fires on INSERT/UPDATE
2. An application-layer validation function as a secondary safeguard
"""

from sqlalchemy import DDL, event

from .models import UserDepartmentRoleModel

# PostgreSQL trigger function: prevents a user from holding both operator and
# approver roles within the same department.
OPERATOR_APPROVER_EXCLUSION_FUNCTION = DDL("""
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

OPERATOR_APPROVER_EXCLUSION_TRIGGER = DDL("""
CREATE TRIGGER trg_operator_approver_exclusion
    BEFORE INSERT OR UPDATE ON user_department_roles
    FOR EACH ROW
    EXECUTE FUNCTION check_operator_approver_exclusion();
""")

# Drop statements for migration rollback
DROP_TRIGGER = DDL("""
DROP TRIGGER IF EXISTS trg_operator_approver_exclusion ON user_department_roles;
""")

DROP_FUNCTION = DDL("""
DROP FUNCTION IF EXISTS check_operator_approver_exclusion();
""")


def register_exclusion_constraint():
    """Register the trigger DDL to fire after table creation."""
    event.listen(
        UserDepartmentRoleModel.__table__,
        "after_create",
        OPERATOR_APPROVER_EXCLUSION_FUNCTION,
    )
    event.listen(
        UserDepartmentRoleModel.__table__,
        "after_create",
        OPERATOR_APPROVER_EXCLUSION_TRIGGER,
    )


async def validate_role_exclusion(session, user_id: str, department_id: str, new_role: str) -> None:
    """Application-layer validation for operator/approver mutual exclusion.

    This is a secondary safeguard in addition to the database trigger.
    Raises ValueError if the role assignment would violate dual control.
    """
    from sqlalchemy import select

    if new_role not in ("operator", "approver"):
        return

    conflicting = "approver" if new_role == "operator" else "operator"
    stmt = select(UserDepartmentRoleModel).where(
        UserDepartmentRoleModel.user_id == user_id,
        UserDepartmentRoleModel.department_id == department_id,
        UserDepartmentRoleModel.role == conflicting,
    )
    result = await session.execute(stmt)
    if result.scalar_one_or_none() is not None:
        raise ValueError(
            f"Dual control violation: user {user_id} cannot hold both "
            f"operator and approver roles in department {department_id}"
        )
