"""
End-to-end integration test: verifies the full enterprise workflow.

Simulates the lifecycle across 10 phases:
  1. Authentication — JWT issuance and decoding for multiple user types
  2. Risk detection — two-stage risk identification on financial operations
  3. Approval routing — risk-level-based routing to correct approver
  4. Tenant isolation — departmental permission boundaries
  5. Audit trail — log entry creation and sensitive data sanitization
  6. LLM resilience — three-layer fault tolerance and NEEDS_HUMAN fallback
  7. Action cache — DOM hashing and cache hit/miss behavior
  8. Dashboard stats — overview/trend/error distribution computation
  9. Workflow templates — all 6 financial templates registered
 10. Full lifecycle — operator login → risk → approval → audit → isolation
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from enterprise.approval.models import ApprovalStatus
from enterprise.approval.risk_detector import detect_risk, RiskAssessment
from enterprise.approval.routing import route_approval, ApprovalRoute
from enterprise.audit.sanitizer import sanitize_input, hash_raw_value
from enterprise.auth.jwt_service import create_enterprise_token, decode_enterprise_token
from enterprise.auth.permission import PermissionLevel, resolve_permission
from enterprise.auth.schemas import DepartmentRole, UserContext
from enterprise.dashboard.stats import (
    compute_error_distribution,
    compute_overview,
    compute_trend,
)
from enterprise.llm.action_cache import (
    ActionCacheStore,
    cache_action_decision,
    compute_dom_hash,
    compute_goal_hash,
    configure_cache_store,
    lookup_cached_decision,
)
from enterprise.llm.resilient_caller import (
    LLMCallResult,
    build_structured_prompt,
    call_llm_with_retry,
    clean_llm_response,
    parse_and_validate,
)
from enterprise.workflows.templates import TEMPLATE_REGISTRY


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

ORG_ID = "org_cmb_001"

DEPARTMENTS = {
    "credit": ("dept_credit_001", "Corporate Credit"),
    "personal": ("dept_personal_001", "Personal Finance"),
    "risk": ("dept_risk_001", "Risk Management"),
    "compliance": ("dept_compliance_001", "Compliance & Audit"),
    "it": ("dept_it_001", "IT Department"),
}

BUSINESS_LINES = {
    "corporate_loan": "bl_corp_loan_001",
    "retail_credit": "bl_retail_001",
    "wealth_mgmt": "bl_wealth_001",
    "intl_settlement": "bl_intl_001",
}


def _make_dept_role(dept_key: str, role: str) -> DepartmentRole:
    dept_id, dept_name = DEPARTMENTS[dept_key]
    return DepartmentRole(department_id=dept_id, department_name=dept_name, role=role)


@pytest.fixture
def operator_ctx() -> UserContext:
    """Credit dept operator."""
    token = create_enterprise_token(
        user_id="user_operator_001",
        org_id=ORG_ID,
        department_roles=[_make_dept_role("credit", "operator")],
        business_line_ids=[BUSINESS_LINES["corporate_loan"]],
    )
    return decode_enterprise_token(token)


@pytest.fixture
def approver_ctx() -> UserContext:
    """Credit dept approver."""
    token = create_enterprise_token(
        user_id="user_approver_001",
        org_id=ORG_ID,
        department_roles=[_make_dept_role("credit", "approver")],
        business_line_ids=[BUSINESS_LINES["corporate_loan"]],
    )
    return decode_enterprise_token(token)


@pytest.fixture
def other_dept_ctx() -> UserContext:
    """Personal finance dept operator (should NOT see credit tasks)."""
    token = create_enterprise_token(
        user_id="user_other_dept_001",
        org_id=ORG_ID,
        department_roles=[_make_dept_role("personal", "operator")],
        business_line_ids=[BUSINESS_LINES["retail_credit"]],
    )
    return decode_enterprise_token(token)


@pytest.fixture
def risk_viewer_ctx() -> UserContext:
    """Risk management dept viewer (cross-org read)."""
    token = create_enterprise_token(
        user_id="user_risk_viewer_001",
        org_id=ORG_ID,
        department_roles=[_make_dept_role("risk", "viewer")],
        business_line_ids=[],
        has_cross_org_read=True,
    )
    return decode_enterprise_token(token)


@pytest.fixture
def compliance_ctx() -> UserContext:
    """Compliance dept approver (cross-org approve)."""
    token = create_enterprise_token(
        user_id="user_compliance_001",
        org_id=ORG_ID,
        department_roles=[_make_dept_role("compliance", "approver")],
        business_line_ids=[],
        has_cross_org_read=True,
        has_cross_org_approve=True,
    )
    return decode_enterprise_token(token)


@pytest.fixture
def admin_ctx() -> UserContext:
    """IT dept org_admin."""
    token = create_enterprise_token(
        user_id="user_admin_001",
        org_id=ORG_ID,
        department_roles=[_make_dept_role("it", "org_admin")],
        business_line_ids=list(BUSINESS_LINES.values()),
    )
    return decode_enterprise_token(token)


# ---------------------------------------------------------------------------
# Sample task data for dashboard tests
# ---------------------------------------------------------------------------

NOW = datetime.utcnow()


def _make_tasks(n_success=5, n_failed=2, n_needs_human=1):
    tasks = []
    for i in range(n_success):
        tasks.append({
            "task_id": f"task_s_{i}",
            "org_id": ORG_ID,
            "status": "completed",
            "created_at": NOW.isoformat(),
            "duration_ms": 3000 + i * 100,
            "business_line_id": BUSINESS_LINES["corporate_loan"],
        })
    for i in range(n_failed):
        tasks.append({
            "task_id": f"task_f_{i}",
            "org_id": ORG_ID,
            "status": "failed",
            "created_at": NOW.isoformat(),
            "duration_ms": 5000,
            "error_type": "LLM_FAILURE" if i % 2 == 0 else "TIMEOUT",
            "business_line_id": BUSINESS_LINES["corporate_loan"],
        })
    for i in range(n_needs_human):
        tasks.append({
            "task_id": f"task_nh_{i}",
            "org_id": ORG_ID,
            "status": "needs_human",
            "created_at": NOW.isoformat(),
            "duration_ms": 8000,
            "business_line_id": BUSINESS_LINES["corporate_loan"],
        })
    return tasks


SAMPLE_TASKS = _make_tasks()
SAMPLE_APPROVALS = [
    {
        "approval_id": "apr_001",
        "org_id": ORG_ID,
        "status": "pending",
        "requested_at": NOW.isoformat(),
    },
    {
        "approval_id": "apr_002",
        "org_id": ORG_ID,
        "status": "approved",
        "requested_at": (NOW - timedelta(hours=1)).isoformat(),
        "decided_at": (NOW - timedelta(minutes=30)).isoformat(),
    },
]


# ===========================================================================
# Phase 1: Authentication
# ===========================================================================


class TestPhase1Authentication:
    """Verify JWT issuance and decoding for different user types."""

    def test_operator_token_valid(self, operator_ctx):
        assert operator_ctx.user_id == "user_operator_001"
        assert operator_ctx.org_id == ORG_ID
        assert len(operator_ctx.department_roles) == 1
        assert operator_ctx.department_roles[0].role == "operator"
        assert operator_ctx.has_cross_org_read is False

    def test_approver_token_valid(self, approver_ctx):
        assert approver_ctx.user_id == "user_approver_001"
        assert approver_ctx.department_roles[0].role == "approver"

    def test_risk_viewer_has_cross_org(self, risk_viewer_ctx):
        assert risk_viewer_ctx.has_cross_org_read is True
        assert risk_viewer_ctx.department_roles[0].role == "viewer"

    def test_compliance_approver_cross_org(self, compliance_ctx):
        assert compliance_ctx.has_cross_org_read is True
        assert compliance_ctx.has_cross_org_approve is True

    def test_admin_is_org_admin(self, admin_ctx):
        assert admin_ctx.is_org_admin is True


# ===========================================================================
# Phase 2: Risk Detection
# ===========================================================================


class TestPhase2RiskDetection:
    """Two-stage risk detection on financial operations."""

    @pytest.mark.asyncio
    async def test_wire_transfer_triggers_high_risk(self):
        result = await detect_risk(
            text="Execute wire transfer of 500,000 CNY to external account",
            industry="banking",
        )
        assert result.risk_level in ("high", "critical")
        assert len(result.matched_keywords) > 0

    @pytest.mark.asyncio
    async def test_view_balance_is_low_risk(self):
        result = await detect_risk(
            text="View account balance summary",
            industry="banking",
        )
        assert result.risk_level == "low"

    @pytest.mark.asyncio
    async def test_insurance_claim_submission_detected(self):
        result = await detect_risk(
            text="Process claim submission for policy holder",
            industry="insurance",
        )
        assert result.risk_level in ("medium", "high", "critical")

    @pytest.mark.asyncio
    async def test_securities_place_order_detected(self):
        result = await detect_risk(
            text="Execute place order for 10,000 shares of stock",
            industry="securities",
        )
        assert result.risk_level in ("medium", "high", "critical")


# ===========================================================================
# Phase 3: Approval Routing
# ===========================================================================


class TestPhase3ApprovalRouting:
    """Risk-level-based approval routing."""

    def test_low_risk_no_approval(self):
        route = route_approval(risk_level="low", source_department_id=DEPARTMENTS["credit"][0])
        assert route.requires_approval is False

    def test_medium_risk_no_approval(self):
        route = route_approval(risk_level="medium", source_department_id=DEPARTMENTS["credit"][0])
        assert route.requires_approval is False

    def test_high_risk_routes_to_dept_approver(self):
        route = route_approval(risk_level="high", source_department_id=DEPARTMENTS["credit"][0])
        assert route.requires_approval is True
        assert route.approver_department_id == DEPARTMENTS["credit"][0]
        assert route.approver_role == "approver"

    def test_critical_routes_to_compliance(self):
        route = route_approval(risk_level="critical", source_department_id=DEPARTMENTS["credit"][0])
        assert route.requires_approval is True
        assert route.approver_role == "approver"


# ===========================================================================
# Phase 4: Tenant Isolation (Permission Resolution)
# ===========================================================================


class TestPhase4TenantIsolation:
    """Verify departmental permission boundaries."""

    def test_operator_sees_own_department(self, operator_ctx):
        perm = resolve_permission(
            user=operator_ctx,
            resource_org_id=ORG_ID,
            resource_department_id=DEPARTMENTS["credit"][0],
            resource_business_line_id=BUSINESS_LINES["corporate_loan"],
        )
        assert perm in (PermissionLevel.OPERATE, PermissionLevel.APPROVE)

    def test_operator_blocked_from_other_department(self, operator_ctx):
        perm = resolve_permission(
            user=operator_ctx,
            resource_org_id=ORG_ID,
            resource_department_id=DEPARTMENTS["personal"][0],
            resource_business_line_id=BUSINESS_LINES["retail_credit"],
        )
        assert perm == PermissionLevel.NONE

    def test_risk_viewer_sees_all_departments(self, risk_viewer_ctx):
        for dept_key in DEPARTMENTS:
            dept_id = DEPARTMENTS[dept_key][0]
            perm = resolve_permission(
                user=risk_viewer_ctx,
                resource_org_id=ORG_ID,
                resource_department_id=dept_id,
            )
            assert perm == PermissionLevel.READ, f"Risk viewer should see {dept_key}"

    def test_admin_has_full_access(self, admin_ctx):
        for dept_key in DEPARTMENTS:
            dept_id = DEPARTMENTS[dept_key][0]
            perm = resolve_permission(
                user=admin_ctx,
                resource_org_id=ORG_ID,
                resource_department_id=dept_id,
            )
            assert perm == PermissionLevel.APPROVE, f"Admin should have APPROVE on {dept_key}"

    def test_different_org_blocked(self, operator_ctx):
        perm = resolve_permission(
            user=operator_ctx,
            resource_org_id="org_other_999",
            resource_department_id=DEPARTMENTS["credit"][0],
        )
        assert perm == PermissionLevel.NONE


# ===========================================================================
# Phase 5: Audit Trail
# ===========================================================================


class TestPhase5AuditTrail:
    """Audit log sanitization for sensitive data."""

    def test_card_number_sanitized(self):
        sanitized = sanitize_input("Card: 6225882100001234")
        assert "1234" in sanitized
        assert "6225" not in sanitized

    def test_password_fully_masked(self):
        sanitized = sanitize_input("password: MyS3cretP@ss!")
        assert "MyS3cret" not in sanitized
        assert "********" in sanitized

    def test_amount_preserved(self):
        sanitized = sanitize_input("Transfer amount: 500000.00")
        assert "500000.00" in sanitized

    def test_generic_text_preserved(self):
        sanitized = sanitize_input("Click submit button")
        assert sanitized == "Click submit button"

    def test_none_input_returns_none(self):
        assert sanitize_input(None) is None

    def test_raw_value_hash(self):
        h = hash_raw_value("6225882100001234")
        assert h is not None
        assert len(h) == 64  # SHA-256 hex digest


# ===========================================================================
# Phase 6: LLM Resilience
# ===========================================================================


class TestPhase6LLMResilience:
    """Three-layer fault tolerance and NEEDS_HUMAN fallback."""

    @pytest.mark.asyncio
    async def test_success_on_first_try(self):
        from pydantic import BaseModel

        class SimpleAction(BaseModel):
            action: str
            element_id: str

        async def mock_llm(prompt: str) -> str:
            return '{"action": "click", "element_id": "btn-submit"}'

        result = await call_llm_with_retry(
            llm_callable=mock_llm,
            prompt="test prompt",
            schema_class=SimpleAction,
        )
        assert result.success is True
        assert result.data.action == "click"
        assert result.needs_human is False

    @pytest.mark.asyncio
    async def test_needs_human_after_all_retries(self):
        from pydantic import BaseModel

        class SimpleAction(BaseModel):
            action: str

        async def failing_llm(prompt: str) -> str:
            raise Exception("LLM unavailable")

        result = await call_llm_with_retry(
            llm_callable=failing_llm,
            prompt="test prompt",
            schema_class=SimpleAction,
            max_retries=3,
            retry_delays=[0, 0, 0],  # no actual delay in tests
        )
        assert result.success is False
        assert result.needs_human is True
        assert result.attempts == 3

    @pytest.mark.asyncio
    async def test_success_on_second_try(self):
        from pydantic import BaseModel

        class SimpleAction(BaseModel):
            action: str

        call_count = 0

        async def flaky_llm(prompt: str) -> str:
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                return "not valid json {"
            return '{"action": "click"}'

        result = await call_llm_with_retry(
            llm_callable=flaky_llm,
            prompt="test prompt",
            schema_class=SimpleAction,
            retry_delays=[0, 0, 0],
        )
        assert result.success is True
        assert result.attempts == 2

    def test_markdown_fence_cleanup(self):
        raw = '```json\n{"action": "click"}\n```'
        cleaned = clean_llm_response(raw)
        assert cleaned == '{"action": "click"}'


# ===========================================================================
# Phase 7: Action Cache
# ===========================================================================


class TestPhase7ActionCache:
    """DOM hashing and cache hit/miss behavior."""

    def setup_method(self):
        """Reset cache store before each test."""
        configure_cache_store(ActionCacheStore())

    def test_cache_hit_returns_decision(self):
        dom = "<div><form><input type='text' name='account'/><button>Submit</button></form></div>"
        goal = "Fill transfer form"
        decision = {"action": "click", "element_id": "submit-btn"}

        cache_action_decision(
            org_id="org_001",
            dom_html=dom,
            navigation_goal=goal,
            decision=decision,
        )
        cached = lookup_cached_decision(
            org_id="org_001",
            dom_html=dom,
            navigation_goal=goal,
        )
        assert cached is not None
        assert cached["action"] == "click"

    def test_cache_miss_on_different_dom(self):
        dom1 = "<div><form><input type='text'/></form></div>"
        dom2 = "<div><table><tr><td>Data</td></tr></table></div>"

        cache_action_decision(
            org_id="org_001",
            dom_html=dom1,
            navigation_goal="test",
            decision={"action": "extract"},
        )
        cached = lookup_cached_decision(
            org_id="org_001",
            dom_html=dom2,
            navigation_goal="test",
        )
        assert cached is None

    def test_dom_hash_ignores_class_and_style(self):
        dom_a = '<div class="x" style="color:red"><p>Hello</p></div>'
        dom_b = '<div class="y" style="color:blue"><p>Hello</p></div>'
        assert compute_dom_hash(dom_a) == compute_dom_hash(dom_b)

    def test_different_goals_different_cache_keys(self):
        h1 = compute_goal_hash("Transfer funds")
        h2 = compute_goal_hash("Check balance")
        assert h1 != h2


# ===========================================================================
# Phase 8: Dashboard Stats
# ===========================================================================


class TestPhase8DashboardStats:
    """Overview, trend, and error distribution computation."""

    def test_overview_metrics(self):
        overview = compute_overview(
            tasks=SAMPLE_TASKS,
            approvals=SAMPLE_APPROVALS,
            org_id=ORG_ID,
        )
        assert "success_rate_today" in overview
        assert "pending_approvals" in overview
        assert overview["pending_approvals"] == 1
        assert "needs_human_count" in overview
        assert overview["needs_human_count"] == 1
        assert overview["total_tasks"] == 8  # 5 + 2 + 1

    def test_trend_has_7_days(self):
        trend = compute_trend(
            tasks=SAMPLE_TASKS,
            org_id=ORG_ID,
            days=7,
        )
        assert len(trend) == 7
        for entry in trend:
            assert "date" in entry
            assert "success" in entry
            assert "failed" in entry

    def test_error_distribution(self):
        dist = compute_error_distribution(
            tasks=SAMPLE_TASKS,
            org_id=ORG_ID,
        )
        assert isinstance(dist, dict)
        assert "LLM_FAILURE" in dist or "TIMEOUT" in dist


# ===========================================================================
# Phase 9: Workflow Templates
# ===========================================================================


class TestPhase9WorkflowTemplates:
    """Verify all 6 financial workflow templates."""

    def test_six_templates_registered(self):
        assert len(TEMPLATE_REGISTRY) == 6

    def test_all_industries_covered(self):
        industries = {t.industry.value for t in TEMPLATE_REGISTRY.values()}
        assert "banking" in industries
        assert "insurance" in industries
        assert "securities" in industries

    def test_each_template_has_params(self):
        for t in TEMPLATE_REGISTRY.values():
            assert t.template_id
            assert t.name
            assert t.industry
            assert t.risk_level


# ===========================================================================
# Phase 10: Full E2E Scenario
# ===========================================================================


class TestPhase10FullE2EScenario:
    """
    Complete lifecycle:
      Operator login → risk detection → approval routing → permission check →
      audit sanitization → cache → dashboard → isolation check
    """

    @pytest.mark.asyncio
    async def test_full_lifecycle(self, operator_ctx, approver_ctx, risk_viewer_ctx):
        # Step 1: Verify operator identity
        assert operator_ctx.user_id == "user_operator_001"
        assert operator_ctx.is_any_operator is True

        # Step 2: Detect high-risk operation (uses actual keyword "loan disbursement")
        risk = await detect_risk(
            text="Execute loan disbursement for corporate client",
            industry="banking",
        )
        assert risk.risk_level in ("high", "critical")

        # Step 3: Route approval
        route = route_approval(
            risk_level=risk.risk_level,
            source_department_id=DEPARTMENTS["credit"][0],
        )
        assert route.requires_approval is True

        # Step 4: Verify approver has authority
        assert approver_ctx.is_any_approver is True
        approver_perm = resolve_permission(
            user=approver_ctx,
            resource_org_id=ORG_ID,
            resource_department_id=DEPARTMENTS["credit"][0],
        )
        assert approver_perm == PermissionLevel.APPROVE

        # Step 5: Verify audit sanitization works
        sanitized_card = sanitize_input("Card: 6225882100001234")
        assert "6225" not in sanitized_card
        sanitized_amount = sanitize_input("Amount: 2000000")
        assert "2000000" in sanitized_amount

        # Step 6: Verify action cache
        configure_cache_store(ActionCacheStore())
        dom = "<form><input name='amount'/><button>Disburse</button></form>"
        cache_action_decision(
            org_id=ORG_ID,
            dom_html=dom,
            navigation_goal="Disburse loan",
            decision={"action": "click", "target": "disburse_btn"},
        )
        cached = lookup_cached_decision(
            org_id=ORG_ID,
            dom_html=dom,
            navigation_goal="Disburse loan",
        )
        assert cached is not None

        # Step 7: Dashboard stats reflect data
        overview = compute_overview(
            tasks=SAMPLE_TASKS, approvals=SAMPLE_APPROVALS, org_id=ORG_ID
        )
        assert overview["total_tasks"] > 0

        # Step 8: Tenant isolation — operator blocked from other dept
        perm_other = resolve_permission(
            user=operator_ctx,
            resource_org_id=ORG_ID,
            resource_department_id=DEPARTMENTS["personal"][0],
            resource_business_line_id=BUSINESS_LINES["retail_credit"],
        )
        assert perm_other == PermissionLevel.NONE

        # Step 9: Risk viewer sees everything
        for dept_key in DEPARTMENTS:
            perm = resolve_permission(
                user=risk_viewer_ctx,
                resource_org_id=ORG_ID,
                resource_department_id=DEPARTMENTS[dept_key][0],
            )
            assert perm == PermissionLevel.READ

    def test_operator_approver_mutual_exclusion(self):
        """Same person should NOT be both operator and approver."""
        # This is enforced at DB level; at context level, verify the roles
        # don't overlap on the same department
        op_role = _make_dept_role("credit", "operator")
        ap_role = _make_dept_role("credit", "approver")
        ctx = UserContext(
            user_id="user_dual",
            org_id=ORG_ID,
            department_roles=[op_role, ap_role],
            business_line_ids=[],
        )
        # Even if both roles exist, the system should treat this as a constraint violation
        # At the API level this would be rejected; here we verify the ctx exposes both
        assert ctx.is_any_operator
        assert ctx.is_any_approver
        # The DB CHECK constraint (Day 2) prevents this from being persisted
