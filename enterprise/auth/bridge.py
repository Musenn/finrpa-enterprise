"""Bridge enterprise JWT authentication to Skyvern's native org auth.

Skyvern's native endpoints (e.g. /workflows/create-from-prompt) use
``app.authentication_function`` to resolve a Bearer token into an
Organization.  By default this is None, so enterprise JWT tokens are
rejected with 403.  This module provides the bridge functions that
decode enterprise tokens and return the objects Skyvern expects.
"""

from jose import JWTError

from skyvern.forge import app as forge_app
from skyvern.forge.sdk.schemas.organizations import Organization

from .jwt_service import decode_enterprise_token


async def authenticate_enterprise_token(token: str) -> Organization | None:
    """Validate an enterprise JWT and return the corresponding Organization.

    Called by ``org_auth_service._authenticate_helper`` when a request
    carries an ``Authorization: Bearer <token>`` header but no API key.
    """
    try:
        user_ctx = decode_enterprise_token(token)
    except (JWTError, ValueError):
        return None

    org = await forge_app.DATABASE.get_organization(
        organization_id=user_ctx.org_id,
    )
    return org


async def authenticate_enterprise_user(token: str) -> str | None:
    """Validate an enterprise JWT and return the user_id string.

    Called by ``org_auth_service.get_current_user_id`` when a request
    carries an ``Authorization`` header.
    """
    try:
        user_ctx = decode_enterprise_token(token)
    except (JWTError, ValueError):
        return None

    return user_ctx.user_id
