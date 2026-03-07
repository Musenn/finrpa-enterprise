"""Tests for financial workflow templates, crypto, validation, and API.

Covers:
- 6 templates correctly registered
- Template query by industry
- Parameter validation (required, type, date range)
- Sensitive parameter encryption/decryption/masking
- API: list, detail, instantiate with validation and encryption
"""

import unittest
from unittest.mock import patch

from cryptography.fernet import Fernet
from fastapi import FastAPI
from fastapi.testclient import TestClient

from enterprise.workflows.schemas import (
    IndustryType,
    ParamDefinition,
    ParamType,
    WorkflowTemplate,
)
from enterprise.workflows.templates import (
    TEMPLATE_REGISTRY,
    get_template,
    get_templates_by_industry,
    BANKING_STATEMENT_COLLECTION,
    BANKING_LOAN_REMINDER,
    INSURANCE_CLAIM_QUERY,
    INSURANCE_RENEWAL_CHECK,
    SECURITIES_REPORT_ARCHIVE,
    SECURITIES_NAV_COLLECTION,
)
from enterprise.workflows.crypto import (
    encrypt_value,
    decrypt_value,
    mask_value,
    set_key,
    reset_key,
)
from enterprise.workflows.validator import (
    validate_parameters,
    ValidationResult,
)


# ============================================================
# Template Registry tests
# ============================================================

class TestTemplateRegistry(unittest.TestCase):
    def test_six_templates_registered(self):
        assert len(TEMPLATE_REGISTRY) == 6

    def test_all_template_ids_unique(self):
        ids = list(TEMPLATE_REGISTRY.keys())
        assert len(ids) == len(set(ids))

    def test_banking_templates(self):
        banking = get_templates_by_industry("banking")
        assert len(banking) == 2
        names = {t.name for t in banking}
        assert "网银账单自动采集" in names
        assert "定期贷款还款提醒查询" in names

    def test_insurance_templates(self):
        insurance = get_templates_by_industry("insurance")
        assert len(insurance) == 2
        names = {t.name for t in insurance}
        assert "理赔案件批量状态查询" in names
        assert "保单到期续保提醒核查" in names

    def test_securities_templates(self):
        securities = get_templates_by_industry("securities")
        assert len(securities) == 2
        names = {t.name for t in securities}
        assert "研报数据自动归档" in names
        assert "基金净值数据采集" in names

    def test_get_template_by_id(self):
        t = get_template("tpl_banking_statement")
        assert t is not None
        assert t.name == "网银账单自动采集"

    def test_get_template_not_found(self):
        assert get_template("tpl_nonexistent") is None

    def test_each_template_has_parameters(self):
        for tid, t in TEMPLATE_REGISTRY.items():
            assert len(t.parameters) > 0, f"Template {tid} has no parameters"

    def test_each_template_has_sensitive_param(self):
        """Each template should have at least one sensitive parameter (password)."""
        for tid, t in TEMPLATE_REGISTRY.items():
            sensitive = [p for p in t.parameters if p.sensitive]
            assert len(sensitive) >= 1, f"Template {tid} has no sensitive parameters"

    def test_template_industries(self):
        industries = {t.industry.value for t in TEMPLATE_REGISTRY.values()}
        assert industries == {"banking", "insurance", "securities"}


# ============================================================
# Crypto tests
# ============================================================

