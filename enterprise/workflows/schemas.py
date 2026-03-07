"""Workflow template data structures.

Defines the template schema including parameter definitions with
sensitivity marking, industry classification, and risk level.
"""

import enum
from dataclasses import dataclass, field


class IndustryType(str, enum.Enum):
    BANKING = "banking"
    INSURANCE = "insurance"
    SECURITIES = "securities"


class ParamType(str, enum.Enum):
    STRING = "string"
    INTEGER = "integer"
    DATE = "date"
    PASSWORD = "password"
    URL = "url"
    EMAIL = "email"


@dataclass
class ParamDefinition:
    """Definition of a single workflow parameter."""

    name: str
    label: str  # human-readable
    param_type: ParamType
    required: bool = True
    sensitive: bool = False  # if True, encrypted at rest + masked on read
    description: str = ""
    default: str | None = None
    validation_regex: str | None = None  # optional regex for format validation


@dataclass
class SkillStepDefinition:
    """A skill invocation within a workflow template.

    Maps workflow parameters to skill parameters, enabling
    templates to be composed from reusable skills.
    """

    skill_name: str  # must match a registered skill name
    description: str = ""  # human-readable step description
    param_mapping: dict[str, str] = field(default_factory=dict)
    # Maps skill param -> workflow param name or literal value (prefixed with "=")
    # e.g. {"url": "bank_url", "username": "username", "max_rows": "=500"}
    error_strategy_override: str | None = None


@dataclass
class WorkflowTemplate:
    """A reusable workflow template for financial RPA scenarios."""

    template_id: str
    name: str
    industry: IndustryType
    risk_level: str  # low / medium / high / critical
    description: str
    navigation_target: str  # description of target system/page
    expected_result: str  # description of expected outcome
    approval_rule: str  # description of applicable approval rule
    parameters: list[ParamDefinition] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    skill_steps: list[SkillStepDefinition] = field(default_factory=list)
