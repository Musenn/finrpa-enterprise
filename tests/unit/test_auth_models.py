"""Unit tests for enterprise auth models, enums, ID generators, and constraints.

Tests cover:
    - Model table structure: table names, columns, constraints, relationships
    - Enum completeness and values
    - ID generator prefix format
    - Application-layer operator/approver mutual exclusion validation
    - DDL constraint registration
"""

import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import inspect as sa_inspect

from enterprise.auth.enums import RiskLevel, RoleType, SpecialPermissionType
from enterprise.auth.id import (
    BUSINESS_LINE_PREFIX,
    DEPARTMENT_PREFIX,
    ENTERPRISE_USER_PREFIX,
    SPECIAL_PERMISSION_PREFIX,
    TASK_EXTENSION_PREFIX,
    generate_business_line_id,
    generate_department_id,
    generate_enterprise_user_id,
    generate_special_permission_id,
    generate_task_extension_id,
)
from enterprise.auth.models import (
    BusinessLineModel,
    DepartmentModel,
    EnterpriseUserModel,
    SpecialPermissionModel,
    TaskExtensionModel,
    UserBusinessLineModel,
    UserDepartmentRoleModel,
)


# ============================================================================
# Enum Tests
# ============================================================================
class TestRoleType:
    def test_all_roles_present(self):
        expected = {"super_admin", "org_admin", "operator", "approver", "viewer"}
        actual = {r.value for r in RoleType}
        assert actual == expected

    def test_str_mixin(self):
        assert str(RoleType.OPERATOR) == "RoleType.OPERATOR"
        assert RoleType.OPERATOR.value == "operator"

    def test_enum_count(self):
        assert len(RoleType) == 5


class TestRiskLevel:
    def test_all_levels_present(self):
        expected = {"low", "medium", "high", "critical"}
        actual = {r.value for r in RiskLevel}
        assert actual == expected

    def test_enum_count(self):
        assert len(RiskLevel) == 4


class TestSpecialPermissionType:
    def test_all_types_present(self):
        expected = {"cross_org_read", "cross_org_approve"}
        actual = {p.value for p in SpecialPermissionType}
        assert actual == expected

    def test_enum_count(self):
        assert len(SpecialPermissionType) == 2


# ============================================================================
# ID Generator Tests
# ============================================================================
class TestIDGenerators:
    def test_department_id_prefix(self):
        id_val = generate_department_id()
        assert id_val.startswith(f"{DEPARTMENT_PREFIX}_")
        assert len(id_val) > len(DEPARTMENT_PREFIX) + 1

    def test_business_line_id_prefix(self):
        id_val = generate_business_line_id()
        assert id_val.startswith(f"{BUSINESS_LINE_PREFIX}_")

    def test_enterprise_user_id_prefix(self):
        id_val = generate_enterprise_user_id()
        assert id_val.startswith(f"{ENTERPRISE_USER_PREFIX}_")

    def test_special_permission_id_prefix(self):
        id_val = generate_special_permission_id()
        assert id_val.startswith(f"{SPECIAL_PERMISSION_PREFIX}_")

    def test_task_extension_id_prefix(self):
        id_val = generate_task_extension_id()
        assert id_val.startswith(f"{TASK_EXTENSION_PREFIX}_")

    def test_ids_are_unique(self):
        ids = {generate_department_id() for _ in range(100)}
        assert len(ids) == 100, "ID generator should produce unique values"


