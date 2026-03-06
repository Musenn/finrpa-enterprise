"""Enterprise multi-dimensional permission data models.

Tables:
    - departments: department hierarchy within an organization
    - business_lines: functional business classifications
    - enterprise_users: enterprise user accounts with credentials
    - user_department_roles: user-department-role ternary association
    - user_business_lines: user-business_line many-to-many association
    - special_permissions: cross-department visibility grants
    - task_extensions: enterprise metadata extension for Skyvern tasks
"""

import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from skyvern.forge.sdk.db.models import Base

from .enums import RiskLevel, RoleType, SpecialPermissionType
from .id import (
    generate_business_line_id,
    generate_department_id,
    generate_enterprise_user_id,
    generate_special_permission_id,
    generate_task_extension_id,
)


class DepartmentModel(Base):
    """Department within an organization, supporting parent-child hierarchy."""

    __tablename__ = "departments"

    department_id = Column(String, primary_key=True, default=generate_department_id)
    organization_id = Column(
        String,
        ForeignKey("organizations.organization_id"),
        nullable=False,
        index=True,
    )
    parent_id = Column(
        String,
        ForeignKey("departments.department_id"),
        nullable=True,
        index=True,
    )
    department_name = Column(String, nullable=False)
    department_code = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    modified_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    children = relationship("DepartmentModel", back_populates="parent", lazy="selectin")
    parent = relationship("DepartmentModel", back_populates="children", remote_side=[department_id])
    user_roles = relationship("UserDepartmentRoleModel", back_populates="department", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("organization_id", "department_code", name="uq_org_dept_code"),
        Index("idx_dept_org", "organization_id"),
    )


class BusinessLineModel(Base):
    """Functional business line classification within an organization."""

    __tablename__ = "business_lines"

    business_line_id = Column(String, primary_key=True, default=generate_business_line_id)
    organization_id = Column(
        String,
        ForeignKey("organizations.organization_id"),
        nullable=False,
        index=True,
    )
    line_name = Column(String, nullable=False)
    line_code = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    modified_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )
    deleted_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("organization_id", "line_code", name="uq_org_line_code"),
    )


class EnterpriseUserModel(Base):
    """Enterprise user with authentication credentials."""

    __tablename__ = "enterprise_users"

    user_id = Column(String, primary_key=True, default=generate_enterprise_user_id)
    organization_id = Column(
        String,
        ForeignKey("organizations.organization_id"),
        nullable=False,
        index=True,
    )
    username = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    modified_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    department_roles = relationship("UserDepartmentRoleModel", back_populates="user", lazy="selectin")
    business_lines = relationship("UserBusinessLineModel", back_populates="user", lazy="selectin")
    special_permissions = relationship("SpecialPermissionModel", back_populates="user", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("organization_id", "username", name="uq_org_username"),
    )


class UserDepartmentRoleModel(Base):
    """Ternary association: user + department + role.

    Constraint: operator and approver roles are mutually exclusive for
    the same user within the same department (dual control principle).
    """

    __tablename__ = "user_department_roles"

    user_id = Column(
        String,
        ForeignKey("enterprise_users.user_id"),
        primary_key=True,
    )
    department_id = Column(
        String,
        ForeignKey("departments.department_id"),
        primary_key=True,
    )
    role = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("EnterpriseUserModel", back_populates="department_roles")
    department = relationship("DepartmentModel", back_populates="user_roles")

    __table_args__ = (
        CheckConstraint(
            f"role IN ('{RoleType.SUPER_ADMIN.value}', '{RoleType.ORG_ADMIN.value}', "
            f"'{RoleType.OPERATOR.value}', '{RoleType.APPROVER.value}', '{RoleType.VIEWER.value}')",
            name="ck_valid_role",
        ),
    )


class UserBusinessLineModel(Base):
    """Many-to-many association between users and business lines."""

    __tablename__ = "user_business_lines"

    user_id = Column(
        String,
        ForeignKey("enterprise_users.user_id"),
        primary_key=True,
    )
    business_line_id = Column(
        String,
        ForeignKey("business_lines.business_line_id"),
        primary_key=True,
    )
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("EnterpriseUserModel", back_populates="business_lines")
    business_line = relationship("BusinessLineModel")


class SpecialPermissionModel(Base):
    """Cross-department special permissions (e.g., risk/compliance read-all)."""

    __tablename__ = "special_permissions"

    permission_id = Column(String, primary_key=True, default=generate_special_permission_id)
    user_id = Column(
        String,
        ForeignKey("enterprise_users.user_id"),
        nullable=False,
        index=True,
    )
    organization_id = Column(
        String,
        ForeignKey("organizations.organization_id"),
        nullable=False,
    )
    permission_type = Column(String, nullable=False)
    granted_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("EnterpriseUserModel", back_populates="special_permissions")

    __table_args__ = (
        UniqueConstraint("user_id", "permission_type", name="uq_user_permission_type"),
        CheckConstraint(
            f"permission_type IN ('{SpecialPermissionType.CROSS_ORG_READ.value}', "
            f"'{SpecialPermissionType.CROSS_ORG_APPROVE.value}')",
            name="ck_valid_permission_type",
        ),
    )


class TaskExtensionModel(Base):
    """Enterprise metadata extension for Skyvern tasks."""

    __tablename__ = "task_extensions"

    extension_id = Column(String, primary_key=True, default=generate_task_extension_id)
    task_id = Column(String, nullable=False, unique=True, index=True)
    organization_id = Column(
        String,
        ForeignKey("organizations.organization_id"),
        nullable=False,
        index=True,
    )
    department_id = Column(
        String,
        ForeignKey("departments.department_id"),
        nullable=False,
        index=True,
    )
    business_line_id = Column(
        String,
        ForeignKey("business_lines.business_line_id"),
        nullable=True,
        index=True,
    )
    risk_level = Column(String, default=RiskLevel.LOW.value, nullable=False)
    created_by = Column(
        String,
        ForeignKey("enterprise_users.user_id"),
        nullable=False,
    )
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    modified_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )

    __table_args__ = (
        Index("idx_te_org_dept", "organization_id", "department_id"),
        Index("idx_te_org_bl", "organization_id", "business_line_id"),
        CheckConstraint(
            f"risk_level IN ('{RiskLevel.LOW.value}', '{RiskLevel.MEDIUM.value}', "
            f"'{RiskLevel.HIGH.value}', '{RiskLevel.CRITICAL.value}')",
            name="ck_valid_risk_level",
        ),
    )
