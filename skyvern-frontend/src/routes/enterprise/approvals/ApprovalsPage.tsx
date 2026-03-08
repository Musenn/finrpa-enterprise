/**
 * Enterprise Approval Center — list pending approvals with approve/reject actions.
 */

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/enterprise/GlassCard";
import { RiskBadge } from "@/components/enterprise/RiskBadge";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/i18n/useI18n";
import { authFetch } from "@/util/authFetch";

type ApprovalRequest = {
  approval_id: string;
  task_id: string;
  risk_level: string;
  risk_reason: string;
  operation_description: string | null;
  department_id: string;
  business_line_id: string | null;
  requested_at: string;
  screenshot_path?: string | null;
  status: string;
};

// Lookup maps matching seed_demo_data.sql
const DEPT_NAMES: Record<string, string> = {
  dept_corp_credit: "对公信贷部",
  dept_personal_fin: "个人金融部",
  dept_asset_mgmt: "资产管理部",
  dept_risk_mgmt: "风险管理部",
  dept_compliance: "合规审计部",
  dept_it: "信息技术部",
};
const BL_NAMES: Record<string, string> = {
  bl_corp_loan: "对公贷款",
  bl_retail_credit: "零售信贷",
  bl_wealth_mgmt: "财富管理",
  bl_intl_settle: "国际结算",
};

function demoApprovals(): ApprovalRequest[] {
  return [
    {
      approval_id: "apr_001",
      task_id: "tsk_demo_0245",
      risk_level: "high",
      risk_reason: "大额交易操作，金额超过100万元",
      operation_description: "企业贷款申请材料审核",
      department_id: "dept_corp_credit",
      business_line_id: "bl_corp_loan",
      requested_at: "2026-03-07T10:30:00",
      status: "pending",
    },
    {
      approval_id: "apr_002",
      task_id: "tsk_demo_0248",
      risk_level: "critical",
      risk_reason: "核心数据库批量修改",
      operation_description: "客户KYC信息更新",
      department_id: "dept_personal_fin",
      business_line_id: "bl_retail_credit",
      requested_at: "2026-03-07T09:15:00",
      status: "pending",
    },
    {
      approval_id: "apr_003",
      task_id: "tsk_demo_0250",
      risk_level: "high",
      risk_reason: "跨境交易金额异常",
      operation_description: "跨境汇款合规审查",
      department_id: "dept_corp_credit",
      business_line_id: "bl_intl_settle",
      requested_at: "2026-03-07T08:45:00",
      status: "pending",
    },
  ];
}

function ApprovalCard({
  item,
  onApprove,
  onReject,
}: {
  item: ApprovalRequest;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const { t } = useI18n();
  const [remark, setRemark] = useState("");

  return (
    <GlassCard hoverable={false} padding="md" className="mb-4">
      <div className="flex gap-6">
        {/* Screenshot area */}
        <div className="hidden w-48 shrink-0 sm:block">
          {item.screenshot_path ? (
            <img
              src={item.screenshot_path}
              alt="Task screenshot"
              className="h-32 w-full rounded-lg border border-gray-200 object-cover"
            />
          ) : (
            <div className="flex h-32 w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
              <span className="text-xs text-gray-400">{t("approvals.noScreenshot")}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-3">
            <RiskBadge level={item.risk_level} />
            <span className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
              {DEPT_NAMES[item.department_id] ?? item.department_id}
              {item.business_line_id && ` / ${BL_NAMES[item.business_line_id] ?? item.business_line_id}`}
            </span>
          </div>

          <h3 className="text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
            {item.operation_description ?? item.task_id}
          </h3>

          <p className="mt-1 text-sm" style={{ color: "var(--finrpa-text-secondary)" }}>
            {item.risk_reason}
          </p>

          <div className="mt-2 flex items-center gap-4 text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
            <span>{t("approvals.task")}: {item.task_id}</span>
            <span>{t("approvals.requested")}: {new Date(item.requested_at).toLocaleString()}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-col gap-2" style={{ width: 180 }}>
          <input
            className="glass-input text-xs"
            placeholder={t("approvals.remarkPlaceholder")}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
          />
          <button
            className="glass-btn-primary flex items-center justify-center gap-1 text-sm"
            onClick={() => onApprove(item.approval_id)}
          >
            <Icon name="check-circle" size={16} color="white" />
            {t("approvals.approve")}
          </button>
          <button
            className="flex items-center justify-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            onClick={() => onReject(item.approval_id)}
          >
            <Icon name="x-circle" size={16} color="#DC2626" />
            {t("approvals.reject")}
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

export function ApprovalsPage() {
  const { t } = useI18n();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const resp = await authFetch("/api/v1/enterprise/approvals/pending");
        if (resp.ok) {
          const data = await resp.json();
          setApprovals(data);
          return;
        }
      } catch {
        // fall through to demo
      }
      setApprovals(demoApprovals());
    }
    load();
  }, []);

  async function handleApprove(id: string) {
    try {
      const resp = await authFetch(`/api/v1/enterprise/approvals/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: "" }),
      });
      if (resp.ok) {
        setApprovals((prev) => prev.filter((a) => a.approval_id !== id));
      }
    } catch {
      // In demo mode, just remove from local state
      setApprovals((prev) => prev.filter((a) => a.approval_id !== id));
    }
  }

  async function handleReject(id: string) {
    try {
      const resp = await authFetch(`/api/v1/enterprise/approvals/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: "" }),
      });
      if (resp.ok) {
        setApprovals((prev) => prev.filter((a) => a.approval_id !== id));
      }
    } catch {
      setApprovals((prev) => prev.filter((a) => a.approval_id !== id));
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Icon name="approval" size={24} color="var(--finrpa-blue)" />
        <h1 className="text-xl font-bold" style={{ color: "var(--finrpa-blue)" }}>
          {t("approvals.title")}
        </h1>
        <span
          className="ml-2 rounded-full px-2.5 py-0.5 text-xs font-bold"
          style={{
            background: "var(--finrpa-gold)",
            color: "white",
          }}
        >
          {approvals.length}
        </span>
      </div>

      {approvals.length === 0 ? (
        <GlassCard hoverable={false} padding="lg">
          <div className="flex flex-col items-center justify-center py-12">
            <Icon name="check-circle" size={48} color="var(--status-completed)" />
            <p className="mt-4 text-sm font-medium" style={{ color: "var(--finrpa-text-secondary)" }}>
              {t("approvals.allCaughtUp")}
            </p>
          </div>
        </GlassCard>
      ) : (
        approvals.map((item) => (
          <ApprovalCard
            key={item.approval_id}
            item={item}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ))
      )}
    </div>
  );
}
