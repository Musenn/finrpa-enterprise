"""AgentCoordinator: orchestrates Planner + Executor communication.

Manages the full lifecycle of a multi-step task:
1. Planner creates initial plan
2. Executor runs sub-tasks sequentially
3. On failure, Coordinator asks Planner to replan
4. Sub-task states persist for resumption
5. Audit logging at sub-task granularity
"""

import logging
from datetime import datetime
from typing import Any

from .executor import ExecutorAgent
from .planner import PlannerAgent
from .schemas import (
    CoordinationState,
    ExecutionResult,
    FailureStrategy,
    SubTask,
    SubTaskStatus,
    TaskPlan,
)

logger = logging.getLogger(__name__)


class AgentCoordinator:
    """Orchestrates Planner and Executor agents.

    Handles:
    - Initial plan creation
    - Sequential sub-task execution
    - Failure detection and replanning
    - Breakpoint resumption (skip already-completed sub-tasks)
    - Audit callback integration
    """

    def __init__(
        self,
        planner: PlannerAgent,
        executor: ExecutorAgent,
        audit_callback=None,
        max_replans: int = 3,
    ):
        """
        Args:
            planner: PlannerAgent instance.
            executor: ExecutorAgent instance.
            audit_callback: Optional async callback(subtask, result) for audit logging.
            max_replans: Maximum number of replanning attempts.
        """
        self.planner = planner
        self.executor = executor
        self.audit_callback = audit_callback
        self.max_replans = max_replans

    async def run(
        self,
        task_id: str,
        org_id: str,
        navigation_goal: str,
        context: dict[str, Any] | None = None,
        resume_from: list[str] | None = None,
    ) -> CoordinationState:
        """Execute a full task through Planner -> Executor coordination.

        Args:
            task_id: Unique task identifier.
            org_id: Organization ID for tenant isolation.
            navigation_goal: High-level user goal.
            context: Shared execution context.
            resume_from: List of already-completed subtask IDs (for resumption).

        Returns:
            CoordinationState with final status and results.
        """
        state = CoordinationState(
            task_id=task_id,
            org_id=org_id,
            navigation_goal=navigation_goal,
            completed_subtasks=resume_from or [],
        )

        # Step 1: Create initial plan
        try:
            plan = await self.planner.create_plan(navigation_goal, context)
        except Exception as e:
            logger.error("Coordinator: planning failed for task %s: %s", task_id, e)
            state.status = "failed"
            state.error_message = f"Planning failed: {e}"
            return state

        state.current_plan = plan
        logger.info(
            "Coordinator: task %s planned with %d sub-tasks",
            task_id, len(plan.subtasks),
        )

        # Step 2: Execute sub-tasks
        completed_subtasks: list[SubTask] = []

        return await self._execute_plan(
            state, plan, completed_subtasks, context,
        )

    async def _execute_plan(
        self,
        state: CoordinationState,
        plan: TaskPlan,
        completed_subtasks: list[SubTask],
        context: dict[str, Any] | None,
    ) -> CoordinationState:
        """Execute all sub-tasks in a plan."""

        for subtask in plan.subtasks:
            # Skip already-completed sub-tasks (resumption)
            if subtask.subtask_id in state.completed_subtasks:
                logger.info(
                    "Coordinator: skipping already-completed subtask %s",
                    subtask.subtask_id,
                )
                completed_subtasks.append(subtask)
                continue

            # Execute
            result = await self.executor.execute_subtask(subtask, context)

            # Audit callback
            if self.audit_callback:
                try:
                    await self.audit_callback(subtask, result)
                except Exception as e:
                    logger.warning(
                        "Coordinator: audit callback failed for subtask %s: %s",
                        subtask.subtask_id, e,
                    )

            if result.success:
                state.completed_subtasks.append(subtask.subtask_id)
                completed_subtasks.append(subtask)
                continue

            # Handle failure based on strategy
            outcome = await self._handle_failure(
                state, plan, subtask, result, completed_subtasks, context,
            )
            if outcome == "aborted":
                return state
            if outcome == "replanned":
                return state  # _handle_failure already recursed into new plan

        # All sub-tasks completed
        state.status = "completed"
        logger.info("Coordinator: task %s completed successfully", state.task_id)
        return state

    async def _handle_failure(
        self,
        state: CoordinationState,
        plan: TaskPlan,
        failed_subtask: SubTask,
        result: ExecutionResult,
        completed_subtasks: list[SubTask],
        context: dict[str, Any] | None,
    ) -> str:
        """Handle a sub-task failure based on its failure strategy.

        Returns:
            "continued" — skip and continue
            "aborted" — task is done (failed or needs_human)
            "replanned" — new plan generated and executed
        """
        strategy = failed_subtask.failure_strategy

        if strategy == FailureStrategy.SKIP:
            logger.info(
                "Coordinator: skipping failed subtask %s",
                failed_subtask.subtask_id,
            )
            failed_subtask.status = SubTaskStatus.SKIPPED
            return "continued"

        if strategy == FailureStrategy.ABORT:
            logger.error(
                "Coordinator: aborting task %s at subtask %s",
                state.task_id, failed_subtask.subtask_id,
            )
            state.status = "failed"
            state.error_message = (
                f"Sub-task {failed_subtask.index} failed: {result.error_message}"
            )
            return "aborted"

        if strategy == FailureStrategy.REPLAN:
            if state.total_replans >= self.max_replans:
                logger.error(
                    "Coordinator: max replans (%d) reached for task %s",
                    self.max_replans, state.task_id,
                )
                state.status = "needs_human"
                state.error_message = (
                    f"Max replans exceeded. Last failure: {result.error_message}"
                )
                return "aborted"

            state.total_replans += 1
            logger.info(
                "Coordinator: replanning task %s (attempt %d/%d)",
                state.task_id, state.total_replans, self.max_replans,
            )

            try:
                new_plan = await self.planner.replan(
                    original_goal=state.navigation_goal,
                    completed_subtasks=completed_subtasks,
                    failed_subtask=failed_subtask,
                    failure_reason=result.error_message or "Unknown error",
                    context=context,
                )
            except Exception as e:
                logger.error("Coordinator: replan failed: %s", e)
                state.status = "needs_human"
                state.error_message = f"Replan failed: {e}"
                return "aborted"

            state.current_plan = new_plan

            # Execute the new plan
            await self._execute_plan(state, new_plan, completed_subtasks, context)
            return "replanned"

        # Default: RETRY strategy is handled by ExecutorAgent internally
        # If we reach here, retries were exhausted
        state.status = "failed"
        state.error_message = (
            f"Sub-task {failed_subtask.index} failed after retries: {result.error_message}"
        )
        return "aborted"