class TestCrypto(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_key = Fernet.generate_key()
        set_key(cls.test_key)

    @classmethod
    def tearDownClass(cls):
        reset_key()

    def test_encrypt_decrypt_roundtrip(self):
        original = "MySecretPassword123!"
        encrypted = encrypt_value(original)
        decrypted = decrypt_value(encrypted)
        assert decrypted == original

    def test_encrypted_differs_from_plaintext(self):
        original = "password"
        encrypted = encrypt_value(original)
        assert encrypted != original

    def test_different_encryptions_differ(self):
        e1 = encrypt_value("same")
        e2 = encrypt_value("same")
        # Fernet uses random IV, so encryptions differ
        assert e1 != e2

    def test_decrypt_with_wrong_key_fails(self):
        encrypted = encrypt_value("secret")
        # Set a different key
        other_key = Fernet.generate_key()
        set_key(other_key)
        from cryptography.fernet import InvalidToken
        with self.assertRaises(InvalidToken):
            decrypt_value(encrypted)
        # Restore original key
        set_key(self.test_key)


class TestMaskValue(unittest.TestCase):
    def test_short_value(self):
        assert mask_value("abc") == "****"
        assert mask_value("ab") == "****"

    def test_four_chars(self):
        assert mask_value("abcd") == "****"

    def test_five_chars(self):
        result = mask_value("abcde")
        assert result == "a***e"

    def test_long_value(self):
        result = mask_value("MySecretPassword")
        assert result[0] == "M"
        assert result[-1] == "d"
        assert "*" in result
        assert len(result) == len("MySecretPassword")


# ============================================================
# Validator tests
# ============================================================

class TestValidateParameters(unittest.TestCase):
    def _bank_statement_params(self):
        return BANKING_STATEMENT_COLLECTION.parameters

    def test_valid_params(self):
        params = {
            "bank_url": "https://ebank.example.com",
            "username": "user1",
            "password": "pass123",
            "account_number": "6222021234561234",
            "start_date": "2026-01-01",
            "end_date": "2026-03-01",
        }
        result = validate_parameters(self._bank_statement_params(), params)
        assert result.valid is True
        assert result.errors == []

    def test_missing_required(self):
        params = {"bank_url": "https://ebank.example.com"}
        result = validate_parameters(self._bank_statement_params(), params)
        assert result.valid is False
        missing_names = {e.param_name for e in result.errors}
        assert "username" in missing_names
        assert "password" in missing_names

    def test_invalid_url(self):
        params = {
            "bank_url": "not-a-url",
            "username": "u", "password": "p",
            "account_number": "1234",
            "start_date": "2026-01-01", "end_date": "2026-02-01",
        }
        result = validate_parameters(self._bank_statement_params(), params)
        assert result.valid is False
        assert any(e.param_name == "bank_url" for e in result.errors)

    def test_invalid_date(self):
        params = {
            "bank_url": "https://ebank.example.com",
            "username": "u", "password": "p",
            "account_number": "1234",
            "start_date": "2026-13-01",  # invalid month
            "end_date": "2026-02-01",
        }
        result = validate_parameters(self._bank_statement_params(), params)
        assert result.valid is False
        assert any(e.param_name == "start_date" for e in result.errors)

    def test_date_range_exceeds_limit(self):
        params = {
            "bank_url": "https://ebank.example.com",
            "username": "u", "password": "p",
            "account_number": "1234",
            "start_date": "2024-01-01",
            "end_date": "2026-01-01",  # > 365 days
        }
        result = validate_parameters(self._bank_statement_params(), params)
        assert result.valid is False
        assert any("365 days" in e.message for e in result.errors)

    def test_end_before_start(self):
        params = {
            "bank_url": "https://ebank.example.com",
            "username": "u", "password": "p",
            "account_number": "1234",
            "start_date": "2026-03-01",
            "end_date": "2026-01-01",
        }
        result = validate_parameters(self._bank_statement_params(), params)
        assert result.valid is False
        assert any("after start" in e.message for e in result.errors)

    def test_invalid_integer(self):
        params = {
            "system_url": "https://credit.example.com",
            "username": "u", "password": "p",
            "days_ahead": "not_a_number",
        }
        result = validate_parameters(BANKING_LOAN_REMINDER.parameters, params)
        assert result.valid is False
        assert any(e.param_name == "days_ahead" for e in result.errors)

    def test_optional_with_default_not_required(self):
        """Optional params with defaults should not trigger missing error."""
        params = {
            "system_url": "https://credit.example.com",
            "username": "u", "password": "p",
            # days_ahead has default="7", branch_code is optional
        }
        result = validate_parameters(BANKING_LOAN_REMINDER.parameters, params)
        assert result.valid is True


# ============================================================
# API Route tests
# ============================================================

class TestWorkflowAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_key = Fernet.generate_key()
        set_key(cls.test_key)

    @classmethod
    def tearDownClass(cls):
        reset_key()

    def setUp(self):
        from enterprise.workflows.routes import router
        from enterprise.auth.dependencies import get_current_user
        from enterprise.auth.schemas import DepartmentRole, UserContext

        self.app = FastAPI()
        self.app.include_router(router)

        self.user = UserContext(
            user_id="eu_1",
            org_id="org_1",
            department_roles=[
                DepartmentRole(department_id="dept_a", department_name="A", role="operator"),
            ],
            business_line_ids=[],
        )
        self.app.dependency_overrides[get_current_user] = lambda: self.user
        self.client = TestClient(self.app)

    def test_list_all_templates(self):
        resp = self.client.get("/enterprise/workflows/templates")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 6

    def test_list_by_industry(self):
        resp = self.client.get("/enterprise/workflows/templates?industry=banking")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert all(t["industry"] == "banking" for t in data)

    def test_list_unknown_industry(self):
        resp = self.client.get("/enterprise/workflows/templates?industry=unknown")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_get_template_detail(self):
        resp = self.client.get("/enterprise/workflows/templates/tpl_banking_statement")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "网银账单自动采集"
        assert len(data["parameters"]) > 0
        assert data["industry"] == "banking"

    def test_get_template_not_found(self):
        resp = self.client.get("/enterprise/workflows/templates/tpl_fake")
        assert resp.status_code == 404

    def test_instantiate_success(self):
        resp = self.client.post(
            "/enterprise/workflows/instantiate/tpl_banking_statement",
            json={
                "parameters": {
                    "bank_url": "https://ebank.example.com",
                    "username": "testuser",
                    "password": "Secret123",
                    "account_number": "6222021234561234",
                    "start_date": "2026-01-01",
                    "end_date": "2026-03-01",
                },
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["template_id"] == "tpl_banking_statement"
        assert data["validation_passed"] is True
        assert data["task_id"].startswith("task_")
        # Sensitive params should be masked
        assert "Secret123" not in data["stored_parameters"]["password"]
        assert "****" in data["stored_parameters"]["password"] or "*" in data["stored_parameters"]["password"]
        # Non-sensitive params should be visible
        assert data["stored_parameters"]["username"] == "testuser"

    def test_instantiate_validation_fail(self):
        resp = self.client.post(
            "/enterprise/workflows/instantiate/tpl_banking_statement",
            json={
                "parameters": {
                    "bank_url": "not-a-url",
                },
            },
        )
        assert resp.status_code == 422
        assert "validation failed" in resp.json()["detail"].lower()

    def test_instantiate_not_found(self):
        resp = self.client.post(
            "/enterprise/workflows/instantiate/tpl_fake",
            json={"parameters": {}},
        )
        assert resp.status_code == 404

    def test_sensitive_masked_in_response(self):
        resp = self.client.post(
            "/enterprise/workflows/instantiate/tpl_insurance_claim_query",
            json={
                "parameters": {
                    "system_url": "https://core.example.com",
                    "username": "agent",
                    "password": "SuperSecret!",
                    "claim_ids": "CLM001,CLM002",
                },
            },
        )
        assert resp.status_code == 200
        stored = resp.json()["stored_parameters"]
        assert stored["password"] != "SuperSecret!"
        assert stored["password"].startswith("S")  # mask keeps first char
        assert stored["password"].endswith("!")  # mask keeps last char


if __name__ == "__main__":
    unittest.main()
