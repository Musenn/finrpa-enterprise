"""ExecutorAgent: executes individual sub-tasks from a plan.

Reuses Skyvern's perception-action loop at the sub-task granularity.
Each sub-task execution returns a structured result to the coordinator.
"""

import logging
import time
from datetime import datetime
from typing import Any

from .schemas import ExecutionResult, SubTask, SubTaskStatus

logger = logging.getLogger(__name__)


class ExecutorAgent:
    """Executes sub-tasks from PlannerAgent plans.

    Each sub-task is run via a configurable action handler (which in production
    wraps Skyvern's perception-action loop). Results are reported back
    to the coordinator for state tracking and potential replanning.
    """

    def __init__(self, action_handler=None):
        """
        Args:
            action_handler: async function(goal: str, context: dict) -> dict
                            that performs the actual browser interaction.
                            Returns {"success": bool, "data": dict, "error": str | None,
                                     "screenshot_key": str | None, "page_url": str | None}
        """
        self.action_handler = action_handler

    async def execute_subtask(
        self,
        subtask: SubTask,
        context: dict[str, Any] | None = None,
    ) -> ExecutionResult:
        """Execute a single sub-task with retry logic.

        Args:
            subtask: The sub-task to execute.
            context: Execution context (browser page, session data, etc.).

        Returns:
            ExecutionResult with success status and details.
        """
        subtask.status = SubTaskStatus.RUNNING
        subtask.started_at = datetime.utcnow()

        start = time.monotonic()
        last_error = None

        for attempt in range(subtask.max_retries + 1):
            try:
                if self.action_handler:
                    handler_result = await self.action_handler(
                        subtask.goal, context or {},
                    )
                else:
                    handler_result = self._simulate_execution(subtask)

                elapsed = int((time.monotonic() - start) * 1000)

                if handler_result.get("success", False):
                    subtask.status = SubTaskStatus.COMPLETED
                    subtask.completed_at = datetime.utcnow()
                    subtask.result_data = handler_result.get("data")

                    logger.info(
                        "ExecutorAgent: subtask %s completed in %dms (attempt %d)",
                        subtask.subtask_id, elapsed, attempt + 1,
                    )
                    return ExecutionResult(
                        subtask_id=subtask.subtask_id,
                        success=True,
                        result_data=handler_result.get("data"),
                        screenshot_key=handler_result.get("screenshot_key"),
                        page_url=handler_result.get("page_url"),
                        duration_ms=elapsed,
                    )

                last_error = handler_result.get("error", "Unknown error")
                logger.warning(
                    "ExecutorAgent: subtask %s attempt %d failed: %s",
                    subtask.subtask_id, attempt + 1, last_error,
                )

            except Exception as e:
                last_error = str(e)
                logger.warning(
                    "ExecutorAgent: subtask %s attempt %d exception: %s",
                    subtask.subtask_id, attempt + 1, e,
                )

            if attempt < subtask.max_retries:
                logger.info(
                    "ExecutorAgent: retrying subtask %s (%d/%d)",
                    subtask.subtask_id, attempt + 2, subtask.max_retries + 1,
                )

        # All retries exhausted
        elapsed = int((time.monotonic() - start) * 1000)
        subtask.status = SubTaskStatus.FAILED
        subtask.completed_at = datetime.utcnow()
        subtask.error_message = last_error

        logger.error(
            "ExecutorAgent: subtask %s failed after %d attempts: %s",
            subtask.subtask_id, subtask.max_retries + 1, last_error,
        )
        return ExecutionResult(
            subtask_id=subtask.subtask_id,
            success=False,
            error_message=last_error,
            duration_ms=elapsed,
        )

    def _simulate_execution(self, subtask: SubTask) -> dict:
        """Fallback simulation when no action_handler is provided.

        Used in testing and development.
        """
        return {
            "success": True,
            "data": {"goal": subtask.goal, "simulated": True},
        }
