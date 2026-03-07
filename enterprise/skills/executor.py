"""Skill execution engine.

Runs a sequence of skills (a skill pipeline) with error handling,
retry logic, and audit logging integration.
"""

import logging
import time
from dataclasses import dataclass, field
from typing import Any

from .base import (
    BaseSkill,
    ErrorStrategy,
    SkillResult,
    SkillStatus,
    get_skill,
)

logger = logging.getLogger(__name__)


@dataclass
class SkillStep:
    """A single step in a skill pipeline."""

    skill_name: str
    params: dict[str, Any]
    description: str = ""
    error_strategy_override: str | None = None  # override skill default


@dataclass
class PipelineResult:
    """Result of executing a full skill pipeline."""

    success: bool = True
    steps_completed: int = 0
    steps_total: int = 0
    step_results: list[dict[str, Any]] = field(default_factory=list)
    total_duration_ms: int = 0
    aborted_at_step: int | None = None
    error_message: str | None = None


async def execute_pipeline(
    steps: list[SkillStep],
    context: dict[str, Any] | None = None,
    audit_callback=None,
) -> PipelineResult:
    """Execute a sequence of skill steps.

    Args:
        steps: Ordered list of SkillSteps to execute.
        context: Shared execution context (browser page, session, etc.).
        audit_callback: Optional async callback(step_index, skill_name, params_dict, result)
                        for audit logging.

    Returns:
        PipelineResult with per-step results and overall status.
    """
    pipeline_start = time.monotonic()
    result = PipelineResult(steps_total=len(steps))

    for i, step in enumerate(steps):
        skill_cls = get_skill(step.skill_name)
        if skill_cls is None:
            logger.error("Unknown skill: %s (step %d)", step.skill_name, i)
            result.step_results.append({
                "step": i,
                "skill": step.skill_name,
                "status": "failed",
                "error": f"Unknown skill: {step.skill_name}",
            })
            result.success = False
            result.aborted_at_step = i
            result.error_message = f"Unknown skill: {step.skill_name}"
            break

        skill: BaseSkill = skill_cls()
        error_strategy = (
            ErrorStrategy(step.error_strategy_override)
            if step.error_strategy_override
            else skill.error_strategy
        )

        # Validate params
        try:
            validated_params = skill.validate_params(step.params)
        except Exception as e:
            logger.error("Param validation failed for %s: %s", step.skill_name, e)
            result.step_results.append({
                "step": i,
                "skill": step.skill_name,
                "status": "failed",
                "error": f"Invalid params: {e}",
            })
            if error_strategy == ErrorStrategy.ABORT:
                result.success = False
                result.aborted_at_step = i
                result.error_message = f"Param validation failed at step {i}"
                break
            continue

        # Execute with retry
        max_attempts = skill.max_retries + 1 if error_strategy == ErrorStrategy.RETRY else 1
        skill_result: SkillResult | None = None

        for attempt in range(max_attempts):
            skill_result = await skill.execute(validated_params, context)

            if skill_result.status == SkillStatus.COMPLETED:
                break

            if attempt < max_attempts - 1:
                logger.info(
                    "Retrying %s (attempt %d/%d)",
                    step.skill_name, attempt + 2, max_attempts,
                )

        assert skill_result is not None

        # Record step result
        step_record = {
            "step": i,
            "skill": step.skill_name,
            "status": skill_result.status.value,
            "duration_ms": skill_result.duration_ms,
            "data": skill_result.data,
        }
        if skill_result.error_message:
            step_record["error"] = skill_result.error_message
        result.step_results.append(step_record)

        # Audit callback
        if audit_callback:
            try:
                audit_dict = skill.to_audit_dict(validated_params)
                await audit_callback(i, step.skill_name, audit_dict, skill_result)
            except Exception as e:
                logger.warning("Audit callback failed for step %d: %s", i, e)

        # Handle failure based on error strategy
        if skill_result.status in (SkillStatus.FAILED, SkillStatus.SKIPPED):
            if skill_result.status == SkillStatus.FAILED:
                if error_strategy == ErrorStrategy.ABORT:
                    result.success = False
                    result.aborted_at_step = i
                    result.error_message = (
                        f"Step {i} ({step.skill_name}) failed: {skill_result.error_message}"
                    )
                    break
                elif error_strategy == ErrorStrategy.SKIP:
                    logger.info("Skipping failed step %d (%s)", i, step.skill_name)
                    continue
            # RETRY exhausted falls through here
            if error_strategy == ErrorStrategy.RETRY and skill_result.status == SkillStatus.FAILED:
                result.success = False
                result.aborted_at_step = i
                result.error_message = (
                    f"Step {i} ({step.skill_name}) failed after retries: "
                    f"{skill_result.error_message}"
                )
                break

        result.steps_completed += 1

    result.total_duration_ms = int((time.monotonic() - pipeline_start) * 1000)
    return result
