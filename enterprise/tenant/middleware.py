"""FastAPI middleware for multi-dimensional tenant context injection.

On each incoming request:
1. Check if the route is in the whitelist (skip auth for login, health, docs)
2. Extract Bearer token from Authorization header
3. Decode enterprise JWT to get user context
4. Build TenantContext with visibility scope
5. Store in ContextVar for downstream query filters
"""

import structlog
from fastapi import Request, Response
from jose import JWTError
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from enterprise.auth.jwt_service import decode_enterprise_token

from .context import TenantContext, reset_tenant_context, set_tenant_context

LOG = structlog.get_logger()

# Routes that skip tenant context injection
_WHITELIST_PREFIXES = (
    "/api/v1/enterprise/auth/login",
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
)


def _is_whitelisted(path: str) -> bool:
    return any(path.startswith(prefix) for prefix in _WHITELIST_PREFIXES)


class TenantIsolationMiddleware(BaseHTTPMiddleware):
    """Injects multi-dimensional tenant context into each request."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if _is_whitelisted(request.url.path):
            return await call_next(request)

        authorization = request.headers.get("authorization")
        if not authorization:
            # No auth header — let downstream dependency handlers raise 401
            return await call_next(request)

        parts = authorization.split(" ", 1)
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return await call_next(request)

        token = parts[1]
        try:
            user_ctx = decode_enterprise_token(token)
        except (JWTError, ValueError):
            # Invalid token — let downstream handlers deal with it
            return await call_next(request)

        # Determine visibility scope
        has_full_visibility = (
            user_ctx.is_org_admin
            or user_ctx.has_cross_org_read
        )

        tenant = TenantContext(
            org_id=user_ctx.org_id,
            user_id=user_ctx.user_id,
            visible_department_ids=user_ctx.department_ids,
            visible_business_line_ids=user_ctx.business_line_ids,
            has_full_org_visibility=has_full_visibility,
        )

        ctx_token = set_tenant_context(tenant)
        try:
            response = await call_next(request)
        finally:
            reset_tenant_context(ctx_token)

        return response
