"""NEEDS_HUMAN state handling and human intervention API.

When AI fails after all retries, the task transitions to NEEDS_HUMAN.
This module provides the data structures and resolution logic for
human operators to inspect and resolve stuck tasks.
"""

import enum
import logging
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


class ResolutionAction(str, enum.Enum):
    """Actions a human operator can take on a NEEDS_HUMAN task."""

    SKIP_STEP = "skip_step"          # Skip this step and continue
    MANUAL_COMPLETE = "manual_complete"  # Mark step as manually completed
    TERMINATE = "terminate"          # Terminate the task


@dataclass
class StuckTaskInfo:
    """Information about a task in NEEDS_HUMAN state."""

    task_id: str
    org_id: str
    department_id: str
    stuck_action_index: int
    stuck_action_type: str
    page_url: str | None
    screenshot_key: str | None
    llm_errors: list[str]
    llm_raw_response: str | None
    stuck_since: str  # ISO 8601
    total_actions: int
    completed_actions: int


@dataclass
class HumanResolution:
    """Resolution applied by a human operator."""

    task_id: str
    action: ResolutionAction
    resolved_by: str  # user_id
    note: str = ""
    manual_result: dict | None = None  # For manual_complete
    resolved_at: str = ""

    def __post_init__(self):
        if not self.resolved_at:
            self.resolved_at = datetime.utcnow().isoformat()


def resolve_stuck_task(
    task_info: StuckTaskInfo,
    resolution: HumanResolution,
) -> dict:
    """Process a human resolution for a stuck task.

    Args:
        task_info: Information about the stuck task.
        resolution: The human operator's resolution.

    Returns:
        Dict with the new task state and next action instructions.
    """
    if resolution.action == ResolutionAction.SKIP_STEP:
        logger.info(
            "Task %s: step %d skipped by %s (note: %s)",
            task_info.task_id,
            task_info.stuck_action_index,
            resolution.resolved_by,
            resolution.note,
        )
        return {
            "task_id": task_info.task_id,
            "new_status": "running",
            "resume_from_action": task_info.stuck_action_index + 1,
            "resolution": "skip_step",
            "resolved_by": resolution.resolved_by,
        }

    if resolution.action == ResolutionAction.MANUAL_COMPLETE:
        logger.info(
            "Task %s: step %d manually completed by %s",
            task_info.task_id,
            task_info.stuck_action_index,
            resolution.resolved_by,
        )
        return {
            "task_id": task_info.task_id,
            "new_status": "running",
            "resume_from_action": task_info.stuck_action_index + 1,
            "resolution": "manual_complete",
            "manual_result": resolution.manual_result,
            "resolved_by": resolution.resolved_by,
        }

    if resolution.action == ResolutionAction.TERMINATE:
        logger.info(
            "Task %s: terminated by %s (note: %s)",
            task_info.task_id,
            resolution.resolved_by,
            resolution.note,
        )
        return {
            "task_id": task_info.task_id,
            "new_status": "terminated",
            "resolution": "terminate",
            "resolved_by": resolution.resolved_by,
        }

    raise ValueError(f"Unknown resolution action: {resolution.action}")
