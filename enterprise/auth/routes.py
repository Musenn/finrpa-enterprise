"""Enterprise authentication API routes."""

import structlog
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from skyvern.forge import app as forge_app

from .dependencies import CurrentUser
from .models import (
    EnterpriseUserModel,
    SpecialPermissionModel,
    UserBusinessLineModel,
    UserDepartmentRoleModel,
)
from .schemas import DepartmentRole, LoginRequest, LoginResponse

LOG = structlog.get_logger()

router = APIRouter(prefix="/enterprise/auth", tags=["Enterprise Auth"])


async def _get_db_session() -> AsyncSession:
    """Get an async database session from Skyvern's connection pool."""
    return forge_app.DATABASE.get_async_session()


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest) -> LoginResponse:
    """Authenticate an enterprise user and return a JWT with full permission context."""
    from passlib.hash import bcrypt

    from .jwt_service import create_enterprise_token

    async with await _get_db_session() as session:
        # Find user by org + username
        stmt = select(EnterpriseUserModel).where(
            EnterpriseUserModel.organization_id == request.organization_id,
            EnterpriseUserModel.username == request.username,
        )
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled",
            )

        # Verify password
        if not bcrypt.verify(request.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
            )

        # Load department roles
        dept_roles_stmt = (
            select(UserDepartmentRoleModel)
            .where(UserDepartmentRoleModel.user_id == user.user_id)
        )
        dept_roles_result = await session.execute(dept_roles_stmt)
        dept_role_rows = dept_roles_result.scalars().all()

        # Resolve department names
        from .models import DepartmentModel
        department_roles = []
        for dr in dept_role_rows:
            dept_stmt = select(DepartmentModel.department_name).where(
                DepartmentModel.department_id == dr.department_id
            )
            dept_result = await session.execute(dept_stmt)
            dept_name = dept_result.scalar_one_or_none() or dr.department_id
            department_roles.append(DepartmentRole(
                department_id=dr.department_id,
                department_name=dept_name,
                role=dr.role,
            ))

        # Load business line IDs
        bl_stmt = (
            select(UserBusinessLineModel.business_line_id)
            .where(UserBusinessLineModel.user_id == user.user_id)
        )
        bl_result = await session.execute(bl_stmt)
        business_line_ids = [row for row in bl_result.scalars().all()]

        # Load special permissions
        sp_stmt = (
            select(SpecialPermissionModel.permission_type)
            .where(SpecialPermissionModel.user_id == user.user_id)
        )
        sp_result = await session.execute(sp_stmt)
        special_perms = set(sp_result.scalars().all())

        has_cross_org_read = "cross_org_read" in special_perms
        has_cross_org_approve = "cross_org_approve" in special_perms

    from skyvern.config import settings

    # Create enterprise JWT
    token = create_enterprise_token(
        user_id=user.user_id,
        org_id=user.organization_id,
        department_roles=department_roles,
        business_line_ids=business_line_ids,
        has_cross_org_read=has_cross_org_read,
        has_cross_org_approve=has_cross_org_approve,
    )

    LOG.info(
        "Enterprise user login",
        user_id=user.user_id,
        org_id=user.organization_id,
        roles=[f"{dr.department_id}:{dr.role}" for dr in department_roles],
    )

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user_id=user.user_id,
        display_name=user.display_name,
    )


@router.get("/me")
async def get_current_user_info(user: CurrentUser) -> dict:
    """Return the current user's permission context decoded from JWT."""
    return {
        "user_id": user.user_id,
        "org_id": user.org_id,
        "department_roles": [dr.model_dump() for dr in user.department_roles],
        "business_line_ids": user.business_line_ids,
        "has_cross_org_read": user.has_cross_org_read,
        "has_cross_org_approve": user.has_cross_org_approve,
        "is_admin": user.is_org_admin,
        "is_operator": user.is_any_operator,
        "is_approver": user.is_any_approver,
    }
