"""Unit tests for tenant context ContextVar lifecycle."""

import pytest

from enterprise.tenant.context import (
    TenantContext,
    get_tenant_context,
    require_tenant_context,
    reset_tenant_context,
    set_tenant_context,
)


class TestTenantContext:
    def test_default_is_none(self):
        assert get_tenant_context() is None

    def test_set_and_get(self):
        ctx = TenantContext(
            org_id="org_1",
            user_id="u_1",
            visible_department_ids=["d1", "d2"],
            visible_business_line_ids=["bl1"],
        )
        token = set_tenant_context(ctx)
        try:
            assert get_tenant_context() is ctx
            assert get_tenant_context().org_id == "org_1"
            assert get_tenant_context().visible_department_ids == ["d1", "d2"]
        finally:
            reset_tenant_context(token)

    def test_reset_restores_none(self):
        ctx = TenantContext(org_id="org_1", user_id="u_1")
        token = set_tenant_context(ctx)
        reset_tenant_context(token)
        assert get_tenant_context() is None

    def test_require_raises_when_not_set(self):
        with pytest.raises(RuntimeError, match="Tenant context not available"):
            require_tenant_context()

    def test_require_returns_context_when_set(self):
        ctx = TenantContext(org_id="org_1", user_id="u_1")
        token = set_tenant_context(ctx)
        try:
            result = require_tenant_context()
            assert result is ctx
        finally:
            reset_tenant_context(token)

    def test_is_restricted_when_no_full_visibility(self):
        ctx = TenantContext(
            org_id="org_1",
            user_id="u_1",
            has_full_org_visibility=False,
        )
        assert ctx.is_restricted is True

    def test_is_not_restricted_when_full_visibility(self):
        ctx = TenantContext(
            org_id="org_1",
            user_id="u_1",
            has_full_org_visibility=True,
        )
        assert ctx.is_restricted is False

    def test_frozen_immutability(self):
        ctx = TenantContext(org_id="org_1", user_id="u_1")
        with pytest.raises(AttributeError):
            ctx.org_id = "changed"

    def test_nested_set_and_reset(self):
        """Verify nested context works correctly (e.g., for sub-requests)."""
        outer = TenantContext(org_id="org_outer", user_id="u_outer")
        inner = TenantContext(org_id="org_inner", user_id="u_inner")

        token_outer = set_tenant_context(outer)
        assert get_tenant_context().org_id == "org_outer"

        token_inner = set_tenant_context(inner)
        assert get_tenant_context().org_id == "org_inner"

        reset_tenant_context(token_inner)
        assert get_tenant_context().org_id == "org_outer"

        reset_tenant_context(token_outer)
        assert get_tenant_context() is None
