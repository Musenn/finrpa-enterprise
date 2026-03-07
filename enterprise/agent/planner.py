"""PlannerAgent: decomposes navigation goals into ordered sub-task plans.

Receives a high-level navigation goal and current task context, then
produces a structured TaskPlan with ordered SubTasks. Each sub-task
has a clear goal, completion condition, and failure strategy.

On failure reports from ExecutorAgent, the Planner can generate a
revised plan (replan) for the remaining steps.
"""

import json
import logging
from typing import Any

from pydantic import BaseModel, Field

from .schemas import FailureStrategy, SubTask, TaskPlan

logger = logging.getLogger(__name__)


class PlannerOutput(BaseModel):
    """Schema for LLM-generated plan output."""

    steps: list[dict[str, Any]] = Field(
        description="Ordered list of sub-tasks",
    )


PLANNER_SYSTEM_PROMPT = """\
You are a financial RPA planning agent. Your job is to decompose a navigation \
goal into a sequence of concrete sub-tasks that a browser automation executor \
can perform step by step.

Each sub-task must have:
- "goal": a clear, actionable description of what to do
- "completion_condition": how to verify success (e.g. "page URL contains /dashboard")
- "failure_strategy": one of "retry", "skip", "abort", "replan"
- "max_retries": integer (default 2)

Output ONLY a JSON object with a "steps" array. No other text.

Example:
{
  "steps": [
    {"goal": "Login to the system", "completion_condition": "URL contains /home", "failure_strategy": "abort", "max_retries": 3},
    {"goal": "Navigate to account page", "completion_condition": "Page title contains Account", "failure_strategy": "replan", "max_retries": 2}
  ]
}
"""

REPLAN_SYSTEM_PROMPT = """\
You are a financial RPA planning agent. A previous plan failed at a specific \
step. You are given the original goal, the steps completed so far, and the \
failure details. Generate a REVISED plan for the remaining steps only. \
Do NOT repeat already-completed steps.

Output ONLY a JSON object with a "steps" array.
"""


