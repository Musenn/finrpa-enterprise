"""Pydantic schemas for enterprise authentication and authorization."""

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1)
    organization_id: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: str
    display_name: str


class DepartmentRole(BaseModel):
    department_id: str
    department_name: str
    role: str


class EnterpriseTokenPayload(BaseModel):
    """JWT payload for enterprise users.

    Contains multi-dimensional permission context:
    department roles, business lines, and special permissions.
    """

    sub: str  # user_id
    org_id: str
    exp: int
    department_roles: list[DepartmentRole]
    business_line_ids: list[str]
    has_cross_org_read: bool = False
    has_cross_org_approve: bool = False


class UserContext(BaseModel):
    """Resolved user context extracted from JWT, used throughout request lifecycle."""

    user_id: str
    org_id: str
    department_roles: list[DepartmentRole]
    business_line_ids: list[str]
    has_cross_org_read: bool = False
    has_cross_org_approve: bool = False

    @property
    def is_super_admin(self) -> bool:
        return any(dr.role == "super_admin" for dr in self.department_roles)

    @property
    def is_org_admin(self) -> bool:
        return any(dr.role in ("super_admin", "org_admin") for dr in self.department_roles)

    @property
    def is_any_operator(self) -> bool:
        return any(dr.role in ("super_admin", "org_admin", "operator") for dr in self.department_roles)

    @property
    def is_any_approver(self) -> bool:
        return any(dr.role in ("super_admin", "org_admin", "approver") for dr in self.department_roles)

    @property
    def department_ids(self) -> list[str]:
        return [dr.department_id for dr in self.department_roles]

    def get_role_in_department(self, department_id: str) -> str | None:
        for dr in self.department_roles:
            if dr.department_id == department_id:
                return dr.role
        return None

    def has_business_line(self, business_line_id: str) -> bool:
        return business_line_id in self.business_line_ids
