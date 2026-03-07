"""Two-stage financial risk detection engine.

Stage 1: Fast keyword + regex scan against industry-specific libraries.
Stage 2: LLM-based contextual analysis (only if Stage 1 hits).
Fallback: If LLM fails and Stage 1 hit, conservatively return 'high'.
"""

import structlog
from dataclasses import dataclass, field

from .risk_keywords import (
    ALL_KEYWORDS,
    INDUSTRY_KEYWORDS,
    IndustryType,
    KeywordEntry,
    has_high_amount,
)

LOG = structlog.get_logger()


@dataclass
class RiskAssessment:
    """Result of risk detection on an operation."""

    risk_level: str  # "low", "medium", "high", "critical"
    reason: str
    matched_keywords: list[str] = field(default_factory=list)
    stage: int = 1  # 1 = keyword only, 2 = LLM confirmed
    llm_fallback: bool = False  # True if LLM failed and stage 1 result was used


def _keyword_scan(
    text: str,
    industry: IndustryType | None = None,
) -> list[KeywordEntry]:
    """Stage 1: Fast keyword matching against industry keyword libraries.

    Returns all matched keyword entries sorted by risk level (critical first).
    """
    keywords = INDUSTRY_KEYWORDS.get(industry, ALL_KEYWORDS) if industry else ALL_KEYWORDS
    text_lower = text.lower()

    matched = []
    for kw in keywords:
        if kw.keyword.lower() in text_lower:
            matched.append(kw)

    # Sort by risk severity: critical > high > medium
    risk_order = {"critical": 0, "high": 1, "medium": 2}
    matched.sort(key=lambda k: risk_order.get(k.risk_level, 3))

    return matched


async def _llm_risk_analysis(
    text: str,
    matched_keywords: list[KeywordEntry],
    page_context: str | None = None,
    llm_callable=None,
) -> RiskAssessment | None:
    """Stage 2: LLM-based contextual risk analysis.

    Calls the provided LLM function to analyze the operation in context.
    Returns None if LLM is unavailable or fails.
    """
    if llm_callable is None:
        return None

    prompt = (
        "You are a financial compliance officer. Analyze the following operation "
        "and determine its risk level (medium, high, or critical).\n\n"
        f"Operation description: {text}\n"
        f"Matched risk keywords: {', '.join(kw.keyword for kw in matched_keywords)}\n"
    )
    if page_context:
        prompt += f"Page context: {page_context}\n"

    prompt += (
        "\nRespond with exactly one JSON object:\n"
        '{"risk_level": "medium|high|critical", "reason": "brief explanation"}\n'
    )

    try:
        result = await llm_callable(prompt)
        if result and isinstance(result, dict):
            level = result.get("risk_level", "high")
            reason = result.get("reason", "LLM analysis")
            if level in ("medium", "high", "critical"):
                return RiskAssessment(
                    risk_level=level,
                    reason=reason,
                    matched_keywords=[kw.keyword for kw in matched_keywords],
                    stage=2,
                )
    except Exception as e:
        LOG.warning("LLM risk analysis failed", error=str(e))

    return None


async def detect_risk(
    text: str,
    industry: IndustryType | None = None,
    page_context: str | None = None,
    llm_callable=None,
) -> RiskAssessment:
    """Run two-stage risk detection on an operation description.

    Args:
        text: The operation description or action text to analyze.
        industry: Optional industry type for targeted keyword matching.
        page_context: Optional page HTML/text context for LLM analysis.
        llm_callable: Optional async function(prompt: str) -> dict for LLM.

    Returns:
        RiskAssessment with the determined risk level and reasoning.
    """
    # Stage 1: Keyword + regex scan
    matched = _keyword_scan(text, industry)

    if not matched:
        # Check for high amounts even without keyword match
        if has_high_amount(text):
            return RiskAssessment(
                risk_level="medium",
                reason="Large monetary amount detected without specific risk keywords",
                matched_keywords=[],
                stage=1,
            )
        return RiskAssessment(
            risk_level="low",
            reason="No risk indicators detected",
            stage=1,
        )

    # Determine Stage 1 risk level (highest among matched keywords)
    stage1_level = matched[0].risk_level  # Already sorted, first is highest
    stage1_keywords = [kw.keyword for kw in matched]

    # Escalate if high amounts detected alongside keywords
    if has_high_amount(text) and stage1_level == "high":
        stage1_level = "critical"

    LOG.info(
        "Stage 1 risk detected",
        level=stage1_level,
        keywords=stage1_keywords[:5],
        text_preview=text[:100],
    )

    # Stage 2: LLM analysis (only if Stage 1 hit)
    llm_result = await _llm_risk_analysis(
        text, matched, page_context, llm_callable
    )

    if llm_result:
        LOG.info(
            "Stage 2 LLM confirmed risk",
            level=llm_result.risk_level,
            reason=llm_result.reason,
        )
        return llm_result

    # LLM unavailable or failed — conservative fallback
    if llm_callable is not None:
        LOG.warning(
            "LLM risk analysis failed, using conservative fallback",
            stage1_level=stage1_level,
        )
        fallback_level = "high" if stage1_level == "medium" else stage1_level
        return RiskAssessment(
            risk_level=fallback_level,
            reason=f"Stage 1 keyword match (LLM fallback): {', '.join(stage1_keywords[:3])}",
            matched_keywords=stage1_keywords,
            stage=1,
            llm_fallback=True,
        )

    # No LLM configured — return Stage 1 result directly
    return RiskAssessment(
        risk_level=stage1_level,
        reason=f"Keyword match: {', '.join(stage1_keywords[:3])}",
        matched_keywords=stage1_keywords,
        stage=1,
    )
