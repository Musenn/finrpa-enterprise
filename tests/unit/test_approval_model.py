"""Tests for the approval request data model."""

import datetime
import unittest

from sqlalchemy import inspect

from enterprise.approval.models import (
    ApprovalRequestModel,
    ApprovalStatus,
    DEFAULT_TIMEOUTS,
    generate_approval_id,
)


class TestApprovalStatus(unittest.TestCase):
    """Test ApprovalStatus enum."""

    def test_pending_value(self):
        assert ApprovalStatus.PENDING.value == "pending"

    def test_approved_value(self):
        assert ApprovalStatus.APPROVED.value == "approved"

    def test_rejected_value(self):
        assert ApprovalStatus.REJECTED.value == "rejected"

    def test_timeout_value(self):
        assert ApprovalStatus.TIMEOUT.value == "timeout"

    def test_is_str_subclass(self):
        assert isinstance(ApprovalStatus.PENDING, str)


class TestGenerateApprovalId(unittest.TestCase):
    """Test approval ID generation."""

    def test_prefix(self):
        aid = generate_approval_id()
        assert aid.startswith("apr_")

    def test_uniqueness(self):
        ids = {generate_approval_id() for _ in range(100)}
        assert len(ids) == 100


class TestDefaultTimeouts(unittest.TestCase):
    """Test default timeout configuration."""

    def test_high_timeout(self):
        assert DEFAULT_TIMEOUTS["high"] == 3600

    def test_critical_timeout(self):
        assert DEFAULT_TIMEOUTS["critical"] == 1800

    def test_critical_is_shorter_than_high(self):
        assert DEFAULT_TIMEOUTS["critical"] < DEFAULT_TIMEOUTS["high"]


class TestApprovalRequestModelSchema(unittest.TestCase):
    """Test the SQLAlchemy model schema definition."""

    def test_tablename(self):
        assert ApprovalRequestModel.__tablename__ == "approval_requests"

    def test_primary_key(self):
        mapper = inspect(ApprovalRequestModel)
        pk_cols = [col.name for col in mapper.primary_key]
        assert pk_cols == ["approval_id"]

    def test_required_columns(self):
        mapper = inspect(ApprovalRequestModel)
        col_names = {col.name for col in mapper.columns}
        required = {
            "approval_id", "task_id", "organization_id", "department_id",
            "risk_level", "risk_reason", "approver_department_id",
            "approver_role", "status", "requested_at", "timeout_seconds",
        }
        assert required.issubset(col_names)

    def test_nullable_columns(self):
        mapper = inspect(ApprovalRequestModel)
        cols = {col.name: col for col in mapper.columns}
        assert cols["business_line_id"].nullable is True
        assert cols["screenshot_path"].nullable is True
        assert cols["operation_description"].nullable is True
        assert cols["approver_user_id"].nullable is True
        assert cols["decided_at"].nullable is True
        assert cols["decision_note"].nullable is True
        assert cols["notify_department_ids"].nullable is True

    def test_non_nullable_columns(self):
        mapper = inspect(ApprovalRequestModel)
        cols = {col.name: col for col in mapper.columns}
        assert cols["task_id"].nullable is False
        assert cols["organization_id"].nullable is False
        assert cols["risk_level"].nullable is False
        assert cols["risk_reason"].nullable is False
        assert cols["status"].nullable is False
        assert cols["timeout_seconds"].nullable is False

    def test_default_status(self):
        mapper = inspect(ApprovalRequestModel)
        cols = {col.name: col for col in mapper.columns}
        assert cols["status"].default.arg == ApprovalStatus.PENDING.value

    def test_default_timeout(self):
        mapper = inspect(ApprovalRequestModel)
        cols = {col.name: col for col in mapper.columns}
        assert cols["timeout_seconds"].default.arg == 3600

    def test_default_approver_role(self):
        mapper = inspect(ApprovalRequestModel)
        cols = {col.name: col for col in mapper.columns}
        assert cols["approver_role"].default.arg == "approver"

    def test_check_constraints(self):
        constraints = ApprovalRequestModel.__table__.constraints
        check_names = {c.name for c in constraints if hasattr(c, "name") and c.name}
        assert "ck_valid_approval_status" in check_names
        assert "ck_positive_timeout" in check_names

    def test_indexes(self):
        indexes = ApprovalRequestModel.__table__.indexes
        index_names = {idx.name for idx in indexes}
        assert "idx_apr_org_status" in index_names
        assert "idx_apr_dept_status" in index_names


if __name__ == "__main__":
    unittest.main()
