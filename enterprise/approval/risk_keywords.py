"""Financial industry keyword libraries for high-risk operation detection.

Three industry verticals with bilingual (Chinese + English) keywords,
regex patterns for amount detection, and risk-level associations.
"""

import re
from dataclasses import dataclass, field
from enum import Enum


class IndustryType(str, Enum):
    BANKING = "banking"
    INSURANCE = "insurance"
    SECURITIES = "securities"


@dataclass
class KeywordEntry:
    """A keyword or phrase with associated risk metadata."""

    keyword: str
    risk_level: str  # "medium", "high", "critical"
    category: str  # e.g., "fund_transfer", "account_ops"
    description: str = ""


# ============================================================================
# Amount detection regex patterns
# ============================================================================
# Matches amounts like: 100,000, ¥50万, $1,000,000, 500万元, 1.5亿
AMOUNT_PATTERNS = [
    re.compile(r"[¥￥\$€£]\s*[\d,]+\.?\d*", re.IGNORECASE),
    re.compile(r"[\d,]+\.?\d*\s*[万亿]?\s*[元圆]", re.IGNORECASE),
    re.compile(r"\b\d{1,3}(,\d{3})+(\.\d{1,2})?\b"),  # e.g., 1,000,000.00
    re.compile(r"\b\d+\.?\d*\s*(million|billion|万|亿)\b", re.IGNORECASE),
]

# High amount thresholds (in base currency unit)
HIGH_AMOUNT_REGEX = re.compile(
    r"(\d[\d,]*\.?\d*)\s*(万|亿|million|billion)",
    re.IGNORECASE,
)


def detect_amounts(text: str) -> list[str]:
    """Extract all monetary amount strings from text."""
    results = []
    for pattern in AMOUNT_PATTERNS:
        results.extend(pattern.findall(text) if not pattern.groups else
                       [m.group() for m in pattern.finditer(text)])
    return results


def has_high_amount(text: str) -> bool:
    """Check if text contains amounts above threshold (>= 100万 or >= 1 million)."""
    for m in HIGH_AMOUNT_REGEX.finditer(text):
        num_str = m.group(1).replace(",", "")
        unit = m.group(2).lower()
        try:
            num = float(num_str)
        except ValueError:
            continue
        if unit in ("亿", "billion"):
            return True
        if unit == "万" and num >= 100:
            return True
        if unit == "million" and num >= 1:
            return True
    return False


# ============================================================================
# Banking Keywords (银行场景)
# ============================================================================
BANKING_KEYWORDS: list[KeywordEntry] = [
    # Fund transfer operations (资金流动)
    KeywordEntry("转账", "high", "fund_transfer", "Bank transfer"),
    KeywordEntry("汇款", "high", "fund_transfer", "Remittance"),
    KeywordEntry("划转", "high", "fund_transfer", "Fund transfer between accounts"),
    KeywordEntry("跨行转账", "critical", "fund_transfer", "Inter-bank transfer"),
    KeywordEntry("大额转账", "critical", "fund_transfer", "Large amount transfer"),
    KeywordEntry("wire transfer", "high", "fund_transfer"),
    KeywordEntry("fund transfer", "high", "fund_transfer"),
    KeywordEntry("remittance", "high", "fund_transfer"),
    KeywordEntry("电汇", "high", "fund_transfer", "Telegraphic transfer"),
    KeywordEntry("批量转账", "critical", "fund_transfer", "Batch transfer"),
    KeywordEntry("batch payment", "critical", "fund_transfer"),

    # Account operations (账户操作)
    KeywordEntry("销户", "critical", "account_ops", "Account closure"),
    KeywordEntry("冻结", "high", "account_ops", "Account freeze"),
    KeywordEntry("解冻", "high", "account_ops", "Account unfreeze"),
    KeywordEntry("挂失", "high", "account_ops", "Loss report"),
    KeywordEntry("close account", "critical", "account_ops"),
    KeywordEntry("freeze account", "high", "account_ops"),
    KeywordEntry("unfreeze", "high", "account_ops"),
    KeywordEntry("密码重置", "high", "account_ops", "Password reset"),
    KeywordEntry("password reset", "high", "account_ops"),
    KeywordEntry("修改预留信息", "high", "account_ops", "Modify reserved info"),

    # Credit operations (授信操作)
    KeywordEntry("放款", "critical", "credit_ops", "Loan disbursement"),
    KeywordEntry("展期", "high", "credit_ops", "Loan extension"),
    KeywordEntry("核销", "critical", "credit_ops", "Write-off"),
    KeywordEntry("贷款发放", "critical", "credit_ops", "Loan issuance"),
    KeywordEntry("授信额度调整", "critical", "credit_ops", "Credit limit adjustment"),
    KeywordEntry("loan disbursement", "critical", "credit_ops"),
    KeywordEntry("credit limit", "high", "credit_ops"),
    KeywordEntry("write-off", "critical", "credit_ops"),
    KeywordEntry("loan extension", "high", "credit_ops"),
    KeywordEntry("担保变更", "high", "credit_ops", "Guarantee modification"),

    # Approval and compliance (审批合规)
    KeywordEntry("审批通过", "medium", "approval", "Approval granted"),
    KeywordEntry("override", "high", "approval", "Override control"),
    KeywordEntry("超授权", "critical", "approval", "Exceed authorization"),
    KeywordEntry("bypass", "high", "approval", "Bypass control"),
]

