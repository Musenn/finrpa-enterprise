"""Enterprise tenant isolation API routes.

Provides:
- Task list endpoint with automatic tenant filtering
- Visibility diagnostic API for admins
"""

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from enterprise.auth.dependencies import CurrentUser, require_admin
from enterprise.auth.models import (
    DepartmentModel,
    BusinessLineModel,
    EnterpriseUserModel,
    SpecialPermissionModel,
    TaskExtensionModel,
    UserBusinessLineModel,
    UserDepartmentRoleModel,
)
from enterprise.auth.schemas import UserContext

from .context import TenantContext, get_tenant_context
from .query_filter import filter_task_extensions

LOG = structlog.get_logger()

router = APIRouter(prefix="/enterprise", tags=["Enterprise Tenant"])


async def _get_db_session() -> AsyncSession:
    from skyvern.forge import app as forge_app
    return forge_app.DATABASE.get_async_session()


@router.get("/tasks")
async def list_tasks(user: CurrentUser) -> dict:
    """List task extensions visible to the current user.

    The query is automatically filtered by the tenant context
    set by the middleware.
    """
    ctx = get_tenant_context()
    if ctx is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Tenant context not available",
        )

    async with await _get_db_session() as session:
        query = select(TaskExtensionModel)

        # Apply organization filter
        query = query.where(TaskExtensionModel.organization_id == ctx.org_id)

        # Apply multi-dimensional visibility filter
        if not ctx.has_full_org_visibility:
            from sqlalchemy import or_

            conditions = []
            if ctx.visible_department_ids:
                conditions.append(
                    TaskExtensionModel.department_id.in_(ctx.visible_department_ids)
                )
            if ctx.visible_business_line_ids:
                conditions.append(
                    TaskExtensionModel.business_line_id.in_(ctx.visible_business_line_ids)
                )
            if conditions:
                query = query.where(or_(*conditions))
            else:
                # No visibility -> return empty
                return {"tasks": [], "total": 0, "tenant_context": _format_ctx(ctx)}

        result = await session.execute(query)
        tasks = result.scalars().all()

    return {
        "tasks": [
            {
                "extension_id": t.extension_id,
                "task_id": t.task_id,
                "organization_id": t.organization_id,
                "department_id": t.department_id,
                "business_line_id": t.business_line_id,
                "risk_level": t.risk_level,
                "created_by": t.created_by,
            }
            for t in tasks
        ],
        "total": len(tasks),
        "tenant_context": _format_ctx(ctx),
    }


@router.get("/admin/visibility")
async def diagnose_visibility(
    user_id: str = Query(..., description="Target user ID to diagnose"),
    admin: UserContext = Depends(require_admin),
) -> dict:
    """Diagnose a user's data visibility scope.

    Admin-only endpoint for troubleshooting permission issues.
    Returns which departments and business lines the target user can see.
    """
    async with await _get_db_session() as session:
        # Verify target user exists
        user_stmt = select(EnterpriseUserModel).where(
            EnterpriseUserModel.user_id == user_id
        )
        user_result = await session.execute(user_stmt)
        target_user = user_result.scalar_one_or_none()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User {user_id} not found",
            )

        # Load department roles
        dept_roles_stmt = select(UserDepartmentRoleModel).where(
            UserDepartmentRoleModel.user_id == user_id
        )
        dept_roles_result = await session.execute(dept_roles_stmt)
        dept_roles = dept_roles_result.scalars().all()

        # Load department names
        dept_ids = [dr.department_id for dr in dept_roles]
        dept_names = {}
        if dept_ids:
            dept_stmt = select(DepartmentModel).where(
                DepartmentModel.department_id.in_(dept_ids)
            )
            dept_result = await session.execute(dept_stmt)
            for dept in dept_result.scalars().all():
                dept_names[dept.department_id] = dept.department_name

        # Load business lines
        bl_stmt = select(UserBusinessLineModel).where(
            UserBusinessLineModel.user_id == user_id
        )
        bl_result = await session.execute(bl_stmt)
        bl_rows = bl_result.scalars().all()
        bl_ids = [bl.business_line_id for bl in bl_rows]

        # Load business line names
        bl_names = {}
        if bl_ids:
            bl_name_stmt = select(BusinessLineModel).where(
                BusinessLineModel.business_line_id.in_(bl_ids)
            )
            bl_name_result = await session.execute(bl_name_stmt)
            for bl in bl_name_result.scalars().all():
                bl_names[bl.business_line_id] = bl.line_name

        # Load special permissions
        sp_stmt = select(SpecialPermissionModel).where(
            SpecialPermissionModel.user_id == user_id
        )
        sp_result = await session.execute(sp_stmt)
        special_perms = sp_result.scalars().all()

        has_cross_org_read = any(
            sp.permission_type == "cross_org_read" for sp in special_perms
        )
        has_cross_org_approve = any(
            sp.permission_type == "cross_org_approve" for sp in special_perms
        )

        # Determine full org visibility
        is_admin_role = any(
            dr.role in ("super_admin", "org_admin") for dr in dept_roles
        )
        has_full_visibility = is_admin_role or has_cross_org_read

        # If full visibility, load all departments and business lines in org
        all_dept_names = {}
        all_bl_names = {}
        if has_full_visibility:
            all_dept_stmt = select(DepartmentModel).where(
                DepartmentModel.organization_id == target_user.organization_id
            )
            all_dept_result = await session.execute(all_dept_stmt)
            for d in all_dept_result.scalars().all():
                all_dept_names[d.department_id] = d.department_name

            all_bl_stmt = select(BusinessLineModel).where(
                BusinessLineModel.organization_id == target_user.organization_id
            )
            all_bl_result = await session.execute(all_bl_stmt)
            for b in all_bl_result.scalars().all():
                all_bl_names[b.business_line_id] = b.line_name

    return {
        "user_id": user_id,
        "display_name": target_user.display_name,
        "organization_id": target_user.organization_id,
        "is_active": target_user.is_active,
        "department_roles": [
            {
                "department_id": dr.department_id,
                "department_name": dept_names.get(dr.department_id, dr.department_id),
                "role": dr.role,
            }
            for dr in dept_roles
        ],
        "business_lines": [
            {
                "business_line_id": bl_id,
                "line_name": bl_names.get(bl_id, bl_id),
            }
            for bl_id in bl_ids
        ],
        "special_permissions": [
            {
                "permission_type": sp.permission_type,
                "granted_by": sp.granted_by,
            }
            for sp in special_perms
        ],
        "visibility_summary": {
            "has_full_org_visibility": has_full_visibility,
            "is_admin": is_admin_role,
            "has_cross_org_read": has_cross_org_read,
            "has_cross_org_approve": has_cross_org_approve,
            "visible_departments": (
                all_dept_names if has_full_visibility
                else {did: dept_names.get(did, did) for did in dept_ids}
            ),
            "visible_business_lines": (
                all_bl_names if has_full_visibility
                else {bid: bl_names.get(bid, bid) for bid in bl_ids}
            ),
        },
    }


def _format_ctx(ctx: TenantContext) -> dict:
    return {
        "org_id": ctx.org_id,
        "user_id": ctx.user_id,
        "has_full_org_visibility": ctx.has_full_org_visibility,
        "visible_department_ids": ctx.visible_department_ids,
        "visible_business_line_ids": ctx.visible_business_line_ids,
    }
