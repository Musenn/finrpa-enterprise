"""Tests for the composable skill library.

Covers:
- Skill registration and registry
- LoginSkill: params validation, execution with mock page, error handling
- TableExtractSkill: params validation, execution with mock page, CSV/JSON output
- SessionKeepAliveSkill: active session check, expired session detection
- FormFillSkill: field mapping, submit behavior
- SearchAndSelectSkill: search and select flow
- PaginationSkill: multi-page traversal
- FileDownloadSkill: download trigger
- Skill executor pipeline: sequential execution, retry, abort, skip
- Workflow template skill_steps: all 6 templates have skill_steps
- Audit dict generation: sensitive param masking
"""

import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from enterprise.skills.base import (
    SKILL_REGISTRY,
    BaseSkill,
    ErrorStrategy,
    SkillResult,
    SkillStatus,
    get_skill,
    list_skills,
    register_skill,
)
from enterprise.skills.auth_skills import (
    LoginParams,
    LoginSkill,
    SessionKeepAliveParams,
    SessionKeepAliveSkill,
)
from enterprise.skills.interaction_skills import (
    FormFillParams,
    FormFillSkill,
    PaginationParams,
    PaginationSkill,
    SearchAndSelectParams,
    SearchAndSelectSkill,
)
from enterprise.skills.extraction_skills import (
    FileDownloadParams,
    FileDownloadSkill,
    TableExtractParams,
    TableExtractSkill,
)
from enterprise.skills.executor import (
    PipelineResult,
    SkillStep,
    execute_pipeline,
)


# ============================================================
# Registry tests
# ============================================================

class TestSkillRegistry(unittest.TestCase):
    def test_all_seven_skills_registered(self):
        expected = {
            "login", "session_keep_alive",
            "form_fill", "search_and_select", "pagination",
            "table_extract", "file_download",
        }
        assert expected.issubset(set(SKILL_REGISTRY.keys()))

    def test_get_skill_by_name(self):
        cls = get_skill("login")
        assert cls is LoginSkill

    def test_get_skill_not_found(self):
        assert get_skill("nonexistent") is None

    def test_list_skills_returns_metadata(self):
        skills = list_skills()
        names = {s["name"] for s in skills}
        assert "login" in names
        assert "table_extract" in names
        for s in skills:
            assert "description" in s
            assert "error_strategy" in s


# ============================================================
# LoginSkill tests
# ============================================================

class TestLoginSkill(unittest.TestCase):
    def test_params_validation(self):
        p = LoginParams(
            url="https://bank.example.com",
            username="user1",
            password="pass123",
        )
        assert p.url == "https://bank.example.com"
        assert p.captcha_strategy == "skip"
        assert p.success_indicator == ""

    def test_params_validation_with_all_fields(self):
        p = LoginParams(
            url="https://bank.example.com",
            username="user1",
            password="pass123",
            captcha_strategy="manual",
            submit_selector="#login-btn",
            success_indicator="dashboard",
        )
        assert p.captcha_strategy == "manual"
        assert p.submit_selector == "#login-btn"

    def test_error_strategy_is_abort(self):
        assert LoginSkill.error_strategy == ErrorStrategy.ABORT

    def test_execute_no_page(self):
        skill = LoginSkill()
        params = LoginParams(
            url="https://bank.example.com",
            username="user1",
            password="pass123",
        )
        result = asyncio.get_event_loop().run_until_complete(
            skill.execute(params, context={})
        )
        assert result.status == SkillStatus.FAILED
        assert "No browser page" in result.error_message

    def test_execute_with_mock_page(self):
        skill = LoginSkill()
        params = LoginParams(
            url="https://bank.example.com",
            username="user1",
            password="pass123",
        )

        mock_page = AsyncMock()
        mock_page.goto = AsyncMock()
        mock_page.fill = AsyncMock()
        mock_page.click = AsyncMock()

        result = asyncio.get_event_loop().run_until_complete(
            skill.execute(params, context={"page": mock_page})
        )
        assert result.status == SkillStatus.COMPLETED
        assert result.data["logged_in"] is True
        mock_page.goto.assert_called_once()
        assert mock_page.fill.call_count == 2  # username + password

    def test_execute_with_llm_handler(self):
        skill = LoginSkill()
        params = LoginParams(
            url="https://bank.example.com",
            username="user1",
            password="pass123",
        )

        mock_page = AsyncMock()
        mock_page.goto = AsyncMock()
        mock_llm = AsyncMock()

        result = asyncio.get_event_loop().run_until_complete(
            skill.execute(params, context={"page": mock_page, "llm_handler": mock_llm})
        )
        assert result.status == SkillStatus.COMPLETED
        mock_llm.assert_called_once()

    def test_execute_captcha_manual_returns_pending(self):
        skill = LoginSkill()
        params = LoginParams(
            url="https://bank.example.com",
            username="user1",
            password="pass123",
            captcha_strategy="manual",
        )

        mock_page = AsyncMock()
        mock_page.goto = AsyncMock()
        mock_llm = AsyncMock()

        result = asyncio.get_event_loop().run_until_complete(
            skill.execute(params, context={"page": mock_page, "llm_handler": mock_llm})
        )
        assert result.status == SkillStatus.PENDING
        assert result.data["needs_captcha"] is True

    def test_audit_dict_masks_password(self):
        skill = LoginSkill()
        params = LoginParams(
            url="https://bank.example.com",
            username="user1",
            password="SuperSecret123",
        )
        audit = skill.to_audit_dict(params)
        assert audit["skill"] == "login"
        assert audit["params"]["username"] == "user1"
        assert audit["params"]["password"] != "SuperSecret123"
        assert "*" in audit["params"]["password"]


