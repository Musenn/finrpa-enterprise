"""Unit tests for tenant-based query filtering logic.

Tests the filter_task_extensions function and apply_tenant_filter
by verifying the SQL WHERE clauses they produce.
"""

import pytest
from sqlalchemy import select

from enterprise.auth.models import TaskExtensionModel
from enterprise.tenant.context import (
    TenantContext,
    reset_tenant_context,
    set_tenant_context,
)
from enterprise.tenant.query_filter import apply_tenant_filter


class TestApplyTenantFilter:
    def _get_where_str(self, query) -> str:
        """Compile a query to string for inspection."""
        return str(query.compile(compile_kwargs={"literal_binds": True}))

    def test_no_context_returns_unmodified_query(self):
        """Without tenant context, query should pass through unchanged."""
        query = select(TaskExtensionModel)
        original_str = self._get_where_str(query)
        filtered = apply_tenant_filter(query, TaskExtensionModel)
        assert self._get_where_str(filtered) == original_str

    def test_full_visibility_filters_by_org_only(self):
        ctx = TenantContext(
            org_id="org_1",
            user_id="u_admin",
            has_full_org_visibility=True,
        )
        token = set_tenant_context(ctx)
        try:
            query = select(TaskExtensionModel)
            filtered = apply_tenant_filter(query, TaskExtensionModel)
            sql = self._get_where_str(filtered)
            assert "organization_id" in sql
            assert "'org_1'" in sql
            # Should NOT have department_id or business_line_id filter
            assert "department_id IN" not in sql
            assert "business_line_id IN" not in sql
        finally:
            reset_tenant_context(token)

    def test_restricted_filters_by_dept_and_bl(self):
        ctx = TenantContext(
            org_id="org_1",
            user_id="u_op",
            visible_department_ids=["dept_cc"],
            visible_business_line_ids=["bl_corp_loan"],
            has_full_org_visibility=False,
        )
        token = set_tenant_context(ctx)
        try:
            query = select(TaskExtensionModel)
            filtered = apply_tenant_filter(query, TaskExtensionModel)
            sql = self._get_where_str(filtered)
            assert "'org_1'" in sql
            assert "'dept_cc'" in sql
            assert "'bl_corp_loan'" in sql
        finally:
            reset_tenant_context(token)

    def test_cross_bl_includes_both_lines(self):
        ctx = TenantContext(
            org_id="org_1",
            user_id="u_cross",
            visible_department_ids=["dept_cc"],
            visible_business_line_ids=["bl_corp_loan", "bl_intl_settle"],
            has_full_org_visibility=False,
        )
        token = set_tenant_context(ctx)
        try:
            query = select(TaskExtensionModel)
            filtered = apply_tenant_filter(query, TaskExtensionModel)
            sql = self._get_where_str(filtered)
            assert "'bl_corp_loan'" in sql
            assert "'bl_intl_settle'" in sql
        finally:
            reset_tenant_context(token)

    def test_no_dept_no_bl_returns_no_data(self):
        """User with no departments and no BLs should see nothing."""
        ctx = TenantContext(
            org_id="org_1",
            user_id="u_empty",
            visible_department_ids=[],
            visible_business_line_ids=[],
            has_full_org_visibility=False,
        )
        token = set_tenant_context(ctx)
        try:
            query = select(TaskExtensionModel)
            filtered = apply_tenant_filter(query, TaskExtensionModel)
            sql = self._get_where_str(filtered)
            # Should produce an impossible condition
            assert "__no_access__" in sql
        finally:
            reset_tenant_context(token)

    def test_dept_only_no_bl(self):
        """User with departments but no business lines."""
        ctx = TenantContext(
            org_id="org_1",
            user_id="u_dept_only",
            visible_department_ids=["dept_risk"],
            visible_business_line_ids=[],
            has_full_org_visibility=False,
        )
        token = set_tenant_context(ctx)
        try:
            query = select(TaskExtensionModel)
            filtered = apply_tenant_filter(query, TaskExtensionModel)
            sql = self._get_where_str(filtered)
            assert "'dept_risk'" in sql
        finally:
            reset_tenant_context(token)
