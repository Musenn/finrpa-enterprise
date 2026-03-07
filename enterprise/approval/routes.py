"""Approval operation API routes.

Provides endpoints for:
- GET  /enterprise/approvals/pending  — list approvals the current user can act on
- POST /enterprise/approvals/{id}/approve — approve a pending request
- POST /enterprise/approvals/{id}/reject  — reject a pending request
"""

import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from enterprise.auth.dependencies import CurrentUser, require_approver
from enterprise.auth.schemas import UserContext

from .models import ApprovalStatus
from .pubsub import ApprovalDecision, _channel_name

router = APIRouter(prefix="/enterprise/approvals", tags=["approvals"])


# --- Pydantic schemas ---

class ApprovalResponseSchema(BaseModel):
    approval_id: str
    task_id: str
    organization_id: str
    department_id: str
    business_line_id: str | None
    risk_level: str
    risk_reason: str
    operation_description: str | None
    screenshot_path: str | None
    approver_department_id: str
    status: str
    requested_at: str
    timeout_seconds: int


class DecisionRequest(BaseModel):
    note: str = Field(default="", max_length=2000)


class DecisionResponse(BaseModel):
    approval_id: str
    status: str
    decided_at: str
    message: str


# --- Helper: filter pending approvals by user's role ---

def _user_can_approve(user: UserContext, approval_dept_id: str) -> bool:
    """Check if the user has approver role in the approval's target department."""
    if user.is_org_admin:
        return True
    if user.has_cross_org_approve:
        return True
    role = user.get_role_in_department(approval_dept_id)
    return role in ("approver", "org_admin", "super_admin")


# --- In-memory store for testing (production uses DB session) ---
# This will be replaced with actual DB queries in production.
# For now, we use a simple dict-based store that routes.py manages,
# enabling full unit testing without a real database.

_approval_store: dict[str, dict] = {}
_redis_client = None


def configure_store(store: dict[str, dict], redis_client=None):
    """Configure the approval store and optional Redis client (for testing)."""
    global _approval_store, _redis_client
    _approval_store = store
    _redis_client = redis_client


def _get_approval_or_404(approval_id: str) -> dict:
    if approval_id not in _approval_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Approval request {approval_id} not found",
        )
    return _approval_store[approval_id]


# --- Routes ---

@router.get("/pending", response_model=list[ApprovalResponseSchema])
async def list_pending_approvals(
    user: UserContext = Depends(require_approver),
):
    """List pending approval requests that the current user can act on.

    Filters by:
    - Same organization as the user
    - User has approver role in the approval's target department
    - Status is pending
    """
    results = []
    for approval in _approval_store.values():
        if approval["status"] != ApprovalStatus.PENDING.value:
            continue
        if approval["organization_id"] != user.org_id:
            continue
        if not _user_can_approve(user, approval["approver_department_id"]):
            continue
        results.append(ApprovalResponseSchema(
            approval_id=approval["approval_id"],
            task_id=approval["task_id"],
            organization_id=approval["organization_id"],
            department_id=approval["department_id"],
            business_line_id=approval.get("business_line_id"),
            risk_level=approval["risk_level"],
            risk_reason=approval["risk_reason"],
            operation_description=approval.get("operation_description"),
            screenshot_path=approval.get("screenshot_path"),
            approver_department_id=approval["approver_department_id"],
            status=approval["status"],
            requested_at=approval["requested_at"],
            timeout_seconds=approval["timeout_seconds"],
        ))
    return results


@router.post("/{approval_id}/approve", response_model=DecisionResponse)
async def approve_request(
    approval_id: str,
    body: DecisionRequest = DecisionRequest(),
    user: UserContext = Depends(require_approver),
):
    """Approve a pending approval request."""
    approval = _get_approval_or_404(approval_id)

    if approval["organization_id"] != user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot approve requests from other organizations",
        )

    if not _user_can_approve(user, approval["approver_department_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to approve requests for this department",
        )

    if approval["status"] != ApprovalStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Approval is already {approval['status']}, cannot approve",
        )

    now = datetime.datetime.utcnow().isoformat()
    approval["status"] = ApprovalStatus.APPROVED.value
    approval["approver_user_id"] = user.user_id
    approval["decided_at"] = now
    approval["decision_note"] = body.note

    # Publish decision to Redis if available
    if _redis_client is not None:
        decision = ApprovalDecision(
            approval_id=approval_id,
            status=ApprovalStatus.APPROVED.value,
            approver_user_id=user.user_id,
            decision_note=body.note,
        )
        await _redis_client.publish(
            _channel_name(approval_id),
            decision.to_json(),
        )

    return DecisionResponse(
        approval_id=approval_id,
        status=ApprovalStatus.APPROVED.value,
        decided_at=now,
        message="Approval granted",
    )


@router.post("/{approval_id}/reject", response_model=DecisionResponse)
async def reject_request(
    approval_id: str,
    body: DecisionRequest = DecisionRequest(),
    user: UserContext = Depends(require_approver),
):
    """Reject a pending approval request."""
    approval = _get_approval_or_404(approval_id)

    if approval["organization_id"] != user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot reject requests from other organizations",
        )

    if not _user_can_approve(user, approval["approver_department_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to reject requests for this department",
        )

    if approval["status"] != ApprovalStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Approval is already {approval['status']}, cannot reject",
        )

    now = datetime.datetime.utcnow().isoformat()
    approval["status"] = ApprovalStatus.REJECTED.value
    approval["approver_user_id"] = user.user_id
    approval["decided_at"] = now
    approval["decision_note"] = body.note

    # Publish decision to Redis if available
    if _redis_client is not None:
        decision = ApprovalDecision(
            approval_id=approval_id,
            status=ApprovalStatus.REJECTED.value,
            approver_user_id=user.user_id,
            decision_note=body.note,
        )
        await _redis_client.publish(
            _channel_name(approval_id),
            decision.to_json(),
        )

    return DecisionResponse(
        approval_id=approval_id,
        status=ApprovalStatus.REJECTED.value,
        decided_at=now,
        message="Approval rejected",
    )
