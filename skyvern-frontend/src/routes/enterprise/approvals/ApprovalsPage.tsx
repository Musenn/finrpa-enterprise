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
  action_description: string;
  department_name: string;
  business_line: string;
  requested_at: string;
  screenshot_url?: string;
  status: string;
};

function demoApprovals(): ApprovalRequest[] {
  return [
    {
      approval_id: "apr_001",
      task_id: "task_101",
      risk_level: "high",
      risk_reason: "检测到大额转账操作：500,000 元",
      action_description: "从账户 ****1234 向账户 ****5678 转账",
      department_name: "对公信贷部",
      business_line: "对公贷款",
      requested_at: "2026-03-07T10:30:00",
      status: "pending",
    },
    {
      approval_id: "apr_002",
      task_id: "task_102",
      risk_level: "critical",
      risk_reason: "检测到销户操作",
      action_description: "为客户张某销户储蓄账户 ****9012",
      department_name: "零售银行部",
      business_line: "零售信贷",
      requested_at: "2026-03-07T09:15:00",
      status: "pending",
    },
    {
      approval_id: "apr_003",
      task_id: "task_103",
      risk_level: "high",
      risk_reason: "保险保单受益人变更",
      action_description: "变更保单 #INS-2026-0042 的受益人",
      department_name: "保险运营部",
      business_line: "保险",
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
          {item.screenshot_url ? (
            <img
              src={item.screenshot_url}
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
              {item.department_name} / {item.business_line}
            </span>
          </div>

          <h3 className="text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
            {item.action_description}
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
        body: JSON.stringify({ remark: "" }),
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
        body: JSON.stringify({ remark: "" }),
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