# ============================================================================
# Model Structure Tests
# ============================================================================
class TestDepartmentModel:
    def test_table_name(self):
        assert DepartmentModel.__tablename__ == "departments"

    def test_primary_key(self):
        mapper = sa_inspect(DepartmentModel)
        pk_cols = [c.name for c in mapper.primary_key]
        assert pk_cols == ["department_id"]

    def test_columns_exist(self):
        table = DepartmentModel.__table__
        expected_cols = {
            "department_id", "organization_id", "parent_id",
            "department_name", "department_code",
            "created_at", "modified_at", "deleted_at",
        }
        assert expected_cols.issubset({c.name for c in table.columns})

    def test_self_referential_relationship(self):
        mapper = sa_inspect(DepartmentModel)
        rel_names = {r.key for r in mapper.relationships}
        assert "children" in rel_names
        assert "parent" in rel_names

    def test_nullable_parent_id(self):
        col = DepartmentModel.__table__.c.parent_id
        assert col.nullable is True

    def test_non_nullable_required_fields(self):
        table = DepartmentModel.__table__
        for col_name in ("organization_id", "department_name", "department_code"):
            assert table.c[col_name].nullable is False, f"{col_name} should be NOT NULL"

    def test_unique_constraint_org_dept_code(self):
        constraints = DepartmentModel.__table__.constraints
        uq_names = {c.name for c in constraints if hasattr(c, "name") and c.name}
        assert "uq_org_dept_code" in uq_names


class TestBusinessLineModel:
    def test_table_name(self):
        assert BusinessLineModel.__tablename__ == "business_lines"

    def test_columns_exist(self):
        table = BusinessLineModel.__table__
        expected_cols = {
            "business_line_id", "organization_id",
            "line_name", "line_code",
            "created_at", "modified_at", "deleted_at",
        }
        assert expected_cols.issubset({c.name for c in table.columns})

    def test_unique_constraint_org_line_code(self):
        constraints = BusinessLineModel.__table__.constraints
        uq_names = {c.name for c in constraints if hasattr(c, "name") and c.name}
        assert "uq_org_line_code" in uq_names


class TestEnterpriseUserModel:
    def test_table_name(self):
        assert EnterpriseUserModel.__tablename__ == "enterprise_users"

    def test_primary_key(self):
        mapper = sa_inspect(EnterpriseUserModel)
        pk_cols = [c.name for c in mapper.primary_key]
        assert pk_cols == ["user_id"]

    def test_columns_exist(self):
        table = EnterpriseUserModel.__table__
        expected_cols = {
            "user_id", "organization_id", "username", "password_hash",
            "display_name", "email", "is_active",
            "created_at", "modified_at", "deleted_at",
        }
        assert expected_cols.issubset({c.name for c in table.columns})

    def test_relationships(self):
        mapper = sa_inspect(EnterpriseUserModel)
        rel_names = {r.key for r in mapper.relationships}
        assert "department_roles" in rel_names
        assert "business_lines" in rel_names
        assert "special_permissions" in rel_names

    def test_email_nullable(self):
        col = EnterpriseUserModel.__table__.c.email
        assert col.nullable is True

    def test_unique_constraint_org_username(self):
        constraints = EnterpriseUserModel.__table__.constraints
        uq_names = {c.name for c in constraints if hasattr(c, "name") and c.name}
        assert "uq_org_username" in uq_names


class TestUserDepartmentRoleModel:
    def test_table_name(self):
        assert UserDepartmentRoleModel.__tablename__ == "user_department_roles"

    def test_composite_primary_key(self):
        mapper = sa_inspect(UserDepartmentRoleModel)
        pk_cols = sorted(c.name for c in mapper.primary_key)
        assert pk_cols == ["department_id", "user_id"]

    def test_check_constraint_valid_role(self):
        constraints = UserDepartmentRoleModel.__table__.constraints
        ck_names = {c.name for c in constraints if hasattr(c, "name") and c.name}
        assert "ck_valid_role" in ck_names

    def test_role_constraint_covers_all_roles(self):
        """Verify the CHECK constraint string includes every RoleType value."""
        for constraint in UserDepartmentRoleModel.__table__.constraints:
            if getattr(constraint, "name", None) == "ck_valid_role":
                sql_text = str(constraint.sqltext)
                for role in RoleType:
                    assert role.value in sql_text, f"{role.value} missing from ck_valid_role"
                break
        else:
            pytest.fail("ck_valid_role constraint not found")

    def test_relationships(self):
        mapper = sa_inspect(UserDepartmentRoleModel)
        rel_names = {r.key for r in mapper.relationships}
        assert "user" in rel_names
        assert "department" in rel_names