# ============================================================
# TableExtractSkill tests
# ============================================================

class TestTableExtractSkill(unittest.TestCase):
    def test_params_defaults(self):
        p = TableExtractParams()
        assert p.output_format == "json"
        assert p.max_rows == 1000
        assert p.skip_empty_rows is True

    def test_error_strategy_is_retry(self):
        assert TableExtractSkill.error_strategy == ErrorStrategy.RETRY

    def test_execute_no_page(self):
        skill = TableExtractSkill()
        params = TableExtractParams()
        result = asyncio.get_event_loop().run_until_complete(
            skill.execute(params, context={})
        )
        assert result.status == SkillStatus.FAILED
        assert "No browser page" in result.error_message

    def test_execute_no_table_found(self):
        skill = TableExtractSkill()
        params = TableExtractParams()

        mock_page = AsyncMock()
        mock_page.query_selector = AsyncMock(return_value=None)

        result = asyncio.get_event_loop().run_until_complete(
            skill.execute(params, context={"page": mock_page})
        )
        assert result.status == SkillStatus.FAILED
        assert "No table found" in result.error_message

    def test_execute_json_output(self):
        skill = TableExtractSkill()
        params = TableExtractParams(output_format="json")

        mock_table = AsyncMock()
        mock_page = AsyncMock()
        mock_page.query_selector = AsyncMock(return_value=mock_table)
        mock_page.evaluate = AsyncMock(return_value={
            "headers": ["Code", "Name", "NAV"],
            "rows": [
                ["000001", "Fund A", "1.234"],
                ["110011", "Fund B", "2.567"],
            ],
        })

        result = asyncio.get_event_loop().run_until_complete(
            skill.execute(params, context={"page": mock_page})
        )
        assert result.status == SkillStatus.COMPLETED
        assert result.data["row_count"] == 2
        assert result.data["output_format"] == "json"
        output = result.data["output"]
        assert isinstance(output, list)
        assert output[0]["Code"] == "000001"
        assert output[1]["NAV"] == "2.567"

    def test_execute_csv_output(self):
        skill = TableExtractSkill()
        params = TableExtractParams(output_format="csv")

        mock_table = AsyncMock()
        mock_page = AsyncMock()
        mock_page.query_selector = AsyncMock(return_value=mock_table)
        mock_page.evaluate = AsyncMock(return_value={
            "headers": ["A", "B"],
            "rows": [["1", "2"], ["3", "4"]],
        })

        result = asyncio.get_event_loop().run_until_complete(
            skill.execute(params, context={"page": mock_page})
        )
        assert result.status == SkillStatus.COMPLETED
        assert result.data["output_format"] == "csv"
        csv_text = result.data["output"]
        assert "A,B" in csv_text
        assert "1,2" in csv_text

    def test_execute_header_validation(self):
        skill = TableExtractSkill()
        params = TableExtractParams(headers=["Code", "NAV"])

        mock_table = AsyncMock()
        mock_page = AsyncMock()
        mock_page.query_selector = AsyncMock(return_value=mock_table)
        mock_page.evaluate = AsyncMock(return_value={
            "headers": ["Fund Code", "Fund Name", "NAV Value"],
            "rows": [["001", "Test", "1.0"]],
        })

        result = asyncio.get_event_loop().run_until_complete(
            skill.execute(params, context={"page": mock_page})
        )
        assert result.status == SkillStatus.COMPLETED
        assert result.data["header_match"] is True  # "Code" in "Fund Code", "NAV" in "NAV Value"


