"""LLM model router based on page complexity estimation.

Routes simple pages to lightweight (cheaper/faster) models and complex
pages to large (more capable) models based on DOM characteristics.

Complexity factors:
- DOM element count
- iframe nesting depth
- Dynamic content indicators (AJAX, WebSocket, shadow DOM)
"""

import logging
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class ComplexityLevel(str, Enum):
    """Page complexity classification."""

    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"


class ModelTier(str, Enum):
    """LLM model tier."""

    LIGHT = "light"     # e.g., Claude Haiku, GPT-4o-mini
    STANDARD = "standard"  # e.g., Claude Sonnet
    HEAVY = "heavy"     # e.g., Claude Opus, GPT-4o


@dataclass
class PageFeatures:
    """DOM characteristics used for complexity estimation."""

    element_count: int = 0
    has_iframe: bool = False
    iframe_depth: int = 0
    has_dynamic_content: bool = False
    has_shadow_dom: bool = False
    form_field_count: int = 0


@dataclass
class RoutingDecision:
    """Model routing decision with reasoning."""

    model_tier: ModelTier
    complexity: ComplexityLevel
    reason: str
    features: PageFeatures


# Thresholds for complexity classification
ELEMENT_THRESHOLD_SIMPLE = 100
ELEMENT_THRESHOLD_MODERATE = 500
FORM_FIELD_THRESHOLD_COMPLEX = 20


def estimate_complexity(features: PageFeatures) -> ComplexityLevel:
    """Estimate page complexity from DOM features.

    Classification logic:
    - COMPLEX: deep iframes, shadow DOM, many elements, or many form fields
    - MODERATE: iframes present, dynamic content, or moderate element count
    - SIMPLE: everything else
    """
    # Complex conditions
    if features.iframe_depth >= 2:
        return ComplexityLevel.COMPLEX
    if features.has_shadow_dom:
        return ComplexityLevel.COMPLEX
    if features.element_count > ELEMENT_THRESHOLD_MODERATE:
        return ComplexityLevel.COMPLEX
    if features.form_field_count >= FORM_FIELD_THRESHOLD_COMPLEX:
        return ComplexityLevel.COMPLEX

    # Moderate conditions
    if features.has_iframe:
        return ComplexityLevel.MODERATE
    if features.has_dynamic_content:
        return ComplexityLevel.MODERATE
    if features.element_count > ELEMENT_THRESHOLD_SIMPLE:
        return ComplexityLevel.MODERATE

    return ComplexityLevel.SIMPLE


# Complexity -> Model tier mapping
COMPLEXITY_TO_TIER: dict[ComplexityLevel, ModelTier] = {
    ComplexityLevel.SIMPLE: ModelTier.LIGHT,
    ComplexityLevel.MODERATE: ModelTier.STANDARD,
    ComplexityLevel.COMPLEX: ModelTier.HEAVY,
}


def route_model(features: PageFeatures) -> RoutingDecision:
    """Determine which LLM model tier to use based on page features.

    Args:
        features: DOM characteristics of the target page.

    Returns:
        RoutingDecision with model tier, complexity level, and reasoning.
    """
    complexity = estimate_complexity(features)
    tier = COMPLEXITY_TO_TIER[complexity]

    reasons = []
    if features.element_count > 0:
        reasons.append(f"elements={features.element_count}")
    if features.has_iframe:
        reasons.append(f"iframe_depth={features.iframe_depth}")
    if features.has_dynamic_content:
        reasons.append("dynamic_content")
    if features.has_shadow_dom:
        reasons.append("shadow_dom")
    if features.form_field_count > 0:
        reasons.append(f"form_fields={features.form_field_count}")

    reason = f"{complexity.value} page ({', '.join(reasons) or 'default'})"

    decision = RoutingDecision(
        model_tier=tier,
        complexity=complexity,
        reason=reason,
        features=features,
    )

    logger.info(
        "Model routing: %s -> %s (%s)",
        complexity.value,
        tier.value,
        reason,
    )

    return decision