# ============================================================================
# Insurance Keywords (保险场景)
# ============================================================================
INSURANCE_KEYWORDS: list[KeywordEntry] = [
    # Claims (理赔)
    KeywordEntry("理赔提交", "high", "claims", "Claim submission"),
    KeywordEntry("理赔审核", "high", "claims", "Claim review"),
    KeywordEntry("理赔支付", "critical", "claims", "Claim payment"),
    KeywordEntry("claim submission", "high", "claims"),
    KeywordEntry("claim payment", "critical", "claims"),
    KeywordEntry("赔付", "high", "claims", "Indemnity payment"),
    KeywordEntry("大额理赔", "critical", "claims", "Large claim"),

    # Underwriting (承保)
    KeywordEntry("承保确认", "high", "underwriting", "Underwriting confirmation"),
    KeywordEntry("核保", "high", "underwriting", "Underwriting review"),
    KeywordEntry("underwriting", "high", "underwriting"),
    KeywordEntry("出单", "medium", "underwriting", "Policy issuance"),
    KeywordEntry("批单", "high", "underwriting", "Endorsement"),

    # Policy changes (保单变更)
    KeywordEntry("退保", "critical", "policy_change", "Surrender/cancel policy"),
    KeywordEntry("保单修改", "high", "policy_change", "Policy modification"),
    KeywordEntry("受益人变更", "critical", "policy_change", "Beneficiary change"),
    KeywordEntry("surrender", "critical", "policy_change"),
    KeywordEntry("beneficiary change", "critical", "policy_change"),
    KeywordEntry("policy cancellation", "critical", "policy_change"),
    KeywordEntry("保额调整", "high", "policy_change", "Coverage adjustment"),
    KeywordEntry("投保人变更", "critical", "policy_change", "Policyholder change"),
    KeywordEntry("缴费方式变更", "medium", "policy_change", "Payment method change"),
]

# ============================================================================
# Securities Keywords (证券场景)
# ============================================================================
SECURITIES_KEYWORDS: list[KeywordEntry] = [
    # Trading (交易)
    KeywordEntry("委托下单", "high", "trading", "Order placement"),
    KeywordEntry("撤单", "high", "trading", "Order cancellation"),
    KeywordEntry("大宗交易", "critical", "trading", "Block trade"),
    KeywordEntry("place order", "high", "trading"),
    KeywordEntry("cancel order", "high", "trading"),
    KeywordEntry("block trade", "critical", "trading"),
    KeywordEntry("市价委托", "high", "trading", "Market order"),
    KeywordEntry("限价委托", "medium", "trading", "Limit order"),

    # Margin trading (融资融券)
    KeywordEntry("融资买入", "critical", "margin", "Margin buy"),
    KeywordEntry("融券卖出", "critical", "margin", "Short sell"),
    KeywordEntry("margin buy", "critical", "margin"),
    KeywordEntry("short sell", "critical", "margin"),
    KeywordEntry("担保品划转", "high", "margin", "Collateral transfer"),
    KeywordEntry("追加保证金", "high", "margin", "Margin call"),
    KeywordEntry("margin call", "high", "margin"),
    KeywordEntry("强制平仓", "critical", "margin", "Forced liquidation"),
    KeywordEntry("forced liquidation", "critical", "margin"),

    # Fund operations (资金操作)
    KeywordEntry("资金划拨", "critical", "fund_ops", "Fund allocation"),
    KeywordEntry("银证转账", "high", "fund_ops", "Bank-securities transfer"),
    KeywordEntry("fund allocation", "critical", "fund_ops"),
    KeywordEntry("bank transfer", "high", "fund_ops"),
    KeywordEntry("出金", "high", "fund_ops", "Withdrawal"),
    KeywordEntry("入金", "medium", "fund_ops", "Deposit"),

    # Account operations
    KeywordEntry("销户", "critical", "account_ops", "Account closure"),
    KeywordEntry("开户", "medium", "account_ops", "Account opening"),
    KeywordEntry("权限变更", "high", "account_ops", "Permission change"),
]

# ============================================================================
# Consolidated lookup
# ============================================================================
INDUSTRY_KEYWORDS: dict[IndustryType, list[KeywordEntry]] = {
    IndustryType.BANKING: BANKING_KEYWORDS,
    IndustryType.INSURANCE: INSURANCE_KEYWORDS,
    IndustryType.SECURITIES: SECURITIES_KEYWORDS,
}

ALL_KEYWORDS: list[KeywordEntry] = (
    BANKING_KEYWORDS + INSURANCE_KEYWORDS + SECURITIES_KEYWORDS
)
