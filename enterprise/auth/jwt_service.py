"""Enterprise JWT token creation and verification.

Extends Skyvern's simple sub+exp token with multi-dimensional
permission context (departments, business lines, special permissions).
"""

import time
from datetime import datetime, timedelta

from jose import JWTError, jwt

from skyvern.config import settings

from .schemas import DepartmentRole, EnterpriseTokenPayload, UserContext


def create_enterprise_token(
    user_id: str,
    org_id: str,
    department_roles: list[DepartmentRole],
    business_line_ids: list[str],
    has_cross_org_read: bool = False,
    has_cross_org_approve: bool = False,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a JWT with enterprise multi-dimensional permission payload."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        )

    payload = EnterpriseTokenPayload(
        sub=user_id,
        org_id=org_id,
        exp=int(expire.timestamp()),
        department_roles=department_roles,
        business_line_ids=business_line_ids,
        has_cross_org_read=has_cross_org_read,
        has_cross_org_approve=has_cross_org_approve,
    )

    return jwt.encode(
        payload.model_dump(),
        settings.SECRET_KEY,
        algorithm=settings.SIGNATURE_ALGORITHM,
    )


def decode_enterprise_token(token: str) -> UserContext:
    """Decode and validate an enterprise JWT token.

    Returns UserContext on success.
    Raises JWTError on invalid token, ValueError on expired token.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.SIGNATURE_ALGORITHM],
        )
    except JWTError:
        raise

    token_data = EnterpriseTokenPayload(**payload)

    if token_data.exp < time.time():
        raise ValueError("Token has expired")

    return UserContext(
        user_id=token_data.sub,
        org_id=token_data.org_id,
        department_roles=token_data.department_roles,
        business_line_ids=token_data.business_line_ids,
        has_cross_org_read=token_data.has_cross_org_read,
        has_cross_org_approve=token_data.has_cross_org_approve,
    )
