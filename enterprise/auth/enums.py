"""Enterprise role and permission enums."""

import enum


class RoleType(str, enum.Enum):
    """User roles within a department."""

    SUPER_ADMIN = "super_admin"
    ORG_ADMIN = "org_admin"
    OPERATOR = "operator"
    APPROVER = "approver"
    VIEWER = "viewer"


class RiskLevel(str, enum.Enum):
    """Risk level for task actions."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SpecialPermissionType(str, enum.Enum):
    """Special cross-department permission types."""

    CROSS_ORG_READ = "cross_org_read"
    CROSS_ORG_APPROVE = "cross_org_approve"
