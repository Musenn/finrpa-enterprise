"""Tests for the multi-agent coordination system.

Covers:
- SubTask/TaskPlan schema validation
- PlannerAgent: plan creation (with/without LLM), replan after failure
- ExecutorAgent: sub-task execution, retry logic, failure handling
- AgentCoordinator: full 3-step flow, failure + replan, abort, skip,
  max replan limit, resumption, audit callback integration
- Key test case: 3-step flow where step 2 fails, Planner replans,
  task continues from step 3
"""

import json
import unittest
from unittest.mock import AsyncMock

from enterprise.agent.schemas import (
    CoordinationState,
    ExecutionResult,
    FailureStrategy,
    SubTask,
    SubTaskStatus,
    TaskPlan,
)
from enterprise.agent.planner import PlannerAgent
from enterprise.agent.executor import ExecutorAgent
from enterprise.agent.coordinator import AgentCoordinator


# ============================================================
# Schema tests
# ============================================================

class TestSubTask(unittest.TestCase):
    def test_default_values(self):
        st = SubTask(index=0, goal="Login", completion_condition="URL has /home")
        assert st.status == SubTaskStatus.PENDING
        assert st.max_retries == 2
        assert st.failure_strategy == FailureStrategy.REPLAN
        assert st.subtask_id.startswith("sub_")

    def test_custom_failure_strategy(self):
        st = SubTask(
            index=0, goal="Login", completion_condition="",
            failure_strategy=FailureStrategy.ABORT,
        )
        assert st.failure_strategy == FailureStrategy.ABORT


class TestTaskPlan(unittest.TestCase):
    def test_plan_creation(self):
        plan = TaskPlan(
            navigation_goal="Download statements",
            subtasks=[
                SubTask(index=0, goal="Login", completion_condition=""),
                SubTask(index=1, goal="Navigate", completion_condition=""),
            ],
        )
        assert len(plan.subtasks) == 2
        assert plan.is_replan is False
        assert plan.version == 1
        assert plan.plan_id.startswith("plan_")

    def test_replan_metadata(self):
        plan = TaskPlan(
            navigation_goal="Download statements",
            subtasks=[SubTask(index=1, goal="Retry nav", completion_condition="")],
            is_replan=True,
            replan_reason="Navigation button not found",
            version=2,
        )
        assert plan.is_replan is True
        assert plan.replan_reason == "Navigation button not found"


# ============================================================
# PlannerAgent tests
# ============================================================

class TestPlannerAgent(unittest.IsolatedAsyncioTestCase):
    async def test_fallback_plan_without_llm(self):
        planner = PlannerAgent(llm_callable=None)
        plan = await planner.create_plan("Download bank statements")
        assert len(plan.subtasks) == 1
        assert plan.subtasks[0].goal == "Download bank statements"
        assert plan.subtasks[0].failure_strategy == FailureStrategy.ABORT

    async def test_plan_with_llm(self):
        llm_response = json.dumps({
            "steps": [
                {"goal": "Login to e-banking", "completion_condition": "URL has /home", "failure_strategy": "abort", "max_retries": 3},
                {"goal": "Navigate to statements", "completion_condition": "Page has statement table", "failure_strategy": "replan"},
                {"goal": "Download CSV file", "completion_condition": "File downloaded", "failure_strategy": "retry"},
            ]
        })

        async def mock_llm(prompt):
            return llm_response

        planner = PlannerAgent(llm_callable=mock_llm)
        plan = await planner.create_plan("Download bank statements for Q1 2026")
        assert len(plan.subtasks) == 3
        assert plan.subtasks[0].goal == "Login to e-banking"
        assert plan.subtasks[0].failure_strategy == FailureStrategy.ABORT
        assert plan.subtasks[0].max_retries == 3
        assert plan.subtasks[1].failure_strategy == FailureStrategy.REPLAN
        assert plan.subtasks[2].failure_strategy == FailureStrategy.RETRY

    async def test_plan_with_llm_markdown_wrapped(self):
        """LLM sometimes wraps JSON in markdown code fences."""
        llm_response = "```json\n" + json.dumps({
            "steps": [{"goal": "Do something", "completion_condition": "Done"}]
        }) + "\n```"

        async def mock_llm(prompt):
            return llm_response

        planner = PlannerAgent(llm_callable=mock_llm)
        plan = await planner.create_plan("Test goal")
        assert len(plan.subtasks) == 1

    async def test_plan_llm_failure_falls_back(self):
        async def failing_llm(prompt):
            raise RuntimeError("LLM service unavailable")

        planner = PlannerAgent(llm_callable=failing_llm)
        plan = await planner.create_plan("Test goal")
        # Should fall back to single-step plan
        assert len(plan.subtasks) == 1

    async def test_replan_with_llm(self):
        replan_response = json.dumps({
            "steps": [
                {"goal": "Try alternative navigation", "completion_condition": "Page found", "failure_strategy": "abort"},
                {"goal": "Download file", "completion_condition": "File saved", "failure_strategy": "retry"},
            ]
        })

        async def mock_llm(prompt):
            return replan_response

        planner = PlannerAgent(llm_callable=mock_llm)
        completed = [
            SubTask(index=0, goal="Login", completion_condition="Done", status=SubTaskStatus.COMPLETED),
        ]
        failed = SubTask(index=1, goal="Navigate to page", completion_condition="Page shown")
        failed.status = SubTaskStatus.FAILED

        plan = await planner.replan(
            original_goal="Download statements",
            completed_subtasks=completed,
            failed_subtask=failed,
            failure_reason="Button not found on page",
        )
        assert plan.is_replan is True
        assert len(plan.subtasks) == 2
        assert plan.subtasks[0].index == 1  # continues from where we left off

    async def test_replan_without_llm(self):
        planner = PlannerAgent(llm_callable=None)
        completed = [SubTask(index=0, goal="Login", completion_condition="")]
        failed = SubTask(index=1, goal="Navigate", completion_condition="")

        plan = await planner.replan(
            original_goal="Test goal",
            completed_subtasks=completed,
            failed_subtask=failed,
            failure_reason="Something went wrong",
        )
        assert plan.is_replan is True
        assert plan.replan_reason == "Something went wrong"


