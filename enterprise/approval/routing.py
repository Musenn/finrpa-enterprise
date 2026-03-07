"""Risk-to-approval routing mapper.

Maps risk levels to approval requirements:
- low: no action
- medium: log only, no approval needed
- high: route to department approver
- critical: route to compliance dept approver + notify risk dept viewer
"""

from dataclasses import dataclass, field


@dataclass
class ApprovalRoute:
    """Describes who needs to approve and who should be notified."""

    requires_approval: bool
    approver_department_id: str | None = None
    approver_role: str = "approver"
    notify_department_ids: list[str] = field(default_factory=list)
    notify_roles: list[str] = field(default_factory=list)
    description: str = ""


# Well-known department IDs (should match seed data)
COMPLIANCE_DEPT_ID = "dept_compliance"
RISK_MGMT_DEPT_ID = "dept_risk_mgmt"


def route_approval(
    risk_level: str,
    source_department_id: str,
) -> ApprovalRoute:
    """Determine the approval route based on risk level.

    Args:
        risk_level: The assessed risk level ("low", "medium", "high", "critical").
        source_department_id: The department that initiated the operation.

    Returns:
        ApprovalRoute describing the required approval flow.
    """
    if risk_level == "low":
        return ApprovalRoute(
            requires_approval=False,
            description="Low risk — no approval required",
        )

    if risk_level == "medium":
        return ApprovalRoute(
            requires_approval=False,
            description="Medium risk — logged for audit, no approval required",
        )

    if risk_level == "high":
        return ApprovalRoute(
            requires_approval=True,
            approver_department_id=source_department_id,
            approver_role="approver",
            description=f"High risk — requires approver in department {source_department_id}",
        )

    if risk_level == "critical":
        return ApprovalRoute(
            requires_approval=True,
            approver_department_id=COMPLIANCE_DEPT_ID,
            approver_role="approver",
            notify_department_ids=[RISK_MGMT_DEPT_ID],
            notify_roles=["viewer"],
            description="Critical risk — requires compliance dept approver, risk dept notified",
        )

    # Unknown risk level — treat as high conservatively
    return ApprovalRoute(
        requires_approval=True,
        approver_department_id=source_department_id,
        approver_role="approver",
        description=f"Unknown risk level '{risk_level}' — treated as high risk",
    )