class TestUserBusinessLineModel:
    def test_table_name(self):
        assert UserBusinessLineModel.__tablename__ == "user_business_lines"

    def test_composite_primary_key(self):
        mapper = sa_inspect(UserBusinessLineModel)
        pk_cols = sorted(c.name for c in mapper.primary_key)
        assert pk_cols == ["business_line_id", "user_id"]


class TestSpecialPermissionModel:
    def test_table_name(self):
        assert SpecialPermissionModel.__tablename__ == "special_permissions"

    def test_check_constraint_valid_permission_type(self):
        constraints = SpecialPermissionModel.__table__.constraints
        ck_names = {c.name for c in constraints if hasattr(c, "name") and c.name}
        assert "ck_valid_permission_type" in ck_names

    def test_unique_constraint_user_permission(self):
        constraints = SpecialPermissionModel.__table__.constraints
        uq_names = {c.name for c in constraints if hasattr(c, "name") and c.name}
        assert "uq_user_permission_type" in uq_names


class TestTaskExtensionModel:
    def test_table_name(self):
        assert TaskExtensionModel.__tablename__ == "task_extensions"

    def test_primary_key(self):
        mapper = sa_inspect(TaskExtensionModel)
        pk_cols = [c.name for c in mapper.primary_key]
        assert pk_cols == ["extension_id"]

    def test_task_id_unique(self):
        col = TaskExtensionModel.__table__.c.task_id
        assert col.unique is True

    def test_check_constraint_valid_risk_level(self):
        constraints = TaskExtensionModel.__table__.constraints
        ck_names = {c.name for c in constraints if hasattr(c, "name") and c.name}
        assert "ck_valid_risk_level" in ck_names

    def test_risk_level_constraint_covers_all_levels(self):
        """Verify the CHECK constraint string includes every RiskLevel value."""
        for constraint in TaskExtensionModel.__table__.constraints:
            if getattr(constraint, "name", None) == "ck_valid_risk_level":
                sql_text = str(constraint.sqltext)
                for level in RiskLevel:
                    assert level.value in sql_text, f"{level.value} missing from ck_valid_risk_level"
                break
        else:
            pytest.fail("ck_valid_risk_level constraint not found")

    def test_business_line_nullable(self):
        col = TaskExtensionModel.__table__.c.business_line_id
        assert col.nullable is True


# ============================================================================
# Application-Layer Constraint Tests
# ============================================================================
class TestValidateRoleExclusion:
    """Test the async validate_role_exclusion function (application-layer guard)."""

    @pytest.fixture
    def mock_session(self):
        session = AsyncMock()
        return session

    @pytest.mark.asyncio
    async def test_non_conflicting_role_skips_check(self, mock_session):
        """Roles other than operator/approver should pass without DB query."""
        from enterprise.auth.constraints import validate_role_exclusion

        await validate_role_exclusion(mock_session, "u1", "d1", "viewer")
        mock_session.execute.assert_not_called()

        await validate_role_exclusion(mock_session, "u1", "d1", "super_admin")
        mock_session.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_operator_when_no_approver_passes(self, mock_session):
        """Adding operator when no conflicting approver exists should succeed."""
        from enterprise.auth.constraints import validate_role_exclusion

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        await validate_role_exclusion(mock_session, "u1", "d1", "operator")
        mock_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_approver_when_no_operator_passes(self, mock_session):
        """Adding approver when no conflicting operator exists should succeed."""
        from enterprise.auth.constraints import validate_role_exclusion

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        await validate_role_exclusion(mock_session, "u1", "d1", "approver")
        mock_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_operator_when_approver_exists_raises(self, mock_session):
        """Adding operator when approver already exists should raise ValueError."""
        from enterprise.auth.constraints import validate_role_exclusion

        existing_record = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing_record
        mock_session.execute.return_value = mock_result

        with pytest.raises(ValueError, match="Dual control violation"):
            await validate_role_exclusion(mock_session, "u1", "d1", "operator")

    @pytest.mark.asyncio
    async def test_approver_when_operator_exists_raises(self, mock_session):
        """Adding approver when operator already exists should raise ValueError."""
        from enterprise.auth.constraints import validate_role_exclusion

        existing_record = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing_record
        mock_session.execute.return_value = mock_result

        with pytest.raises(ValueError, match="Dual control violation"):
            await validate_role_exclusion(mock_session, "u1", "d1", "approver")