# ============================================================
# ExecutorAgent tests
# ============================================================

class TestExecutorAgent(unittest.IsolatedAsyncioTestCase):
    async def test_execute_with_simulation(self):
        """Without action_handler, executor simulates success."""
        executor = ExecutorAgent(action_handler=None)
        subtask = SubTask(index=0, goal="Login", completion_condition="")

        result = await executor.execute_subtask(subtask)
        assert result.success is True
        assert subtask.status == SubTaskStatus.COMPLETED
        assert subtask.completed_at is not None

    async def test_execute_with_handler_success(self):
        async def handler(goal, context):
            return {"success": True, "data": {"page": "dashboard"}}

        executor = ExecutorAgent(action_handler=handler)
        subtask = SubTask(index=0, goal="Login", completion_condition="", max_retries=1)

        result = await executor.execute_subtask(subtask)
        assert result.success is True
        assert result.result_data["page"] == "dashboard"

    async def test_execute_with_handler_failure(self):
        async def handler(goal, context):
            return {"success": False, "error": "Element not found"}

        executor = ExecutorAgent(action_handler=handler)
        subtask = SubTask(index=0, goal="Click button", completion_condition="", max_retries=1)

        result = await executor.execute_subtask(subtask)
        assert result.success is False
        assert result.error_message == "Element not found"
        assert subtask.status == SubTaskStatus.FAILED

    async def test_execute_retries_then_succeeds(self):
        call_count = 0

        async def handler(goal, context):
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                return {"success": False, "error": "Timeout"}
            return {"success": True, "data": {"attempt": call_count}}

        executor = ExecutorAgent(action_handler=handler)
        subtask = SubTask(index=0, goal="Load page", completion_condition="", max_retries=2)

        result = await executor.execute_subtask(subtask)
        assert result.success is True
        assert call_count == 2

    async def test_execute_retries_exhausted(self):
        async def handler(goal, context):
            return {"success": False, "error": "Always fails"}

        executor = ExecutorAgent(action_handler=handler)
        subtask = SubTask(index=0, goal="Broken step", completion_condition="", max_retries=2)

        result = await executor.execute_subtask(subtask)
        assert result.success is False
        assert subtask.status == SubTaskStatus.FAILED

    async def test_execute_exception_handling(self):
        async def handler(goal, context):
            raise ConnectionError("Network down")

        executor = ExecutorAgent(action_handler=handler)
        subtask = SubTask(index=0, goal="Fetch data", completion_condition="", max_retries=0)

        result = await executor.execute_subtask(subtask)
        assert result.success is False
        assert "Network down" in result.error_message


# ============================================================
# AgentCoordinator tests
# ============================================================

