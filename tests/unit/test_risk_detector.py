"""Unit tests for the financial risk detection engine.

Covers:
- Banking: 10 should-trigger, 5 should-not-trigger
- Insurance: 10 should-trigger, 5 should-not-trigger
- Securities: 10 should-trigger, 5 should-not-trigger
- Amount detection
- LLM fallback / degradation
- Approval routing
"""

import pytest

from enterprise.approval.risk_detector import RiskAssessment, detect_risk
from enterprise.approval.risk_keywords import (
    IndustryType,
    detect_amounts,
    has_high_amount,
)
from enterprise.approval.routing import (
    COMPLIANCE_DEPT_ID,
    RISK_MGMT_DEPT_ID,
    route_approval,
)


# ============================================================================
# Banking — Should Trigger (10 cases)
# ============================================================================
class TestBankingTrigger:
    @pytest.mark.asyncio
    async def test_transfer(self):
        result = await detect_risk("请执行转账操作", IndustryType.BANKING)
        assert result.risk_level in ("high", "critical")

    @pytest.mark.asyncio
    async def test_remittance(self):
        result = await detect_risk("向境外账户汇款50万美元", IndustryType.BANKING)
        assert result.risk_level in ("high", "critical")

    @pytest.mark.asyncio
    async def test_account_closure(self):
        result = await detect_risk("客户申请销户，需要处理", IndustryType.BANKING)
        assert result.risk_level == "critical"

    @pytest.mark.asyncio
    async def test_account_freeze(self):
        result = await detect_risk("根据法院要求冻结该账户", IndustryType.BANKING)
        assert result.risk_level in ("high", "critical")

    @pytest.mark.asyncio
    async def test_loan_disbursement(self):
        result = await detect_risk("审批通过，执行贷款发放", IndustryType.BANKING)
        assert result.risk_level == "critical"

    @pytest.mark.asyncio
    async def test_write_off(self):
        result = await detect_risk("该笔不良贷款申请核销处理", IndustryType.BANKING)
        assert result.risk_level == "critical"

    @pytest.mark.asyncio
    async def test_credit_limit_adjustment(self):
        result = await detect_risk("调整授信额度调整至500万", IndustryType.BANKING)
        assert result.risk_level in ("high", "critical")

    @pytest.mark.asyncio
    async def test_wire_transfer_english(self):
        result = await detect_risk("Initiate wire transfer to overseas account", IndustryType.BANKING)
        assert result.risk_level in ("high", "critical")

    @pytest.mark.asyncio
    async def test_batch_payment(self):
        result = await detect_risk("Process batch payment for 200 employees", IndustryType.BANKING)
        assert result.risk_level == "critical"

    @pytest.mark.asyncio
    async def test_password_reset(self):
        result = await detect_risk("客户请求密码重置", IndustryType.BANKING)
        assert result.risk_level in ("high", "critical")


# ============================================================================
# Banking — Should NOT Trigger (5 cases)
# ============================================================================
class TestBankingNoTrigger:
    @pytest.mark.asyncio
    async def test_balance_inquiry(self):
        result = await detect_risk("查询账户余额", IndustryType.BANKING)
        assert result.risk_level == "low"

    @pytest.mark.asyncio
    async def test_statement_download(self):
        result = await detect_risk("下载本月对账单", IndustryType.BANKING)
        assert result.risk_level == "low"

    @pytest.mark.asyncio
    async def test_branch_info(self):
        result = await detect_risk("查询附近网点信息", IndustryType.BANKING)
        assert result.risk_level == "low"

    @pytest.mark.asyncio
    async def test_interest_rate_check(self):
        result = await detect_risk("Check current interest rates", IndustryType.BANKING)
        assert result.risk_level == "low"

    @pytest.mark.asyncio
    async def test_transaction_history(self):
        result = await detect_risk("查看交易流水记录", IndustryType.BANKING)
        assert result.risk_level == "low"


