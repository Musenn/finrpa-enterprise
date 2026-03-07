"""Tests for approval operation API routes.

Tests cover:
- Permission enforcement (non-approver gets 403)
- Pending list filtering by org and department
- Approve/reject lifecycle
- Cross-department isolation
- Conflict detection (double-approve)
"""

import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from enterprise.auth.schemas import DepartmentRole, UserContext
from enterprise.approval.models import ApprovalStatus
from enterprise.approval.routes import router, configure_store


def _make_app() -> FastAPI:
    app = FastAPI()
    app.include_router(router)
    return app


def _make_user(
    user_id="eu_1",
    org_id="org_1",
    dept_roles=None,
    bl_ids=None,
    cross_org_approve=False,
) -> UserContext:
    if dept_roles is None:
        dept_roles = [DepartmentRole(department_id="dept_a", department_name="Dept A", role="approver")]
    return UserContext(
        user_id=user_id,
        org_id=org_id,
        department_roles=dept_roles,
        business_line_ids=bl_ids or [],
        has_cross_org_read=False,
        has_cross_org_approve=cross_org_approve,
    )


def _make_operator_user(user_id="eu_op", org_id="org_1") -> UserContext:
    return UserContext(
        user_id=user_id,
        org_id=org_id,
        department_roles=[DepartmentRole(department_id="dept_a", department_name="Dept A", role="operator")],
        business_line_ids=[],
    )


def _make_approval(
    approval_id="apr_1",
    task_id="task_1",
    org_id="org_1",
    department_id="dept_src",
    approver_department_id="dept_a",
    risk_level="high",
    status="pending",
):
    return {
        "approval_id": approval_id,
        "task_id": task_id,
        "organization_id": org_id,
        "department_id": department_id,
        "business_line_id": None,
        "risk_level": risk_level,
        "risk_reason": "Contains high-risk keywords",
        "operation_description": "Wire transfer",
        "screenshot_path": None,
        "approver_department_id": approver_department_id,
        "approver_role": "approver",
        "notify_department_ids": None,
        "status": status,
        "requested_at": "2026-03-07T10:00:00",
        "timeout_seconds": 3600,
    }


class TestApprovalPermission(unittest.IsolatedAsyncioTestCase):
    """Test that non-approver users get 403."""

    def setUp(self):
        self.app = _make_app()
        self.store = {}
        configure_store(self.store)

    async def test_operator_cannot_list_pending(self):
        from enterprise.auth.dependencies import require_approver as real_dep
        from fastapi import HTTPException
        operator = _make_operator_user()
        with self.assertRaises(HTTPException) as ctx:
            await real_dep(operator)
        assert ctx.exception.status_code == 403

    async def test_operator_cannot_approve(self):
        from enterprise.auth.dependencies import require_approver as real_dep
        from fastapi import HTTPException
        operator = _make_operator_user()
        with self.assertRaises(HTTPException) as ctx:
            await real_dep(operator)
        assert ctx.exception.status_code == 403


class TestListPendingApprovals(unittest.TestCase):
    """Test GET /enterprise/approvals/pending."""

    def setUp(self):
        self.app = _make_app()
        self.store = {}
        configure_store(self.store)
        self.approver = _make_user()

    def _override_deps(self, user: UserContext):
        from enterprise.auth.dependencies import require_approver, get_current_user
        self.app.dependency_overrides[require_approver] = lambda: user
        self.app.dependency_overrides[get_current_user] = lambda: user

    def test_empty_store(self):
        self._override_deps(self.approver)
        client = TestClient(self.app)
        resp = client.get("/enterprise/approvals/pending")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_pending_in_same_org_and_dept(self):
        self.store["apr_1"] = _make_approval()
        self._override_deps(self.approver)
        client = TestClient(self.app)
        resp = client.get("/enterprise/approvals/pending")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["approval_id"] == "apr_1"

    def test_excludes_different_org(self):
        self.store["apr_1"] = _make_approval(org_id="org_other")
        self._override_deps(self.approver)
        client = TestClient(self.app)
        resp = client.get("/enterprise/approvals/pending")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_excludes_non_pending(self):
        self.store["apr_1"] = _make_approval(status="approved")
        self._override_deps(self.approver)
        client = TestClient(self.app)
        resp = client.get("/enterprise/approvals/pending")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_excludes_wrong_department(self):
        """Approver in dept_a should not see approvals routed to dept_b."""
        self.store["apr_1"] = _make_approval(approver_department_id="dept_b")
        self._override_deps(self.approver)
        client = TestClient(self.app)
        resp = client.get("/enterprise/approvals/pending")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_admin_sees_all_departments(self):
        """Org admin sees approvals for any department in the same org."""
        self.store["apr_1"] = _make_approval(approver_department_id="dept_b")
        admin = _make_user(
            dept_roles=[DepartmentRole(department_id="dept_a", department_name="A", role="org_admin")],
        )
        self._override_deps(admin)
        client = TestClient(self.app)
        resp = client.get("/enterprise/approvals/pending")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_cross_org_approve_sees_all_departments(self):
        """User with cross_org_approve sees approvals for any department."""
        self.store["apr_1"] = _make_approval(approver_department_id="dept_z")
        user = _make_user(cross_org_approve=True)
        self._override_deps(user)
        client = TestClient(self.app)
        resp = client.get("/enterprise/approvals/pending")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_multiple_approvals_filtered(self):
        """Only returns matching approvals."""
        self.store["apr_1"] = _make_approval(approval_id="apr_1")
        self.store["apr_2"] = _make_approval(approval_id="apr_2", org_id="org_other")
        self.store["apr_3"] = _make_approval(approval_id="apr_3", status="rejected")
        self.store["apr_4"] = _make_approval(approval_id="apr_4", approver_department_id="dept_b")
        self.store["apr_5"] = _make_approval(approval_id="apr_5")  # should be visible
        self._override_deps(self.approver)
        client = TestClient(self.app)
        resp = client.get("/enterprise/approvals/pending")
        assert resp.status_code == 200
        ids = [a["approval_id"] for a in resp.json()]
        assert "apr_1" in ids
        assert "apr_5" in ids
        assert "apr_2" not in ids
        assert "apr_3" not in ids
        assert "apr_4" not in ids


