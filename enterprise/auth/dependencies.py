"""FastAPI dependency injection functions for enterprise authentication.

Provides reusable Depends() callables that extract and validate the
enterprise user context from the Authorization header, then enforce
role-based access requirements.
"""

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError

from .jwt_service import decode_enterprise_token
from .schemas import UserContext


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> UserContext:
    """Extract and validate enterprise user context from Bearer token.

    Returns UserContext on success.
    Raises 401 if token is missing/invalid/expired.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1]
    try:
        return decode_enterprise_token(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or malformed token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


# Type alias for use in route signatures
CurrentUser = Annotated[UserContext, Depends(get_current_user)]


async def require_any_operator(
    user: CurrentUser,
) -> UserContext:
    """Require the user to be an operator (or higher) in at least one department."""
    if not user.is_any_operator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operator role or higher required",
        )
    return user


async def require_approver(
    user: CurrentUser,
) -> UserContext:
    """Require the user to have approver privileges in at least one department."""
    if not user.is_any_approver:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Approver role or higher required",
        )
    return user


async def require_cross_org_viewer(
    user: CurrentUser,
) -> UserContext:
    """Require the user to have cross-organization read permission."""
    if not (user.has_cross_org_read or user.is_org_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cross-organization read permission required",
        )
    return user


async def require_admin(
    user: CurrentUser,
) -> UserContext:
    """Require the user to be org_admin or super_admin."""
    if not user.is_org_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return user


def require_department_operator(department_id: str):
    """Factory: create a dependency that requires operator role in a specific department.

    Usage:
        @router.post("/departments/{dept_id}/tasks")
        async def create_task(
            dept_id: str,
            user: UserContext = Depends(require_department_operator("dept_corp_credit")),
        ):
            ...
    """

    async def _check(user: CurrentUser) -> UserContext:
        role = user.get_role_in_department(department_id)
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No role assigned in department {department_id}",
            )
        if role not in ("super_admin", "org_admin", "operator"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operator role or higher required in department {department_id}",
            )
        return user

    return _check


def require_department_role(department_id: str, min_role: str = "viewer"):
    """Factory: create a dependency that requires at least min_role in a specific department.

    Role hierarchy: viewer < operator < approver < org_admin < super_admin
    """

    _role_order = {
        "viewer": 0,
        "operator": 1,
        "approver": 2,
        "org_admin": 3,
        "super_admin": 4,
    }

    async def _check(user: CurrentUser) -> UserContext:
        # Admins bypass department check
        if user.is_org_admin:
            return user

        role = user.get_role_in_department(department_id)
        if role is None:
            # Check cross-org read for viewer access
            if min_role == "viewer" and user.has_cross_org_read:
                return user
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No role assigned in department {department_id}",
            )

        if _role_order.get(role, -1) < _role_order.get(min_role, 0):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"{min_role} role or higher required in department {department_id}",
            )
        return user

    return _check