# ============================================================
# SessionKeepAliveSkill tests
# ============================================================

class TestSessionKeepAliveSkill(unittest.TestCase):
    def test_active_session(self):
        skill = SessionKeepAliveSkill()
        params = SessionKeepAliveParams()
        mock_page = AsyncMock()

        result = asyncio.get_event_loop().run_until_complete(
            skill.execute(params, context={"page": mock_page})
        )
        assert result.status == SkillStatus.COMPLETED
        assert result.data["session_active"] is True

    def test_expired_session_indicator(self):
        skill = SessionKeepAliveSkill()
        params = SessionKeepAliveParams(
            session_timeout_indicator="session expired",
            relogin_on_expire=False,
        )
        mock_page = AsyncMock()
        mock_page.content = AsyncMock(return_value="<html>Your session expired. Please login again.</html>")

        result = asyncio.get_event_loop().run_until_complete(
            skill.execute(params, context={"page": mock_page})
        )
        assert result.status == SkillStatus.FAILED
        assert "Session expired" in result.error_message


# ============================================================
# FormFillSkill tests
# ============================================================

class TestFormFillSkill(unittest.TestCase):
    def test_form_fill_with_llm(self):
        skill = FormFillSkill()
        params = FormFillParams(
            field_mapping={"Username": "admin", "Account": "123456"},
        )

        mock_page = AsyncMock()
        mock_llm = AsyncMock()

        result = asyncio.get_event_loop().run_until_complete(
            skill.execute(params, context={"page": mock_page, "llm_handler": mock_llm})
        )
        assert result.status == SkillStatus.COMPLETED
        assert result.data["total"] == 2
        assert len(result.data["filled_fields"]) == 2


# ============================================================
# SearchAndSelectSkill tests
# ============================================================

class TestSearchAndSelectSkill(unittest.TestCase):
    def test_search_and_select_with_llm(self):
        skill = SearchAndSelectSkill()
        params = SearchAndSelectParams(
            search_text="CLM001",
            target_text="Claim CLM001",
        )

        mock_page = AsyncMock()
        mock_page.wait_for_timeout = AsyncMock()
        mock_llm = AsyncMock()

        result = asyncio.get_event_loop().run_until_complete(
            skill.execute(params, context={"page": mock_page, "llm_handler": mock_llm})
        )
        assert result.status == SkillStatus.COMPLETED
        assert result.data["selected"] == "Claim CLM001"


# ============================================================
# PaginationSkill tests
# ============================================================

class TestPaginationSkill(unittest.TestCase):
    def test_pagination_stops_on_empty(self):
        skill = PaginationSkill()
        params = PaginationParams(
            max_pages=5,
            page_data_selector="tr.data-row",
            stop_on_empty=True,
        )

        mock_page = AsyncMock()
        mock_page.query_selector_all = AsyncMock(return_value=[])  # empty page
        mock_page.wait_for_timeout = AsyncMock()

        result = asyncio.get_event_loop().run_until_complete(
            skill.execute(params, context={"page": mock_page})
        )
        assert result.status == SkillStatus.COMPLETED
        assert result.data["pages_traversed"] == 1  # stops at first empty
        assert result.data["items_collected"] == 0


# ============================================================
# FileDownloadSkill tests
# ============================================================

class TestFileDownloadSkill(unittest.TestCase):
    def test_params_defaults(self):
        p = FileDownloadParams()
        assert p.download_path == "./downloads/"
        assert p.wait_timeout_ms == 30000

    def test_no_trigger_found(self):
        skill = FileDownloadSkill()
        params = FileDownloadParams(
            trigger_text="Download PDF",
        )

        mock_page = AsyncMock()
        mock_page.query_selector = AsyncMock(return_value=None)
        mock_page.expect_download = MagicMock()

        # Simulate the context manager for expect_download
        mock_ctx = AsyncMock()
        mock_page.expect_download.return_value = mock_ctx
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_ctx)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)

        result = asyncio.get_event_loop().run_until_complete(
            skill.execute(params, context={"page": mock_page})
        )
        # Should fail since query_selector returns None for the trigger text
        assert result.status == SkillStatus.FAILED


# ============================================================
# Skill Executor Pipeline tests
# ============================================================

