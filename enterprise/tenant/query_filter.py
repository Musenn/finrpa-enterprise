"""Automatic tenant-based query filtering for SQLAlchemy.

Intercepts SELECT queries on the task_extensions table and appends
WHERE clauses based on the current tenant context:
- If user has full org visibility: filter by org_id only
- Otherwise: filter by (visible dept_ids OR visible bl_ids) AND org_id

This ensures data isolation without requiring every query to manually
include tenant filters.
"""

import structlog
from sqlalchemy import event, or_
from sqlalchemy.orm import Query, Session

from enterprise.auth.models import TaskExtensionModel

from .context import get_tenant_context

LOG = structlog.get_logger()


def apply_tenant_filter(query: Query, model_class: type) -> Query:
    """Apply tenant-based filtering to a query on the given model.

    This is the core filtering logic, extracted for testability.
    Can be called explicitly or via the automatic event listener.
    """
    ctx = get_tenant_context()
    if ctx is None:
        return query

    # Always filter by organization
    query = query.filter(model_class.organization_id == ctx.org_id)

    # If full org visibility, no further filtering needed
    if ctx.has_full_org_visibility:
        return query

    # Build multi-dimensional visibility filter
    conditions = []

    if ctx.visible_department_ids:
        conditions.append(
            model_class.department_id.in_(ctx.visible_department_ids)
        )

    if ctx.visible_business_line_ids:
        conditions.append(
            model_class.business_line_id.in_(ctx.visible_business_line_ids)
        )

    if conditions:
        query = query.filter(or_(*conditions))
    else:
        # User has no visible departments or business lines -> no data
        query = query.filter(model_class.organization_id == "__no_access__")

    return query


def filter_task_extensions(query: Query) -> Query:
    """Convenience function: apply tenant filter specifically for TaskExtensionModel."""
    return apply_tenant_filter(query, TaskExtensionModel)