# ============================================================================
# Insurance — Should Trigger (10 cases)
# ============================================================================
class TestInsuranceTrigger:
    @pytest.mark.asyncio
    async def test_claim_submission(self):
        result = await detect_risk("理赔提交：车险事故理赔", IndustryType.INSURANCE)
        assert result.risk_level in ("high", "critical")

    @pytest.mark.asyncio
    async def test_claim_payment(self):
        result = await detect_risk("执行理赔支付30万元", IndustryType.INSURANCE)
        assert result.risk_level == "critical"

    @pytest.mark.asyncio
    async def test_surrender(self):
        result = await detect_risk("客户申请退保，保单号P2024001", IndustryType.INSURANCE)
        assert result.risk_level == "critical"

    @pytest.mark.asyncio
    async def test_beneficiary_change(self):
        result = await detect_risk("变更受益人变更为配偶", IndustryType.INSURANCE)
        assert result.risk_level == "critical"

    @pytest.mark.asyncio
    async def test_underwriting(self):
        result = await detect_risk("核保审核：大额寿险投保", IndustryType.INSURANCE)
        assert result.risk_level in ("high", "critical")

    @pytest.mark.asyncio
    async def test_policy_modification(self):
        result = await detect_risk("保单修改：调整保额和缴费期", IndustryType.INSURANCE)
        assert result.risk_level in ("high", "critical")

    @pytest.mark.asyncio
    async def test_policyholder_change(self):
        result = await detect_risk("投保人变更申请", IndustryType.INSURANCE)
        assert result.risk_level == "critical"

    @pytest.mark.asyncio
    async def test_endorsement(self):
        result = await detect_risk("出具批单修改保险条款", IndustryType.INSURANCE)
        assert result.risk_level in ("high", "critical")

    @pytest.mark.asyncio
    async def test_large_claim(self):
        result = await detect_risk("大额理赔案件审核", IndustryType.INSURANCE)
        assert result.risk_level == "critical"

    @pytest.mark.asyncio
    async def test_claim_english(self):
        result = await detect_risk("Process claim submission for auto insurance", IndustryType.INSURANCE)
        assert result.risk_level in ("high", "critical")


# ============================================================================
# Insurance — Should NOT Trigger (5 cases)
# ============================================================================
class TestInsuranceNoTrigger:
    @pytest.mark.asyncio
    async def test_policy_query(self):
        result = await detect_risk("查询保单状态", IndustryType.INSURANCE)
        assert result.risk_level == "low"

    @pytest.mark.asyncio
    async def test_premium_calculation(self):
        result = await detect_risk("计算车险保费", IndustryType.INSURANCE)
        assert result.risk_level == "low"

    @pytest.mark.asyncio
    async def test_agent_info(self):
        result = await detect_risk("查看代理人信息", IndustryType.INSURANCE)
        assert result.risk_level == "low"

    @pytest.mark.asyncio
    async def test_product_comparison(self):
        result = await detect_risk("Compare insurance products", IndustryType.INSURANCE)
        assert result.risk_level == "low"

    @pytest.mark.asyncio
    async def test_renewal_reminder(self):
        result = await detect_risk("发送续保提醒通知", IndustryType.INSURANCE)
        assert result.risk_level == "low"


# ============================================================================
# Securities — Should Trigger (10 cases)
# ============================================================================
class TestSecuritiesTrigger:
    @pytest.mark.asyncio
    async def test_order_placement(self):
        result = await detect_risk("委托下单买入股票", IndustryType.SECURITIES)
        assert result.risk_level in ("high", "critical")

    @pytest.mark.asyncio
    async def test_order_cancellation(self):
        result = await detect_risk("撤单：取消未成交委托", IndustryType.SECURITIES)
        assert result.risk_level in ("high", "critical")

    @pytest.mark.asyncio
    async def test_block_trade(self):
        result = await detect_risk("大宗交易：10万股", IndustryType.SECURITIES)
        assert result.risk_level == "critical"

    @pytest.mark.asyncio
    async def test_margin_buy(self):
        result = await detect_risk("融资买入500手", IndustryType.SECURITIES)
        assert result.risk_level == "critical"

    @pytest.mark.asyncio
    async def test_short_sell(self):
        result = await detect_risk("融券卖出对冲风险", IndustryType.SECURITIES)
        assert result.risk_level == "critical"

    @pytest.mark.asyncio
    async def test_fund_allocation(self):
        result = await detect_risk("执行资金划拨至交割账户", IndustryType.SECURITIES)
        assert result.risk_level == "critical"

    @pytest.mark.asyncio
    async def test_forced_liquidation(self):
        result = await detect_risk("触发强制平仓条件", IndustryType.SECURITIES)
        assert result.risk_level == "critical"

    @pytest.mark.asyncio
    async def test_bank_securities_transfer(self):
        result = await detect_risk("银证转账：从银行转入证券", IndustryType.SECURITIES)
        assert result.risk_level in ("high", "critical")

    @pytest.mark.asyncio
    async def test_margin_call(self):
        result = await detect_risk("追加保证金通知", IndustryType.SECURITIES)
        assert result.risk_level in ("high", "critical")

    @pytest.mark.asyncio
    async def test_place_order_english(self):
        result = await detect_risk("Place order to buy 1000 shares", IndustryType.SECURITIES)
        assert result.risk_level in ("high", "critical")


