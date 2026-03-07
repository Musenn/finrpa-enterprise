"""Workflow template API routes.

Provides endpoints for:
- GET  /enterprise/workflows/templates         — list all templates
- GET  /enterprise/workflows/templates/{id}    — template detail
- POST /enterprise/workflows/instantiate/{id}  — create task from template
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from enterprise.auth.dependencies import CurrentUser

from .crypto import encrypt_value, mask_value
from .schemas import ParamType
from .templates import TEMPLATE_REGISTRY, get_template, get_templates_by_industry
from .validator import validate_parameters

router = APIRouter(prefix="/enterprise/workflows", tags=["workflows"])


# --- Pydantic response schemas ---

class ParamDefResponse(BaseModel):
    name: str
    label: str
    param_type: str
    required: bool
    sensitive: bool
    description: str
    default: str | None


class TemplateListItem(BaseModel):
    template_id: str
    name: str
    industry: str
    risk_level: str
    description: str
    tags: list[str]


class TemplateDetailResponse(BaseModel):
    template_id: str
    name: str
    industry: str
    risk_level: str
    description: str
    navigation_target: str
    expected_result: str
    approval_rule: str
    parameters: list[ParamDefResponse]
    tags: list[str]


class InstantiateRequest(BaseModel):
    parameters: dict[str, str] = Field(..., description="Parameter values")


class InstantiateResponse(BaseModel):
    task_id: str
    template_id: str
    template_name: str
    stored_parameters: dict[str, str]  # sensitive values masked
    validation_passed: bool
    message: str


# --- Routes ---

@router.get("/templates", response_model=list[TemplateListItem])
async def list_templates(
    user: CurrentUser,
    industry: str | None = None,
):
    """List all available workflow templates, optionally filtered by industry."""
    if industry:
        templates = get_templates_by_industry(industry)
    else:
        templates = list(TEMPLATE_REGISTRY.values())

    return [
        TemplateListItem(
            template_id=t.template_id,
            name=t.name,
            industry=t.industry.value,
            risk_level=t.risk_level,
            description=t.description,
            tags=t.tags,
        )
        for t in templates
    ]


@router.get("/templates/{template_id}", response_model=TemplateDetailResponse)
async def get_template_detail(
    template_id: str,
    user: CurrentUser,
):
    """Get detailed information about a specific workflow template."""
    template = get_template(template_id)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found",
        )

    return TemplateDetailResponse(
        template_id=template.template_id,
        name=template.name,
        industry=template.industry.value,
        risk_level=template.risk_level,
        description=template.description,
        navigation_target=template.navigation_target,
        expected_result=template.expected_result,
        approval_rule=template.approval_rule,
        parameters=[
            ParamDefResponse(
                name=p.name,
                label=p.label,
                param_type=p.param_type.value,
                required=p.required,
                sensitive=p.sensitive,
                description=p.description,
                default=p.default,
            )
            for p in template.parameters
        ],
        tags=template.tags,
    )


@router.post("/instantiate/{template_id}", response_model=InstantiateResponse)
async def instantiate_template(
    template_id: str,
    body: InstantiateRequest,
    user: CurrentUser,
):
    """Create a task instance from a workflow template.

    Validates parameters, encrypts sensitive values, and returns masked display.
    """
    template = get_template(template_id)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found",
        )

    # Validate parameters
    result = validate_parameters(template.parameters, body.parameters)
    if not result.valid:
        error_details = "; ".join(f"{e.param_name}: {e.message}" for e in result.errors)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Parameter validation failed: {error_details}",
        )

    # Build stored parameters (encrypt sensitive, keep others as-is)
    sensitive_names = {p.name for p in template.parameters if p.sensitive}
    stored = {}
    display = {}

    for key, value in body.parameters.items():
        if key in sensitive_names:
            stored[key] = encrypt_value(value)
            display[key] = mask_value(value)
        else:
            stored[key] = value
            display[key] = value

    # Fill defaults for missing optional parameters
    for pdef in template.parameters:
        if pdef.name not in body.parameters and pdef.default is not None:
            stored[pdef.name] = pdef.default
            display[pdef.name] = pdef.default

    # Generate a task ID (in production, this would create a Skyvern task)
    from skyvern.forge.sdk.db.id import generate_id
    task_id = f"task_{generate_id()}"

    return InstantiateResponse(
        task_id=task_id,
        template_id=template_id,
        template_name=template.name,
        stored_parameters=display,
        validation_passed=True,
        message=f"Task created from template '{template.name}'",
    )
