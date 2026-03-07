"""Data models for the multi-agent coordination system.

Defines SubTask, TaskPlan, and execution result structures used by
PlannerAgent, ExecutorAgent, and AgentCoordinator.
"""

import enum
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class FailureStrategy(str, enum.Enum):
    """What to do when a sub-task fails."""

    RETRY = "retry"
    SKIP = "skip"
    ABORT = "abort"
    REPLAN = "replan"  # ask Planner to revise remaining steps


class SubTaskStatus(str, enum.Enum):
    """Execution status of a single sub-task."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    REPLANNED = "replanned"  # replaced by a new plan


class SubTask(BaseModel):
    """A single step in a task plan, produced by PlannerAgent."""

    subtask_id: str = Field(default_factory=lambda: f"sub_{uuid.uuid4().hex[:12]}")
    index: int = Field(description="Execution order (0-based)")
    goal: str = Field(description="What this sub-task should accomplish")
    completion_condition: str = Field(
        description="How to verify the sub-task succeeded",
    )
    max_retries: int = Field(default=2, description="Max retry attempts")
    failure_strategy: FailureStrategy = Field(
        default=FailureStrategy.REPLAN,
        description="What to do on failure",
    )
    status: SubTaskStatus = Field(default=SubTaskStatus.PENDING)
    error_message: str | None = None
    result_data: dict | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


class TaskPlan(BaseModel):
    """A complete plan produced by PlannerAgent."""

    plan_id: str = Field(default_factory=lambda: f"plan_{uuid.uuid4().hex[:12]}")
    navigation_goal: str = Field(description="Original user goal")
    subtasks: list[SubTask] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_replan: bool = Field(
        default=False,
        description="True if this plan was generated after a failure replan",
    )
    replan_reason: str | None = None
    version: int = Field(default=1, description="Plan version (increments on replan)")


class ExecutionResult(BaseModel):
    """Result from ExecutorAgent executing a single sub-task."""

    subtask_id: str
    success: bool
    result_data: dict | None = None
    error_message: str | None = None
    screenshot_key: str | None = None  # MinIO key for page state
    page_url: str | None = None
    duration_ms: int | None = None


class CoordinationState(BaseModel):
    """Overall state of the Planner-Executor coordination."""

    task_id: str
    org_id: str
    navigation_goal: str
    current_plan: TaskPlan | None = None
    completed_subtasks: list[str] = Field(
        default_factory=list,
        description="IDs of completed sub-tasks (for resumption)",
    )
    total_replans: int = 0
    max_replans: int = Field(default=3)
    status: str = "running"  # running / completed / failed / needs_human
    error_message: str | None = None
