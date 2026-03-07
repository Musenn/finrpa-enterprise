"""Workflow parameter validation.

Validates user-provided parameters against template definitions:
- Required field presence
- Type format validation (date, URL, email, integer)
- Sensitive parameter format checks
- Business rule validation (date range limits)
"""

import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from .schemas import ParamDefinition, ParamType


MAX_DATE_RANGE_DAYS = 365  # 12 months max


@dataclass
class ValidationError:
    """A single validation error."""

    param_name: str
    message: str


@dataclass
class ValidationResult:
    """Result of parameter validation."""

    valid: bool
    errors: list[ValidationError] = field(default_factory=list)


# Regex patterns for format validation
URL_PATTERN = re.compile(
    r"^https?://[^\s/$.?#].[^\s]*$", re.IGNORECASE
)
EMAIL_PATTERN = re.compile(
    r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
)
DATE_PATTERN = re.compile(
    r"^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$"
)


def _validate_type(name: str, value: str, param_type: ParamType) -> ValidationError | None:
    """Validate a parameter value against its declared type."""
    if param_type == ParamType.INTEGER:
        try:
            int(value)
        except ValueError:
            return ValidationError(name, f"Expected integer, got '{value}'")

    elif param_type == ParamType.DATE:
        if not DATE_PATTERN.match(value):
            return ValidationError(name, f"Expected date format YYYY-MM-DD, got '{value}'")
        try:
            datetime.strptime(value, "%Y-%m-%d")
        except ValueError:
            return ValidationError(name, f"Invalid date: '{value}'")

    elif param_type == ParamType.URL:
        if not URL_PATTERN.match(value):
            return ValidationError(name, f"Invalid URL format: '{value}'")

    elif param_type == ParamType.EMAIL:
        if not EMAIL_PATTERN.match(value):
            return ValidationError(name, f"Invalid email format: '{value}'")

    elif param_type == ParamType.PASSWORD:
        if len(value) < 1:
            return ValidationError(name, "Password cannot be empty")

    return None


def _validate_custom_regex(name: str, value: str, pattern: str) -> ValidationError | None:
    """Validate against a custom regex pattern."""
    try:
        if not re.match(pattern, value):
            return ValidationError(name, f"Value does not match required pattern")
    except re.error:
        return ValidationError(name, f"Invalid validation regex in template definition")
    return None


def _validate_date_range(params: dict[str, str]) -> ValidationError | None:
    """Validate that date range does not exceed maximum allowed."""
    start_str = params.get("start_date")
    end_str = params.get("end_date")

    if not start_str or not end_str:
        return None

    try:
        start = datetime.strptime(start_str, "%Y-%m-%d")
        end = datetime.strptime(end_str, "%Y-%m-%d")
    except ValueError:
        return None  # format error already caught by type validation

    if end < start:
        return ValidationError("end_date", "End date must be after start date")

    if (end - start).days > MAX_DATE_RANGE_DAYS:
        return ValidationError(
            "end_date",
            f"Date range exceeds maximum of {MAX_DATE_RANGE_DAYS} days (approx 12 months)"
        )

    return None


def validate_parameters(
    param_defs: list[ParamDefinition],
    params: dict[str, str],
) -> ValidationResult:
    """Validate user-provided parameters against template definitions.

    Args:
        param_defs: Parameter definitions from the workflow template.
        params: User-provided parameter values.

    Returns:
        ValidationResult with validity flag and any errors.
    """
    errors: list[ValidationError] = []

    # Check required fields
    for pdef in param_defs:
        if pdef.required and pdef.name not in params:
            if pdef.default is None:
                errors.append(ValidationError(
                    pdef.name, f"Required parameter '{pdef.label}' is missing"
                ))

    # Validate each provided parameter
    for pdef in param_defs:
        value = params.get(pdef.name)
        if value is None:
            continue

        # Type validation
        type_err = _validate_type(pdef.name, value, pdef.param_type)
        if type_err:
            errors.append(type_err)
            continue

        # Custom regex validation
        if pdef.validation_regex:
            regex_err = _validate_custom_regex(pdef.name, value, pdef.validation_regex)
            if regex_err:
                errors.append(regex_err)

    # Business rule: date range validation
    date_err = _validate_date_range(params)
    if date_err:
        errors.append(date_err)

    return ValidationResult(valid=len(errors) == 0, errors=errors)
