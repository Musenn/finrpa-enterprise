/**
 * Enterprise Audit Logs — timeline view grouped by task.
 * Each log entry can be expanded to show before/after screenshot comparison.
 */

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/enterprise/GlassCard";
import { StatusBadge } from "@/components/enterprise/StatusBadge";
import { Timeline, type TimelineItem } from "@/components/enterprise/Timeline";
import { ScreenshotDiff } from "@/components/enterprise/ScreenshotDiff";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/i18n/useI18n";
import { authFetch } from "@/util/authFetch";

type AuditLogEntry = {
  audit_log_id: string;
  task_id: string;
  action_index: number;
  action_type: string;
  target_element: string;
  input_value: string;
  page_url: string;
  screenshot_before_key?: string;
  screenshot_after_key?: string;
  duration_ms: number;
  executor: string;
  execution_result: string;
  error_message?: string;
  has_approval: boolean;
  created_at: string;
};

type TaskGroup = {
  task_id: string;
  logs: AuditLogEntry[];
};

function demoLogs(): AuditLogEntry[] {
  return [
    {
      audit_log_id: "aud_001",
      task_id: "task_101",
      action_index: 1,
      action_type: "CLICK",
      target_element: "登录按钮",
      input_value: "",
      page_url: "https://bank.example.com/login",
      duration_ms: 450,
      executor: "agent",
      execution_result: "success",
      has_approval: false,
      created_at: "2026-03-07T10:00:05",
    },
    {
      audit_log_id: "aud_002",
      task_id: "task_101",
      action_index: 2,
      action_type: "INPUT_TEXT",
      target_element: "用户名输入框",
      input_value: "zhangwei",
      page_url: "https://bank.example.com/login",
      duration_ms: 230,
      executor: "agent",
      execution_result: "success",
      has_approval: false,
      created_at: "2026-03-07T10:00:08",
    },
    {
      audit_log_id: "aud_003",
      task_id: "task_101",
      action_index: 3,
      action_type: "INPUT_TEXT",
      target_element: "密码输入框",
      input_value: "********",
      page_url: "https://bank.example.com/login",
      duration_ms: 180,
      executor: "agent",
      execution_result: "success",
      has_approval: false,
      created_at: "2026-03-07T10:00:10",
    },
    {
      audit_log_id: "aud_004",
      task_id: "task_102",
      action_index: 1,
      action_type: "NAVIGATE",
      target_element: "转账页面",
      input_value: "",
      page_url: "https://bank.example.com/transfer",
      duration_ms: 1200,
      executor: "agent",
      execution_result: "success",
      has_approval: true,
      created_at: "2026-03-07T10:15:00",
    },
    {
      audit_log_id: "aud_005",
      task_id: "task_102",
      action_index: 2,
      action_type: "INPUT_TEXT",
      target_element: "金额输入框",
      input_value: "500,000.00",
      page_url: "https://bank.example.com/transfer",
      duration_ms: 320,
      executor: "agent",
      execution_result: "failed",
      error_message: "输入过程中元素状态失效",
      has_approval: true,
      created_at: "2026-03-07T10:15:05",
    },
  ];
}

function groupByTask(logs: AuditLogEntry[]): TaskGroup[] {
  const map = new Map<string, AuditLogEntry[]>();
  for (const log of logs) {
    const existing = map.get(log.task_id) ?? [];
    existing.push(log);
    map.set(log.task_id, existing);
  }
  return Array.from(map.entries()).map(([task_id, logs]) => ({ task_id, logs }));
}

function LogTimelineItem({
  log,
  expanded,
  onToggle,
}: {
  log: AuditLogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const timelineItem: TimelineItem = {
    id: log.audit_log_id,
    title: `#${log.action_index} ${log.action_type}`,
    description: `${log.target_element}${log.input_value ? ` → ${log.input_value}` : ""} (${log.duration_ms}ms)`,
    timestamp: new Date(log.created_at).toLocaleTimeString(),
    status: log.execution_result === "success" ? "success" : "error",
  };

  return (
    <div>
      <div className="cursor-pointer" onClick={onToggle}>
        <Timeline items={[timelineItem]} />
      </div>
      {expanded && (log.screenshot_before_key || log.screenshot_after_key) && (
        <div className="ml-12 mt-2">
          <ScreenshotDiff
            beforeUrl={log.screenshot_before_key}
            afterUrl={log.screenshot_after_key}
          />
        </div>
      )}
      {expanded && log.error_message && (
        <div className="ml-12 mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {log.error_message}
        </div>
      )}
    </div>
  );
}

export function AuditLogsPage() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    async function load() {
      try {
        const resp = await authFetch("/api/v1/enterprise/audit/logs");
        if (resp.ok) {
          const data = await resp.json();
          setLogs(data.items ?? data);
          return;
        }
      } catch {
        // fall through
      }
      setLogs(demoLogs());
    }
    load();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredLogs = filterType === "all"
    ? logs
    : logs.filter((l) => l.action_type === filterType);
  const groups = groupByTask(filteredLogs);
  const actionTypes = [...new Set(logs.map((l) => l.action_type))];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon name="audit" size={24} color="var(--finrpa-blue)" />
          <h1 className="text-xl font-bold" style={{ color: "var(--finrpa-blue)" }}>
            {t("audit.title")}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Icon name="filter" size={16} color="var(--finrpa-text-muted)" />
          <select
            className="glass-input text-sm"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">{t("audit.allTypes")}</option>
            {actionTypes.map((actionType) => (
              <option key={actionType} value={actionType}>{actionType}</option>
            ))}
          </select>
        </div>
      </div>

      {groups.map((group) => (
        <GlassCard key={group.task_id} hoverable={false} padding="md">
          <div className="mb-4 flex items-center gap-3">
            <Icon name="task" size={20} color="var(--finrpa-blue)" />
            <h3 className="text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
              {t("audit.task")}: {group.task_id}
            </h3>
            <StatusBadge
              status={
                group.logs.some((l) => l.execution_result === "failed")
                  ? "failed"
                  : "completed"
              }
            />
            <span className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
              {t("audit.actionCount", { count: group.logs.length })}
            </span>
          </div>
          <div className="space-y-2">
            {group.logs.map((log) => (
              <LogTimelineItem
                key={log.audit_log_id}
                log={log}
                expanded={expandedIds.has(log.audit_log_id)}
                onToggle={() => toggleExpand(log.audit_log_id)}
              />
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
