"""Unit tests for the multi-dimensional permission resolver.

Covers all 6 permission matrix scenarios from the project spec:
1. Normal operator - own dept + own BL
2. Cross-BL operator - own dept + multiple BLs
3. Department approver - own dept approval queue
4. Risk viewer (cross-org read) - all tasks read-only
5. Compliance approver (cross-org read + approve) - all tasks + approve
6. Admin - everything
"""

import pytest

from enterprise.auth.permission import PermissionLevel, resolve_permission
from enterprise.auth.schemas import DepartmentRole, UserContext

# Constants matching seed data
ORG = "o_demo_cmb"
DEPT_CORP_CREDIT = "dept_corp_credit"
DEPT_PERSONAL_FIN = "dept_personal_fin"
DEPT_ASSET_MGMT = "dept_asset_mgmt"
DEPT_RISK_MGMT = "dept_risk_mgmt"
DEPT_COMPLIANCE = "dept_compliance"
DEPT_IT = "dept_it"
BL_CORP_LOAN = "bl_corp_loan"
BL_RETAIL_CREDIT = "bl_retail_credit"
BL_WEALTH_MGMT = "bl_wealth_mgmt"
BL_INTL_SETTLE = "bl_intl_settle"


def _make_user(
    user_id: str,
    dept_roles: list[tuple[str, str, str]],
    bl_ids: list[str],
    cross_read: bool = False,
    cross_approve: bool = False,
) -> UserContext:
    return UserContext(
        user_id=user_id,
        org_id=ORG,
        department_roles=[
            DepartmentRole(department_id=d, department_name=n, role=r)
            for d, n, r in dept_roles
        ],
        business_line_ids=bl_ids,
        has_cross_org_read=cross_read,
        has_cross_org_approve=cross_approve,
    )


# ============================================================================
# Scenario 1: Normal operator (Corp Credit + Corp Loan)
# ============================================================================
class TestNormalOperator:
    @pytest.fixture
    def operator(self):
        return _make_user(
            "eu_cc_op1",
            [(DEPT_CORP_CREDIT, "对公信贷部", "operator")],
            [BL_CORP_LOAN],
        )

    def test_own_dept_own_bl_can_operate(self, operator):
        perm = resolve_permission(operator, ORG, DEPT_CORP_CREDIT, BL_CORP_LOAN)
        assert perm == PermissionLevel.OPERATE

    def test_own_dept_no_bl_can_operate(self, operator):
        """Resource in own department without BL should still grant dept-level access."""
        perm = resolve_permission(operator, ORG, DEPT_CORP_CREDIT, None)
        assert perm == PermissionLevel.OPERATE

    def test_other_dept_no_access(self, operator):
        perm = resolve_permission(operator, ORG, DEPT_PERSONAL_FIN, BL_RETAIL_CREDIT)
        assert perm == PermissionLevel.NONE

    def test_own_bl_other_dept_can_operate(self, operator):
        """Resource in different dept but same BL -> still accessible via BL."""
        perm = resolve_permission(operator, ORG, DEPT_PERSONAL_FIN, BL_CORP_LOAN)
        assert perm == PermissionLevel.OPERATE

    def test_different_org_no_access(self, operator):
        perm = resolve_permission(operator, "other_org", DEPT_CORP_CREDIT, BL_CORP_LOAN)
        assert perm == PermissionLevel.NONE


# ============================================================================
# Scenario 2: Cross-BL operator (Corp Credit + Corp Loan + Intl Settlement)
# ============================================================================
class TestCrossBusinessLineOperator:
    @pytest.fixture
    def cross_op(self):
        return _make_user(
            "eu_cc_cross",
            [(DEPT_CORP_CREDIT, "对公信贷部", "operator")],
            [BL_CORP_LOAN, BL_INTL_SETTLE],
        )

    def test_first_bl_access(self, cross_op):
        perm = resolve_permission(cross_op, ORG, DEPT_CORP_CREDIT, BL_CORP_LOAN)
        assert perm == PermissionLevel.OPERATE

    def test_second_bl_access(self, cross_op):
        perm = resolve_permission(cross_op, ORG, DEPT_CORP_CREDIT, BL_INTL_SETTLE)
        assert perm == PermissionLevel.OPERATE

    def test_intl_settle_other_dept_via_bl(self, cross_op):
        """Resource in different dept but in user's BL -> accessible."""
        perm = resolve_permission(cross_op, ORG, DEPT_ASSET_MGMT, BL_INTL_SETTLE)
        assert perm == PermissionLevel.OPERATE

    def test_unrelated_bl_no_access(self, cross_op):
        perm = resolve_permission(cross_op, ORG, DEPT_PERSONAL_FIN, BL_RETAIL_CREDIT)
        assert perm == PermissionLevel.NONE


# ============================================================================
# Scenario 3: Department approver (Corp Credit + Corp Loan, approver role)
# ============================================================================
class TestDepartmentApprover:
    @pytest.fixture
    def approver(self):
        return _make_user(
            "eu_cc_approver",
            [(DEPT_CORP_CREDIT, "对公信贷部", "approver")],
            [BL_CORP_LOAN],
        )

    def test_own_dept_can_approve(self, approver):
        perm = resolve_permission(approver, ORG, DEPT_CORP_CREDIT, BL_CORP_LOAN)
        assert perm == PermissionLevel.APPROVE

    def test_other_dept_no_access(self, approver):
        perm = resolve_permission(approver, ORG, DEPT_PERSONAL_FIN, BL_RETAIL_CREDIT)
        assert perm == PermissionLevel.NONE


