"""Unit tests for FastAPI authentication dependency functions."""

import pytest
from fastapi import HTTPException

from enterprise.auth.dependencies import (
    get_current_user,
    require_admin,
    require_any_operator,
    require_approver,
    require_cross_org_viewer,
    require_department_operator,
)
from enterprise.auth.jwt_service import create_enterprise_token
from enterprise.auth.schemas import DepartmentRole, UserContext


def _make_token(
    user_id: str = "eu_test",
    org_id: str = "org_1",
    dept_roles: list[tuple[str, str, str]] | None = None,
    bl_ids: list[str] | None = None,
    cross_read: bool = False,
    cross_approve: bool = False,
) -> str:
    if dept_roles is None:
        dept_roles = [("dept_1", "Dept 1", "operator")]
    return create_enterprise_token(
        user_id=user_id,
        org_id=org_id,
        department_roles=[
            DepartmentRole(department_id=d, department_name=n, role=r)
            for d, n, r in dept_roles
        ],
        business_line_ids=bl_ids or [],
        has_cross_org_read=cross_read,
        has_cross_org_approve=cross_approve,
    )


def _make_user_ctx(
    dept_roles: list[tuple[str, str, str]] | None = None,
    cross_read: bool = False,
    cross_approve: bool = False,
) -> UserContext:
    if dept_roles is None:
        dept_roles = [("dept_1", "Dept 1", "operator")]
    return UserContext(
        user_id="eu_test",
        org_id="org_1",
        department_roles=[
            DepartmentRole(department_id=d, department_name=n, role=r)
            for d, n, r in dept_roles
        ],
        business_line_ids=[],
        has_cross_org_read=cross_read,
        has_cross_org_approve=cross_approve,
    )


# ============================================================================
# get_current_user
# ============================================================================
class TestGetCurrentUser:
    @pytest.mark.asyncio
    async def test_missing_header_returns_401(self):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(authorization=None)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_format_returns_401(self):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(authorization="InvalidFormat token123")
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_token_returns_401(self):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(authorization="Bearer invalid.token.here")
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_valid_token_returns_context(self):
        token = _make_token()
        ctx = await get_current_user(authorization=f"Bearer {token}")
        assert ctx.user_id == "eu_test"
        assert ctx.org_id == "org_1"


# ============================================================================
# require_any_operator
# ============================================================================
class TestRequireAnyOperator:
    @pytest.mark.asyncio
    async def test_operator_passes(self):
        user = _make_user_ctx([("d1", "D1", "operator")])
        result = await require_any_operator(user)
        assert result.user_id == "eu_test"

    @pytest.mark.asyncio
    async def test_admin_passes(self):
        user = _make_user_ctx([("d1", "D1", "super_admin")])
        result = await require_any_operator(user)
        assert result.user_id == "eu_test"

    @pytest.mark.asyncio
    async def test_viewer_rejected(self):
        user = _make_user_ctx([("d1", "D1", "viewer")])
        with pytest.raises(HTTPException) as exc_info:
            await require_any_operator(user)
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_approver_rejected(self):
        """Approver is not an operator."""
        user = _make_user_ctx([("d1", "D1", "approver")])
        with pytest.raises(HTTPException) as exc_info:
            await require_any_operator(user)
        assert exc_info.value.status_code == 403


# ============================================================================
# require_approver
# ============================================================================
class TestRequireApprover:
    @pytest.mark.asyncio
    async def test_approver_passes(self):
        user = _make_user_ctx([("d1", "D1", "approver")])
        result = await require_approver(user)
        assert result.user_id == "eu_test"

    @pytest.mark.asyncio
    async def test_admin_passes(self):
        user = _make_user_ctx([("d1", "D1", "org_admin")])
        result = await require_approver(user)
        assert result.user_id == "eu_test"

    @pytest.mark.asyncio
    async def test_operator_rejected(self):
        user = _make_user_ctx([("d1", "D1", "operator")])
        with pytest.raises(HTTPException) as exc_info:
            await require_approver(user)
        assert exc_info.value.status_code == 403


# ============================================================================
# require_cross_org_viewer
# ============================================================================
class TestRequireCrossOrgViewer:
    @pytest.mark.asyncio
    async def test_with_cross_read_passes(self):
        user = _make_user_ctx([("d1", "D1", "viewer")], cross_read=True)
        result = await require_cross_org_viewer(user)
        assert result.user_id == "eu_test"

    @pytest.mark.asyncio
    async def test_admin_passes(self):
        user = _make_user_ctx([("d1", "D1", "org_admin")])
        result = await require_cross_org_viewer(user)
        assert result.user_id == "eu_test"

    @pytest.mark.asyncio
    async def test_without_cross_read_rejected(self):
        user = _make_user_ctx([("d1", "D1", "viewer")])
        with pytest.raises(HTTPException) as exc_info:
            await require_cross_org_viewer(user)
        assert exc_info.value.status_code == 403


# ============================================================================
# require_admin
# ============================================================================
class TestRequireAdmin:
    @pytest.mark.asyncio
    async def test_super_admin_passes(self):
        user = _make_user_ctx([("d1", "D1", "super_admin")])
        result = await require_admin(user)
        assert result.user_id == "eu_test"

    @pytest.mark.asyncio
    async def test_org_admin_passes(self):
        user = _make_user_ctx([("d1", "D1", "org_admin")])
        result = await require_admin(user)
        assert result.user_id == "eu_test"

    @pytest.mark.asyncio
    async def test_operator_rejected(self):
        user = _make_user_ctx([("d1", "D1", "operator")])
        with pytest.raises(HTTPException) as exc_info:
            await require_admin(user)
        assert exc_info.value.status_code == 403


# ============================================================================
# require_department_operator
# ============================================================================
class TestRequireDepartmentOperator:
    @pytest.mark.asyncio
    async def test_operator_in_correct_dept_passes(self):
        user = _make_user_ctx([("dept_1", "Dept 1", "operator")])
        check_fn = require_department_operator("dept_1")
        result = await check_fn(user)
        assert result.user_id == "eu_test"

    @pytest.mark.asyncio
    async def test_operator_in_wrong_dept_rejected(self):
        user = _make_user_ctx([("dept_1", "Dept 1", "operator")])
        check_fn = require_department_operator("dept_2")
        with pytest.raises(HTTPException) as exc_info:
            await check_fn(user)
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_viewer_in_correct_dept_rejected(self):
        user = _make_user_ctx([("dept_1", "Dept 1", "viewer")])
        check_fn = require_department_operator("dept_1")
        with pytest.raises(HTTPException) as exc_info:
            await check_fn(user)
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_in_any_dept_passes(self):
        user = _make_user_ctx([("dept_1", "Dept 1", "super_admin")])
        check_fn = require_department_operator("dept_1")
        result = await check_fn(user)
        assert result.user_id == "eu_test"
