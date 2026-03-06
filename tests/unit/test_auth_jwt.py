"""Unit tests for enterprise JWT service."""

import time

import pytest

from enterprise.auth.jwt_service import create_enterprise_token, decode_enterprise_token
from enterprise.auth.schemas import DepartmentRole


class TestCreateEnterpriseToken:
    def test_creates_valid_token(self):
        token = create_enterprise_token(
            user_id="eu_test",
            org_id="org_1",
            department_roles=[
                DepartmentRole(department_id="dept_1", department_name="Dept 1", role="operator"),
            ],
            business_line_ids=["bl_1"],
        )
        assert isinstance(token, str)
        assert len(token) > 0

    def test_roundtrip_decode(self):
        roles = [
            DepartmentRole(department_id="dept_1", department_name="Dept 1", role="operator"),
            DepartmentRole(department_id="dept_2", department_name="Dept 2", role="viewer"),
        ]
        token = create_enterprise_token(
            user_id="eu_test",
            org_id="org_1",
            department_roles=roles,
            business_line_ids=["bl_1", "bl_2"],
            has_cross_org_read=True,
            has_cross_org_approve=False,
        )
        ctx = decode_enterprise_token(token)
        assert ctx.user_id == "eu_test"
        assert ctx.org_id == "org_1"
        assert len(ctx.department_roles) == 2
        assert ctx.department_roles[0].department_id == "dept_1"
        assert ctx.department_roles[0].role == "operator"
        assert ctx.business_line_ids == ["bl_1", "bl_2"]
        assert ctx.has_cross_org_read is True
        assert ctx.has_cross_org_approve is False

    def test_decode_invalid_token_raises(self):
        from jose import JWTError
        with pytest.raises(JWTError):
            decode_enterprise_token("invalid.token.here")

    def test_special_permissions_in_token(self):
        token = create_enterprise_token(
            user_id="eu_comp",
            org_id="org_1",
            department_roles=[
                DepartmentRole(department_id="dept_comp", department_name="Compliance", role="approver"),
            ],
            business_line_ids=[],
            has_cross_org_read=True,
            has_cross_org_approve=True,
        )
        ctx = decode_enterprise_token(token)
        assert ctx.has_cross_org_read is True
        assert ctx.has_cross_org_approve is True