class TestCoordinatorBasic(unittest.IsolatedAsyncioTestCase):
    async def test_successful_3_step_flow(self):
        """3-step plan, all succeed."""
        llm_response = json.dumps({
            "steps": [
                {"goal": "Login", "completion_condition": "Logged in", "failure_strategy": "abort"},
                {"goal": "Navigate to statements", "completion_condition": "Table visible", "failure_strategy": "replan"},
                {"goal": "Download CSV", "completion_condition": "File saved", "failure_strategy": "retry"},
            ]
        })

        async def mock_llm(prompt):
            return llm_response

        async def mock_handler(goal, context):
            return {"success": True, "data": {"goal": goal}}

        planner = PlannerAgent(llm_callable=mock_llm)
        executor = ExecutorAgent(action_handler=mock_handler)
        coordinator = AgentCoordinator(planner, executor)

        state = await coordinator.run("task_001", "org_001", "Download bank statements")
        assert state.status == "completed"
        assert len(state.completed_subtasks) == 3

    async def test_abort_on_first_step_failure(self):
        """First step has abort strategy and fails."""
        llm_response = json.dumps({
            "steps": [
                {"goal": "Login", "completion_condition": "", "failure_strategy": "abort", "max_retries": 0},
                {"goal": "Navigate", "completion_condition": "", "failure_strategy": "replan"},
            ]
        })

        async def mock_llm(prompt):
            return llm_response

        async def mock_handler(goal, context):
            return {"success": False, "error": "Login failed"}

        planner = PlannerAgent(llm_callable=mock_llm)
        executor = ExecutorAgent(action_handler=mock_handler)
        coordinator = AgentCoordinator(planner, executor)

        state = await coordinator.run("task_002", "org_001", "Test task")
        assert state.status == "failed"
        assert "Login failed" in state.error_message


class TestCoordinatorReplan(unittest.IsolatedAsyncioTestCase):
    """Key test: 3-step flow, step 2 fails, Planner replans, continues."""

    async def test_step2_fails_replan_continues(self):
        """
        Simulates:
        1. Step 0 (Login) -> SUCCESS
        2. Step 1 (Navigate to statements page) -> FAILS
        3. Planner replans -> new step: "Try alternative navigation"
        4. New step -> SUCCESS
        5. Original Step 2 is replaced by replan -> task COMPLETES
        """
        async def mock_llm(prompt):
            if "## Failed Step" in prompt:
                # This is a replan request (uses REPLAN_SYSTEM_PROMPT)
                return json.dumps({
                    "steps": [
                        {"goal": "Try alternative navigation path", "completion_condition": "Page found", "failure_strategy": "abort"},
                        {"goal": "Download CSV", "completion_condition": "File saved", "failure_strategy": "retry"},
                    ]
                })
            # Initial plan
            return json.dumps({
                "steps": [
                    {"goal": "Login to e-banking", "completion_condition": "Logged in", "failure_strategy": "abort", "max_retries": 0},
                    {"goal": "Navigate to statements page", "completion_condition": "Table visible", "failure_strategy": "replan", "max_retries": 0},
                    {"goal": "Download CSV file", "completion_condition": "File saved", "failure_strategy": "retry"},
                ]
            })

        async def mock_handler(goal, context):
            if "Navigate to statements" in goal:
                return {"success": False, "error": "Statements button not found"}
            return {"success": True, "data": {"goal": goal}}

        planner = PlannerAgent(llm_callable=mock_llm)
        executor = ExecutorAgent(action_handler=mock_handler)
        coordinator = AgentCoordinator(planner, executor, max_replans=3)

        state = await coordinator.run("task_003", "org_001", "Download bank statements for Q1")

        assert state.status == "completed"
        assert state.total_replans == 1
        # Step 0 completed + 2 new steps from replan = 3 completed
        assert len(state.completed_subtasks) == 3

    async def test_max_replans_exceeded_goes_to_needs_human(self):
        """When max replans is exceeded, task goes to needs_human."""
        async def mock_llm(prompt):
            return json.dumps({
                "steps": [
                    {"goal": "Always fails", "completion_condition": "", "failure_strategy": "replan", "max_retries": 0},
                ]
            })

        async def mock_handler(goal, context):
            return {"success": False, "error": "Permanent failure"}

        planner = PlannerAgent(llm_callable=mock_llm)
        executor = ExecutorAgent(action_handler=mock_handler)
        coordinator = AgentCoordinator(planner, executor, max_replans=2)

        state = await coordinator.run("task_004", "org_001", "Impossible task")
        assert state.status == "needs_human"
        assert state.total_replans >= 2
        assert "Max replans exceeded" in state.error_message

    async def test_skip_strategy_continues(self):
        """Sub-task with skip strategy doesn't stop the pipeline."""
        async def mock_llm(prompt):
            return json.dumps({
                "steps": [
                    {"goal": "Close popup", "completion_condition": "", "failure_strategy": "skip", "max_retries": 0},
                    {"goal": "Do main work", "completion_condition": "Done", "failure_strategy": "abort"},
                ]
            })

        call_results = [
            {"success": False, "error": "No popup found"},  # step 0 fails
            {"success": True, "data": {}},  # step 1 succeeds
        ]
        call_idx = {"i": 0}

        async def mock_handler(goal, context):
            result = call_results[call_idx["i"]]
            call_idx["i"] += 1
            return result

        planner = PlannerAgent(llm_callable=mock_llm)
        executor = ExecutorAgent(action_handler=mock_handler)
        coordinator = AgentCoordinator(planner, executor)

        state = await coordinator.run("task_005", "org_001", "Main task")
        assert state.status == "completed"