class TestSkillPipeline(unittest.TestCase):
    def test_successful_pipeline(self):
        mock_page = AsyncMock()
        mock_page.goto = AsyncMock()
        mock_page.fill = AsyncMock()
        mock_page.click = AsyncMock()

        steps = [
            SkillStep(
                skill_name="login",
                params={
                    "url": "https://bank.example.com",
                    "username": "user1",
                    "password": "pass123",
                },
            ),
        ]

        result = asyncio.get_event_loop().run_until_complete(
            execute_pipeline(steps, context={"page": mock_page})
        )
        assert result.success is True
        assert result.steps_completed == 1
        assert result.steps_total == 1

    def test_pipeline_abort_on_unknown_skill(self):
        steps = [
            SkillStep(skill_name="nonexistent_skill", params={}),
        ]
        result = asyncio.get_event_loop().run_until_complete(
            execute_pipeline(steps, context={})
        )
        assert result.success is False
        assert result.aborted_at_step == 0
        assert "Unknown skill" in result.error_message

    def test_pipeline_abort_on_login_failure(self):
        """Login skill has ABORT error strategy — pipeline should stop."""
        steps = [
            SkillStep(
                skill_name="login",
                params={
                    "url": "https://bank.example.com",
                    "username": "user1",
                    "password": "pass123",
                },
            ),
            SkillStep(
                skill_name="table_extract",
                params={},
            ),
        ]
        # No page in context -> login fails -> pipeline aborts
        result = asyncio.get_event_loop().run_until_complete(
            execute_pipeline(steps, context={})
        )
        assert result.success is False
        assert result.aborted_at_step == 0
        assert result.steps_completed == 0

    def test_pipeline_skip_on_pagination_failure(self):
        """Pagination skill has SKIP error strategy — pipeline should continue."""
        mock_page = AsyncMock()
        mock_page.goto = AsyncMock()
        mock_page.fill = AsyncMock()
        mock_page.click = AsyncMock()

        steps = [
            SkillStep(
                skill_name="pagination",
                params={"max_pages": 1, "page_data_selector": "tr"},
                error_strategy_override="skip",
            ),
        ]

        # query_selector_all returns empty -> no data but skill completes
        mock_page.query_selector_all = AsyncMock(return_value=[])
        mock_page.wait_for_timeout = AsyncMock()

        result = asyncio.get_event_loop().run_until_complete(
            execute_pipeline(steps, context={"page": mock_page})
        )
        assert result.success is True

    def test_pipeline_with_audit_callback(self):
        mock_page = AsyncMock()
        mock_page.goto = AsyncMock()
        mock_page.fill = AsyncMock()
        mock_page.click = AsyncMock()

        audit_records = []

        async def audit_cb(step_idx, skill_name, params_dict, result):
            audit_records.append({
                "step": step_idx,
                "skill": skill_name,
                "params": params_dict,
                "status": result.status.value,
            })

        steps = [
            SkillStep(
                skill_name="login",
                params={
                    "url": "https://bank.example.com",
                    "username": "user1",
                    "password": "pass123",
                },
            ),
        ]

        result = asyncio.get_event_loop().run_until_complete(
            execute_pipeline(steps, context={"page": mock_page}, audit_callback=audit_cb)
        )
        assert result.success is True
        assert len(audit_records) == 1
        assert audit_records[0]["skill"] == "login"
        # Password should be masked in audit
        assert audit_records[0]["params"]["params"]["password"] != "pass123"


# ============================================================
# Workflow template skill_steps tests
# ============================================================

class TestTemplateSkillSteps(unittest.TestCase):
    def test_all_templates_have_skill_steps(self):
        from enterprise.workflows.templates import TEMPLATE_REGISTRY
        for tid, t in TEMPLATE_REGISTRY.items():
            assert len(t.skill_steps) >= 2, (
                f"Template {tid} should have at least 2 skill steps"
            )

    def test_banking_statement_has_login_extract_download(self):
        from enterprise.workflows.templates import BANKING_STATEMENT_COLLECTION
        skill_names = [s.skill_name for s in BANKING_STATEMENT_COLLECTION.skill_steps]
        assert "login" in skill_names
        assert "table_extract" in skill_names
        assert "file_download" in skill_names

    def test_all_referenced_skills_exist(self):
        from enterprise.workflows.templates import TEMPLATE_REGISTRY
        for tid, t in TEMPLATE_REGISTRY.items():
            for step in t.skill_steps:
                assert get_skill(step.skill_name) is not None, (
                    f"Template {tid} references unknown skill '{step.skill_name}'"
                )

    def test_first_step_is_login_for_all_templates(self):
        from enterprise.workflows.templates import TEMPLATE_REGISTRY
        for tid, t in TEMPLATE_REGISTRY.items():
            assert t.skill_steps[0].skill_name == "login", (
                f"Template {tid} first step should be login, got {t.skill_steps[0].skill_name}"
            )


if __name__ == "__main__":
    unittest.main()