# ============================================================================
# Scenario 4: Risk viewer (cross-org read, viewer role in risk dept)
# ============================================================================
class TestRiskViewer:
    @pytest.fixture
    def risk_viewer(self):
        return _make_user(
            "eu_risk_viewer1",
            [(DEPT_RISK_MGMT, "风险管理部", "viewer")],
            [],
            cross_read=True,
        )

    def test_own_dept_read(self, risk_viewer):
        perm = resolve_permission(risk_viewer, ORG, DEPT_RISK_MGMT, None)
        assert perm == PermissionLevel.READ

    def test_other_dept_cross_org_read(self, risk_viewer):
        """Cross-org read grants READ to any department in the org."""
        perm = resolve_permission(risk_viewer, ORG, DEPT_CORP_CREDIT, BL_CORP_LOAN)
        assert perm == PermissionLevel.READ

    def test_cannot_operate(self, risk_viewer):
        perm = resolve_permission(risk_viewer, ORG, DEPT_CORP_CREDIT, BL_CORP_LOAN)
        assert perm != PermissionLevel.OPERATE

    def test_cannot_approve(self, risk_viewer):
        perm = resolve_permission(risk_viewer, ORG, DEPT_CORP_CREDIT, BL_CORP_LOAN)
        assert perm != PermissionLevel.APPROVE


# ============================================================================
# Scenario 5: Compliance approver (cross-org read + approve)
# ============================================================================
class TestComplianceApprover:
    @pytest.fixture
    def comp_approver(self):
        return _make_user(
            "eu_comp_approver",
            [(DEPT_COMPLIANCE, "合规审计部", "approver")],
            [],
            cross_read=True,
            cross_approve=True,
        )

    def test_own_dept_approve(self, comp_approver):
        perm = resolve_permission(comp_approver, ORG, DEPT_COMPLIANCE, None)
        assert perm == PermissionLevel.APPROVE

    def test_other_dept_cross_org_approve(self, comp_approver):
        """Cross-org approve grants APPROVE to any department in the org."""
        perm = resolve_permission(comp_approver, ORG, DEPT_CORP_CREDIT, BL_CORP_LOAN)
        assert perm == PermissionLevel.APPROVE

    def test_any_bl_approve(self, comp_approver):
        perm = resolve_permission(comp_approver, ORG, DEPT_PERSONAL_FIN, BL_RETAIL_CREDIT)
        assert perm == PermissionLevel.APPROVE


# ============================================================================
# Scenario 6: Admin (super_admin in IT dept)
# ============================================================================
class TestAdmin:
    @pytest.fixture
    def admin(self):
        return _make_user(
            "eu_admin",
            [(DEPT_IT, "信息技术部", "super_admin")],
            [],
        )

    def test_own_dept_full_access(self, admin):
        perm = resolve_permission(admin, ORG, DEPT_IT, None)
        assert perm == PermissionLevel.APPROVE

    def test_any_dept_full_access(self, admin):
        perm = resolve_permission(admin, ORG, DEPT_CORP_CREDIT, BL_CORP_LOAN)
        assert perm == PermissionLevel.APPROVE

    def test_any_bl_full_access(self, admin):
        perm = resolve_permission(admin, ORG, DEPT_PERSONAL_FIN, BL_RETAIL_CREDIT)
        assert perm == PermissionLevel.APPROVE

    def test_different_org_no_access(self, admin):
        perm = resolve_permission(admin, "other_org", DEPT_CORP_CREDIT, BL_CORP_LOAN)
        assert perm == PermissionLevel.NONE


# ============================================================================
# Edge Cases
# ============================================================================
class TestEdgeCases:
    def test_viewer_only_read(self):
        viewer = _make_user(
            "eu_cc_viewer",
            [(DEPT_CORP_CREDIT, "对公信贷部", "viewer")],
            [BL_CORP_LOAN],
        )
        perm = resolve_permission(viewer, ORG, DEPT_CORP_CREDIT, BL_CORP_LOAN)
        assert perm == PermissionLevel.READ

    def test_user_with_no_roles(self):
        empty = _make_user("eu_empty", [], [])
        perm = resolve_permission(empty, ORG, DEPT_CORP_CREDIT, BL_CORP_LOAN)
        assert perm == PermissionLevel.NONE

    def test_inactive_user_context_still_resolves(self):
        """Permission resolver doesn't check is_active; that's the login layer's job."""
        user = _make_user(
            "eu_inactive",
            [(DEPT_PERSONAL_FIN, "个人金融部", "operator")],
            [BL_RETAIL_CREDIT],
        )
        perm = resolve_permission(user, ORG, DEPT_PERSONAL_FIN, BL_RETAIL_CREDIT)
        assert perm == PermissionLevel.OPERATE

    def test_compliance_viewer_cross_org_read_only(self):
        """Compliance viewer: cross_org_read but NOT cross_org_approve."""
        comp_viewer = _make_user(
            "eu_comp_viewer",
            [(DEPT_COMPLIANCE, "合规审计部", "viewer")],
            [],
            cross_read=True,
            cross_approve=False,
        )
        perm = resolve_permission(comp_viewer, ORG, DEPT_CORP_CREDIT, BL_CORP_LOAN)
        assert perm == PermissionLevel.READ