# ============================================================================
# Securities — Should NOT Trigger (5 cases)
# ============================================================================
class TestSecuritiesNoTrigger:
    @pytest.mark.asyncio
    async def test_market_data(self):
        result = await detect_risk("查看实时行情数据", IndustryType.SECURITIES)
        assert result.risk_level == "low"

    @pytest.mark.asyncio
    async def test_portfolio_view(self):
        result = await detect_risk("查看持仓组合", IndustryType.SECURITIES)
        assert result.risk_level == "low"

    @pytest.mark.asyncio
    async def test_research_report(self):
        result = await detect_risk("下载研究报告", IndustryType.SECURITIES)
        assert result.risk_level == "low"

    @pytest.mark.asyncio
    async def test_index_query(self):
        result = await detect_risk("Query stock index performance", IndustryType.SECURITIES)
        assert result.risk_level == "low"

    @pytest.mark.asyncio
    async def test_dividend_info(self):
        result = await detect_risk("查询分红派息信息", IndustryType.SECURITIES)
        assert result.risk_level == "low"


# ============================================================================
# Amount Detection
# ============================================================================
class TestAmountDetection:
    def test_detect_rmb_amount(self):
        amounts = detect_amounts("转账¥50,000元")
        assert len(amounts) > 0

    def test_detect_wan_amount(self):
        assert has_high_amount("转账500万元") is True

    def test_detect_yi_amount(self):
        assert has_high_amount("涉及金额1亿") is True

    def test_detect_million(self):
        assert has_high_amount("Transfer 5 million USD") is True

    def test_no_high_amount(self):
        assert has_high_amount("转账50元") is False

    def test_threshold_boundary(self):
        assert has_high_amount("金额99万") is False
        assert has_high_amount("金额100万") is True

    @pytest.mark.asyncio
    async def test_high_amount_escalates_risk(self):
        """High amount + keyword should escalate to critical."""
        result = await detect_risk("执行转账500万元到对公账户", IndustryType.BANKING)
        assert result.risk_level == "critical"


# ============================================================================
# LLM Fallback / Degradation
# ============================================================================
class TestLLMFallback:
    @pytest.mark.asyncio
    async def test_llm_success_overrides_stage1(self):
        """When LLM succeeds, its result should be used."""
        async def mock_llm(prompt):
            return {"risk_level": "critical", "reason": "LLM confirmed high risk"}

        result = await detect_risk(
            "执行转账操作",
            IndustryType.BANKING,
            llm_callable=mock_llm,
        )
        assert result.risk_level == "critical"
        assert result.stage == 2
        assert result.llm_fallback is False

    @pytest.mark.asyncio
    async def test_llm_failure_falls_back_to_stage1(self):
        """When LLM fails, should use conservative fallback."""
        async def failing_llm(prompt):
            raise Exception("LLM service unavailable")

        result = await detect_risk(
            "执行转账操作",
            IndustryType.BANKING,
            llm_callable=failing_llm,
        )
        assert result.risk_level in ("high", "critical")
        assert result.stage == 1
        assert result.llm_fallback is True

    @pytest.mark.asyncio
    async def test_llm_returns_none_falls_back(self):
        """When LLM returns None/invalid, should fallback."""
        async def bad_llm(prompt):
            return None

        result = await detect_risk(
            "执行转账操作",
            IndustryType.BANKING,
            llm_callable=bad_llm,
        )
        assert result.llm_fallback is True

    @pytest.mark.asyncio
    async def test_medium_escalated_to_high_on_llm_failure(self):
        """Medium risk should be escalated to high when LLM fails."""
        async def failing_llm(prompt):
            raise Exception("timeout")

        result = await detect_risk(
            "审批通过该业务申请",
            IndustryType.BANKING,
            llm_callable=failing_llm,
        )
        # "审批通过" is medium, should be escalated to high on LLM failure
        assert result.risk_level == "high"
        assert result.llm_fallback is True

    @pytest.mark.asyncio
    async def test_no_llm_configured_uses_stage1_directly(self):
        """Without LLM callable, stage 1 result is final (no fallback flag)."""
        result = await detect_risk("执行转账操作", IndustryType.BANKING)
        assert result.llm_fallback is False
        assert result.stage == 1


# ============================================================================
# Approval Routing
# ============================================================================
class TestApprovalRouting:
    def test_low_no_approval(self):
        route = route_approval("low", "dept_corp_credit")
        assert route.requires_approval is False

    def test_medium_no_approval(self):
        route = route_approval("medium", "dept_corp_credit")
        assert route.requires_approval is False

    def test_high_routes_to_dept_approver(self):
        route = route_approval("high", "dept_corp_credit")
        assert route.requires_approval is True
        assert route.approver_department_id == "dept_corp_credit"
        assert route.approver_role == "approver"

    def test_critical_routes_to_compliance(self):
        route = route_approval("critical", "dept_corp_credit")
        assert route.requires_approval is True
        assert route.approver_department_id == COMPLIANCE_DEPT_ID
        assert RISK_MGMT_DEPT_ID in route.notify_department_ids

    def test_unknown_level_treated_as_high(self):
        route = route_approval("unknown", "dept_corp_credit")
        assert route.requires_approval is True
        assert route.approver_department_id == "dept_corp_credit"