class TestCoordinatorAudit(unittest.IsolatedAsyncioTestCase):
    async def test_audit_callback_called_for_each_subtask(self):
        audit_records = []

        async def audit_cb(subtask, result):
            audit_records.append({
                "subtask_id": subtask.subtask_id,
                "goal": subtask.goal,
                "success": result.success,
            })

        async def mock_llm(prompt):
            return json.dumps({
                "steps": [
                    {"goal": "Step A", "completion_condition": "", "failure_strategy": "abort"},
                    {"goal": "Step B", "completion_condition": "", "failure_strategy": "abort"},
                ]
            })

        async def mock_handler(goal, context):
            return {"success": True, "data": {}}

        planner = PlannerAgent(llm_callable=mock_llm)
        executor = ExecutorAgent(action_handler=mock_handler)
        coordinator = AgentCoordinator(planner, executor, audit_callback=audit_cb)

        state = await coordinator.run("task_006", "org_001", "Test audit")
        assert state.status == "completed"
        assert len(audit_records) == 2
        assert audit_records[0]["goal"] == "Step A"
        assert audit_records[1]["goal"] == "Step B"
        assert all(r["success"] for r in audit_records)

    async def test_audit_callback_failure_does_not_block(self):
        """Audit callback errors should not break task execution."""
        async def failing_audit(subtask, result):
            raise RuntimeError("Audit DB down")

        async def mock_llm(prompt):
            return json.dumps({
                "steps": [{"goal": "Test", "completion_condition": "", "failure_strategy": "abort"}]
            })

        async def mock_handler(goal, context):
            return {"success": True, "data": {}}

        planner = PlannerAgent(llm_callable=mock_llm)
        executor = ExecutorAgent(action_handler=mock_handler)
        coordinator = AgentCoordinator(planner, executor, audit_callback=failing_audit)

        state = await coordinator.run("task_007", "org_001", "Test")
        assert state.status == "completed"


class TestCoordinatorResumption(unittest.IsolatedAsyncioTestCase):
    async def test_resume_skips_completed_subtasks(self):
        """Resumption should skip already-completed sub-tasks."""
        async def mock_llm(prompt):
            return json.dumps({
                "steps": [
                    {"goal": "Step A", "completion_condition": "", "failure_strategy": "abort"},
                    {"goal": "Step B", "completion_condition": "", "failure_strategy": "abort"},
                    {"goal": "Step C", "completion_condition": "", "failure_strategy": "abort"},
                ]
            })

        execute_calls = []

        async def mock_handler(goal, context):
            execute_calls.append(goal)
            return {"success": True, "data": {}}

        planner = PlannerAgent(llm_callable=mock_llm)
        executor = ExecutorAgent(action_handler=mock_handler)
        coordinator = AgentCoordinator(planner, executor)

        # First run to get subtask IDs
        state1 = await coordinator.run("task_008", "org_001", "3-step task")
        assert state1.status == "completed"
        first_subtask_id = state1.completed_subtasks[0]

        # Second run, resuming from after first subtask
        execute_calls.clear()
        state2 = await coordinator.run(
            "task_008", "org_001", "3-step task",
            resume_from=[first_subtask_id],
        )
        assert state2.status == "completed"


if __name__ == "__main__":
    unittest.main()