class PlannerAgent:
    """Decomposes navigation goals into sub-task plans.

    Uses an LLM to generate structured plans. Falls back to a
    single-step plan if LLM is unavailable.
    """

    def __init__(self, llm_callable=None):
        """
        Args:
            llm_callable: async function(prompt: str) -> str
        """
        self.llm_callable = llm_callable

    async def create_plan(
        self,
        navigation_goal: str,
        context: dict[str, Any] | None = None,
    ) -> TaskPlan:
        """Generate an initial task plan from a navigation goal.

        Args:
            navigation_goal: High-level goal (e.g. "Download bank statements for Q1 2026").
            context: Optional context (current URL, page state, etc.).

        Returns:
            TaskPlan with ordered SubTasks.
        """
        if self.llm_callable:
            return await self._plan_with_llm(navigation_goal, context)
        return self._create_fallback_plan(navigation_goal)

    async def replan(
        self,
        original_goal: str,
        completed_subtasks: list[SubTask],
        failed_subtask: SubTask,
        failure_reason: str,
        context: dict[str, Any] | None = None,
    ) -> TaskPlan:
        """Generate a revised plan after a sub-task failure.

        Args:
            original_goal: The original navigation goal.
            completed_subtasks: Sub-tasks that completed successfully.
            failed_subtask: The sub-task that failed.
            failure_reason: Why it failed (error message, screenshot description).
            context: Current page state context.

        Returns:
            Revised TaskPlan for remaining steps.
        """
        if self.llm_callable:
            return await self._replan_with_llm(
                original_goal, completed_subtasks, failed_subtask, failure_reason, context,
            )

        # Fallback: skip the failed step and create a continuation plan
        return TaskPlan(
            navigation_goal=original_goal,
            subtasks=[
                SubTask(
                    index=0,
                    goal=f"Continue after failure: {original_goal}",
                    completion_condition="Task goal achieved",
                    failure_strategy=FailureStrategy.ABORT,
                ),
            ],
            is_replan=True,
            replan_reason=failure_reason,
            version=len(completed_subtasks) + 2,
        )

    async def _plan_with_llm(
        self,
        navigation_goal: str,
        context: dict[str, Any] | None,
    ) -> TaskPlan:
        """Generate plan using LLM."""
        ctx_str = json.dumps(context) if context else "No additional context."
        prompt = (
            f"{PLANNER_SYSTEM_PROMPT}\n\n"
            f"## Navigation Goal\n{navigation_goal}\n\n"
            f"## Context\n{ctx_str}\n"
        )

        try:
            raw = await self.llm_callable(prompt)
            # Parse LLM output
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
                cleaned = "\n".join(lines[1:-1])
            data = json.loads(cleaned)

            subtasks = []
            for i, step in enumerate(data.get("steps", [])):
                subtasks.append(SubTask(
                    index=i,
                    goal=step.get("goal", f"Step {i + 1}"),
                    completion_condition=step.get("completion_condition", ""),
                    max_retries=step.get("max_retries", 2),
                    failure_strategy=FailureStrategy(
                        step.get("failure_strategy", "replan")
                    ),
                ))

            plan = TaskPlan(
                navigation_goal=navigation_goal,
                subtasks=subtasks,
            )
            logger.info(
                "PlannerAgent: created plan with %d sub-tasks for: %s",
                len(subtasks), navigation_goal,
            )
            return plan

        except Exception as e:
            logger.warning(
                "PlannerAgent: LLM planning failed (%s), using fallback", e,
            )
            return self._create_fallback_plan(navigation_goal)

    async def _replan_with_llm(
        self,
        original_goal: str,
        completed_subtasks: list[SubTask],
        failed_subtask: SubTask,
        failure_reason: str,
        context: dict[str, Any] | None,
    ) -> TaskPlan:
        """Generate revised plan using LLM."""
        completed_summary = "\n".join(
            f"- Step {s.index}: {s.goal} [COMPLETED]"
            for s in completed_subtasks
        )
        prompt = (
            f"{REPLAN_SYSTEM_PROMPT}\n\n"
            f"## Original Goal\n{original_goal}\n\n"
            f"## Completed Steps\n{completed_summary or 'None'}\n\n"
            f"## Failed Step\nStep {failed_subtask.index}: {failed_subtask.goal}\n"
            f"Failure reason: {failure_reason}\n\n"
            f"## Context\n{json.dumps(context) if context else 'None'}\n"
        )

        try:
            raw = await self.llm_callable(prompt)
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
                cleaned = "\n".join(lines[1:-1])
            data = json.loads(cleaned)

            subtasks = []
            for i, step in enumerate(data.get("steps", [])):
                subtasks.append(SubTask(
                    index=len(completed_subtasks) + i,
                    goal=step.get("goal", f"Step {i + 1}"),
                    completion_condition=step.get("completion_condition", ""),
                    max_retries=step.get("max_retries", 2),
                    failure_strategy=FailureStrategy(
                        step.get("failure_strategy", "replan")
                    ),
                ))

            plan = TaskPlan(
                navigation_goal=original_goal,
                subtasks=subtasks,
                is_replan=True,
                replan_reason=failure_reason,
                version=len(completed_subtasks) + 2,
            )
            logger.info(
                "PlannerAgent: replanned with %d new sub-tasks (reason: %s)",
                len(subtasks), failure_reason[:80],
            )
            return plan

        except Exception as e:
            logger.warning("PlannerAgent: LLM replan failed (%s), using fallback", e)
            return TaskPlan(
                navigation_goal=original_goal,
                subtasks=[
                    SubTask(
                        index=len(completed_subtasks),
                        goal=f"Continue after failure: {original_goal}",
                        completion_condition="Task goal achieved",
                        failure_strategy=FailureStrategy.ABORT,
                    ),
                ],
                is_replan=True,
                replan_reason=failure_reason,
                version=len(completed_subtasks) + 2,
            )

    def _create_fallback_plan(self, navigation_goal: str) -> TaskPlan:
        """Create a simple single-step plan (no LLM needed)."""
        return TaskPlan(
            navigation_goal=navigation_goal,
            subtasks=[
                SubTask(
                    index=0,
                    goal=navigation_goal,
                    completion_condition="Navigation goal achieved",
                    failure_strategy=FailureStrategy.ABORT,
                    max_retries=3,
                ),
            ],
        )