class TestApproveRequest(unittest.TestCase):
    """Test POST /enterprise/approvals/{id}/approve."""

    def setUp(self):
        self.app = _make_app()
        self.store = {}
        configure_store(self.store)
        self.approver = _make_user()

    def _override_deps(self, user: UserContext):
        from enterprise.auth.dependencies import require_approver, get_current_user
        self.app.dependency_overrides[require_approver] = lambda: user
        self.app.dependency_overrides[get_current_user] = lambda: user

    def test_approve_success(self):
        self.store["apr_1"] = _make_approval()
        self._override_deps(self.approver)
        client = TestClient(self.app)
        resp = client.post("/enterprise/approvals/apr_1/approve", json={"note": "Looks good"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "approved"
        assert data["approval_id"] == "apr_1"
        # Verify store updated
        assert self.store["apr_1"]["status"] == ApprovalStatus.APPROVED.value
        assert self.store["apr_1"]["approver_user_id"] == "eu_1"
        assert self.store["apr_1"]["decision_note"] == "Looks good"

    def test_approve_not_found(self):
        self._override_deps(self.approver)
        client = TestClient(self.app)
        resp = client.post("/enterprise/approvals/apr_999/approve", json={})
        assert resp.status_code == 404

    def test_approve_wrong_org(self):
        self.store["apr_1"] = _make_approval(org_id="org_other")
        self._override_deps(self.approver)
        client = TestClient(self.app)
        resp = client.post("/enterprise/approvals/apr_1/approve", json={})
        assert resp.status_code == 403

    def test_approve_wrong_department(self):
        self.store["apr_1"] = _make_approval(approver_department_id="dept_b")
        self._override_deps(self.approver)
        client = TestClient(self.app)
        resp = client.post("/enterprise/approvals/apr_1/approve", json={})
        assert resp.status_code == 403

    def test_approve_already_approved(self):
        self.store["apr_1"] = _make_approval(status="approved")
        self._override_deps(self.approver)
        client = TestClient(self.app)
        resp = client.post("/enterprise/approvals/apr_1/approve", json={})
        assert resp.status_code == 409

    def test_approve_already_rejected(self):
        self.store["apr_1"] = _make_approval(status="rejected")
        self._override_deps(self.approver)
        client = TestClient(self.app)
        resp = client.post("/enterprise/approvals/apr_1/approve", json={})
        assert resp.status_code == 409

    def test_approve_already_timeout(self):
        self.store["apr_1"] = _make_approval(status="timeout")
        self._override_deps(self.approver)
        client = TestClient(self.app)
        resp = client.post("/enterprise/approvals/apr_1/approve", json={})
        assert resp.status_code == 409

    def test_approve_empty_note(self):
        self.store["apr_1"] = _make_approval()
        self._override_deps(self.approver)
        client = TestClient(self.app)
        resp = client.post("/enterprise/approvals/apr_1/approve", json={})
        assert resp.status_code == 200
        assert self.store["apr_1"]["decision_note"] == ""


class TestRejectRequest(unittest.TestCase):
    """Test POST /enterprise/approvals/{id}/reject."""

    def setUp(self):
        self.app = _make_app()
        self.store = {}
        configure_store(self.store)
        self.approver = _make_user()

    def _override_deps(self, user: UserContext):
        from enterprise.auth.dependencies import require_approver, get_current_user
        self.app.dependency_overrides[require_approver] = lambda: user
        self.app.dependency_overrides[get_current_user] = lambda: user

    def test_reject_success(self):
        self.store["apr_1"] = _make_approval()
        self._override_deps(self.approver)
        client = TestClient(self.app)
        resp = client.post("/enterprise/approvals/apr_1/reject", json={"note": "Too risky"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "rejected"
        assert self.store["apr_1"]["status"] == ApprovalStatus.REJECTED.value
        assert self.store["apr_1"]["decision_note"] == "Too risky"

    def test_reject_not_found(self):
        self._override_deps(self.approver)
        client = TestClient(self.app)
        resp = client.post("/enterprise/approvals/apr_999/reject", json={})
        assert resp.status_code == 404

    def test_reject_wrong_org(self):
        self.store["apr_1"] = _make_approval(org_id="org_other")
        self._override_deps(self.approver)
        client = TestClient(self.app)
        resp = client.post("/enterprise/approvals/apr_1/reject", json={})
        assert resp.status_code == 403

    def test_reject_wrong_department(self):
        self.store["apr_1"] = _make_approval(approver_department_id="dept_b")
        self._override_deps(self.approver)
        client = TestClient(self.app)
        resp = client.post("/enterprise/approvals/apr_1/reject", json={})
        assert resp.status_code == 403

    def test_reject_already_processed(self):
        self.store["apr_1"] = _make_approval(status="approved")
        self._override_deps(self.approver)
        client = TestClient(self.app)
        resp = client.post("/enterprise/approvals/apr_1/reject", json={})
        assert resp.status_code == 409


class TestFullApprovalFlow(unittest.TestCase):
    """Integration test: create -> list -> approve -> verify state."""

    def setUp(self):
        self.app = _make_app()
        self.store = {}
        configure_store(self.store)
        self.approver = _make_user()

    def _override_deps(self, user: UserContext):
        from enterprise.auth.dependencies import require_approver, get_current_user
        self.app.dependency_overrides[require_approver] = lambda: user
        self.app.dependency_overrides[get_current_user] = lambda: user

    def test_full_approve_flow(self):
        """Simulate: task triggers risk -> approval created -> listed -> approved."""
        # Step 1: Simulate approval request creation (done by risk engine)
        self.store["apr_flow"] = _make_approval(approval_id="apr_flow")

        self._override_deps(self.approver)
        client = TestClient(self.app)

        # Step 2: Approver sees pending
        resp = client.get("/enterprise/approvals/pending")
        assert resp.status_code == 200
        ids = [a["approval_id"] for a in resp.json()]
        assert "apr_flow" in ids

        # Step 3: Approver approves
        resp = client.post(
            "/enterprise/approvals/apr_flow/approve",
            json={"note": "Verified with customer"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "approved"

        # Step 4: No longer in pending list
        resp = client.get("/enterprise/approvals/pending")
        ids = [a["approval_id"] for a in resp.json()]
        assert "apr_flow" not in ids

        # Step 5: Store reflects final state
        assert self.store["apr_flow"]["status"] == "approved"
        assert self.store["apr_flow"]["approver_user_id"] == "eu_1"

    def test_full_reject_flow(self):
        """Simulate: approval created -> listed -> rejected."""
        self.store["apr_rej"] = _make_approval(approval_id="apr_rej")
        self._override_deps(self.approver)
        client = TestClient(self.app)

        # Reject
        resp = client.post(
            "/enterprise/approvals/apr_rej/reject",
            json={"note": "Amount exceeds limit"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "rejected"

        # Verify no longer pending
        resp = client.get("/enterprise/approvals/pending")
        ids = [a["approval_id"] for a in resp.json()]
        assert "apr_rej" not in ids

    def test_department_isolation(self):
        """Approvals routed to dept_a are not visible to dept_b approver."""
        self.store["apr_a"] = _make_approval(
            approval_id="apr_a", approver_department_id="dept_a"
        )
        self.store["apr_b"] = _make_approval(
            approval_id="apr_b", approver_department_id="dept_b"
        )

        # dept_a approver
        approver_a = _make_user(
            user_id="eu_a",
            dept_roles=[DepartmentRole(department_id="dept_a", department_name="A", role="approver")],
        )
        self._override_deps(approver_a)
        client = TestClient(self.app)

        resp = client.get("/enterprise/approvals/pending")
        ids = [a["approval_id"] for a in resp.json()]
        assert "apr_a" in ids
        assert "apr_b" not in ids

        # dept_b approver
        approver_b = _make_user(
            user_id="eu_b",
            dept_roles=[DepartmentRole(department_id="dept_b", department_name="B", role="approver")],
        )
        self._override_deps(approver_b)

        resp = client.get("/enterprise/approvals/pending")
        ids = [a["approval_id"] for a in resp.json()]
        assert "apr_b" in ids
        assert "apr_a" not in ids


if __name__ == "__main__":
    unittest.main()
