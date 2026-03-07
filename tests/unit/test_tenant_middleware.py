"""Unit tests for tenant isolation middleware logic."""

import pytest

from enterprise.auth.jwt_service import create_enterprise_token
from enterprise.auth.schemas import DepartmentRole
from enterprise.tenant.middleware import _is_whitelisted


class TestWhitelist:
    def test_login_route_whitelisted(self):
        assert _is_whitelisted("/api/v1/enterprise/auth/login") is True

    def test_health_route_whitelisted(self):
        assert _is_whitelisted("/health") is True

    def test_docs_route_whitelisted(self):
        assert _is_whitelisted("/docs") is True

    def test_openapi_route_whitelisted(self):
        assert _is_whitelisted("/openapi.json") is True

    def test_task_route_not_whitelisted(self):
        assert _is_whitelisted("/api/v1/enterprise/tasks") is False

    def test_random_route_not_whitelisted(self):
        assert _is_whitelisted("/api/v1/run/tasks") is False


class TestTenantContextFromToken:
    """Test that the middleware correctly builds TenantContext from JWT."""

    def _build_token(self, roles, bl_ids, cross_read=False):
        return create_enterprise_token(
            user_id="eu_test",
            org_id="org_1",
            department_roles=[
                DepartmentRole(department_id=d, department_name=n, role=r)
                for d, n, r in roles
            ],
            business_line_ids=bl_ids,
            has_cross_org_read=cross_read,
        )

    def test_normal_operator_context(self):
        """Normal operator should have restricted visibility."""
        from enterprise.auth.jwt_service import decode_enterprise_token
        from enterprise.tenant.context import TenantContext

        token = self._build_token(
            [("dept_cc", "Corp Credit", "operator")],
            ["bl_corp_loan"],
        )
        user_ctx = decode_enterprise_token(token)

        ctx = TenantContext(
            org_id=user_ctx.org_id,
            user_id=user_ctx.user_id,
            visible_department_ids=user_ctx.department_ids,
            visible_business_line_ids=user_ctx.business_line_ids,
            has_full_org_visibility=user_ctx.is_org_admin or user_ctx.has_cross_org_read,
        )

        assert ctx.org_id == "org_1"
        assert ctx.visible_department_ids == ["dept_cc"]
        assert ctx.visible_business_line_ids == ["bl_corp_loan"]
        assert ctx.has_full_org_visibility is False
        assert ctx.is_restricted is True

    def test_admin_context_full_visibility(self):
        """Admin should have full org visibility."""
        from enterprise.auth.jwt_service import decode_enterprise_token
        from enterprise.tenant.context import TenantContext

        token = self._build_token(
            [("dept_it", "IT", "super_admin")],
            [],
        )
        user_ctx = decode_enterprise_token(token)

        ctx = TenantContext(
            org_id=user_ctx.org_id,
            user_id=user_ctx.user_id,
            visible_department_ids=user_ctx.department_ids,
            visible_business_line_ids=user_ctx.business_line_ids,
            has_full_org_visibility=user_ctx.is_org_admin or user_ctx.has_cross_org_read,
        )

        assert ctx.has_full_org_visibility is True
        assert ctx.is_restricted is False

    def test_risk_viewer_full_visibility(self):
        """Risk viewer with cross_org_read should have full visibility."""
        from enterprise.auth.jwt_service import decode_enterprise_token
        from enterprise.tenant.context import TenantContext

        token = self._build_token(
            [("dept_risk", "Risk Mgmt", "viewer")],
            [],
            cross_read=True,
        )
        user_ctx = decode_enterprise_token(token)

        ctx = TenantContext(
            org_id=user_ctx.org_id,
            user_id=user_ctx.user_id,
            visible_department_ids=user_ctx.department_ids,
            visible_business_line_ids=user_ctx.business_line_ids,
            has_full_org_visibility=user_ctx.is_org_admin or user_ctx.has_cross_org_read,
        )

        assert ctx.has_full_org_visibility is True

    def test_cross_bl_operator_context(self):
        """Cross-BL operator should see multiple business lines."""
        from enterprise.auth.jwt_service import decode_enterprise_token
        from enterprise.tenant.context import TenantContext

        token = self._build_token(
            [("dept_cc", "Corp Credit", "operator")],
            ["bl_corp_loan", "bl_intl_settle"],
        )
        user_ctx = decode_enterprise_token(token)

        ctx = TenantContext(
            org_id=user_ctx.org_id,
            user_id=user_ctx.user_id,
            visible_department_ids=user_ctx.department_ids,
            visible_business_line_ids=user_ctx.business_line_ids,
            has_full_org_visibility=False,
        )

        assert ctx.visible_business_line_ids == ["bl_corp_loan", "bl_intl_settle"]
        assert ctx.is_restricted is True
