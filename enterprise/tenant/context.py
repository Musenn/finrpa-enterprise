"""Multi-dimensional tenant context using Python ContextVar.

Stores the current request's visibility scope: which organization,
departments, and business lines the user can access. This context
is set by the tenant middleware and consumed by query filters.
"""

from contextvars import ContextVar, Token
from dataclasses import dataclass, field


@dataclass(frozen=True)
class TenantContext:
    """Immutable snapshot of the current user's data visibility scope."""

    org_id: str
    user_id: str
    visible_department_ids: list[str] = field(default_factory=list)
    visible_business_line_ids: list[str] = field(default_factory=list)
    has_full_org_visibility: bool = False

    @property
    def is_restricted(self) -> bool:
        """True if data access is limited to specific departments/business lines."""
        return not self.has_full_org_visibility


# Module-level ContextVar — one per async request lifecycle
_tenant_ctx_var: ContextVar[TenantContext | None] = ContextVar(
    "tenant_context", default=None
)


def get_tenant_context() -> TenantContext | None:
    """Get the current request's tenant context, or None if not set."""
    return _tenant_ctx_var.get()


def set_tenant_context(ctx: TenantContext) -> Token:
    """Set the tenant context for the current request. Returns a reset token."""
    return _tenant_ctx_var.set(ctx)


def reset_tenant_context(token: Token) -> None:
    """Reset the tenant context to its previous value."""
    _tenant_ctx_var.reset(token)


def require_tenant_context() -> TenantContext:
    """Get the current tenant context, raising RuntimeError if not set.

    Use this in code paths that must always run within an authenticated request.
    """
    ctx = _tenant_ctx_var.get()
    if ctx is None:
        raise RuntimeError(
            "Tenant context not available. "
            "This code must run within a request that passed tenant middleware."
        )
    return ctx