# ============================================================================
# DDL Constraint Registration Tests
# ============================================================================
class TestConstraintRegistration:
    def test_register_exclusion_constraint_attaches_events(self):
        """Verify that register_exclusion_constraint attaches DDL events to the table."""
        from enterprise.auth.constraints import (
            OPERATOR_APPROVER_EXCLUSION_FUNCTION,
            OPERATOR_APPROVER_EXCLUSION_TRIGGER,
            register_exclusion_constraint,
        )

        register_exclusion_constraint()

        table = UserDepartmentRoleModel.__table__
        # Check that the DDL objects are in the table's after_create dispatch
        from sqlalchemy import event as sa_event
        assert sa_event.contains(table, "after_create", OPERATOR_APPROVER_EXCLUSION_FUNCTION)
        assert sa_event.contains(table, "after_create", OPERATOR_APPROVER_EXCLUSION_TRIGGER)


# ============================================================================
# Model Instantiation Tests (no DB required)
# ============================================================================
class TestModelInstantiation:
    """Verify models can be instantiated with expected attributes."""

    def test_department_model(self):
        dept = DepartmentModel(
            department_id="dept_test",
            organization_id="org_1",
            department_name="Test Department",
            department_code="TEST",
            created_at=datetime.datetime.utcnow(),
            modified_at=datetime.datetime.utcnow(),
        )
        assert dept.department_id == "dept_test"
        assert dept.organization_id == "org_1"
        assert dept.department_name == "Test Department"
        assert dept.deleted_at is None

    def test_enterprise_user_model(self):
        user = EnterpriseUserModel(
            user_id="eu_test",
            organization_id="org_1",
            username="testuser",
            password_hash="$2b$12$fakehash",
            display_name="Test User",
            email="test@example.com",
            is_active=True,
            created_at=datetime.datetime.utcnow(),
            modified_at=datetime.datetime.utcnow(),
        )
        assert user.user_id == "eu_test"
        assert user.is_active is True
        assert user.email == "test@example.com"

    def test_user_department_role_model(self):
        role = UserDepartmentRoleModel(
            user_id="eu_test",
            department_id="dept_test",
            role=RoleType.OPERATOR.value,
            created_at=datetime.datetime.utcnow(),
        )
        assert role.role == "operator"

    def test_task_extension_model_with_risk(self):
        te = TaskExtensionModel(
            extension_id="te_test",
            task_id="tsk_001",
            organization_id="org_1",
            department_id="dept_test",
            risk_level=RiskLevel.HIGH.value,
            created_by="eu_test",
            created_at=datetime.datetime.utcnow(),
            modified_at=datetime.datetime.utcnow(),
        )
        assert te.risk_level == "high"
        assert te.business_line_id is None

    def test_task_extension_column_default_is_low(self):
        """The Column default should be 'low' (applied at DB INSERT time)."""
        col = TaskExtensionModel.__table__.c.risk_level
        assert col.default.arg == RiskLevel.LOW.value

    def test_special_permission_model(self):
        sp = SpecialPermissionModel(
            permission_id="sp_test",
            user_id="eu_test",
            organization_id="org_1",
            permission_type=SpecialPermissionType.CROSS_ORG_READ.value,
            granted_by="eu_admin",
            created_at=datetime.datetime.utcnow(),
        )
        assert sp.permission_type == "cross_org_read"
        assert sp.granted_by == "eu_admin"
