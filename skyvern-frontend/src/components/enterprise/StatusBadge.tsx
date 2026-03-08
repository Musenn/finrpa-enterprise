/**
 * Status badge with color-coded labels for task states.
 */

import { cn } from "@/util/utils";
import { useI18n } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/locales";

type TaskStatus =
  | "running"
  | "completed"
  | "failed"
  | "pending_approval"
  | "needs_human"
  | "paused"
  | "queued"
  | "timeout"
  | "created"
  | "terminated"
  | "canceled";

const statusConfig: Record<string, { bg: string; text: string }> = {
  running:          { bg: "bg-blue-50",    text: "text-blue-700" },
  completed:        { bg: "bg-green-50",   text: "text-green-700" },
  failed:           { bg: "bg-red-50",     text: "text-red-700" },
  pending_approval: { bg: "bg-amber-50",   text: "text-amber-700" },
  needs_human:      { bg: "bg-orange-50",  text: "text-orange-700" },
  paused:           { bg: "bg-purple-50",  text: "text-purple-700" },
  queued:           { bg: "bg-gray-50",    text: "text-gray-600" },
  timeout:          { bg: "bg-red-50",     text: "text-red-800" },
  created:          { bg: "bg-sky-50",     text: "text-sky-700" },
  terminated:       { bg: "bg-gray-100",   text: "text-gray-700" },
  canceled:         { bg: "bg-gray-100",   text: "text-gray-600" },
};

const statusLabelKeys: Record<string, string> = {
  running: "common.statusRunning",
  completed: "common.statusCompleted",
  failed: "common.statusFailed",
  pending_approval: "common.statusPendingApproval",
  needs_human: "common.statusNeedsHuman",
  paused: "common.statusPaused",
  queued: "common.statusQueued",
  timeout: "common.statusTimeout",
  created: "common.statusCreated",
  terminated: "common.statusTerminated",
  canceled: "common.statusCanceled",
};

type StatusBadgeProps = {
  status: TaskStatus | string;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useI18n();
  const config = statusConfig[status] ?? {
    bg: "bg-gray-50",
    text: "text-gray-600",
  };
  const label = statusLabelKeys[status]
    ? t(statusLabelKeys[status] as MessageKey)
    : status;

  return (
    <span
      className={cn(
        "glass-badge",
        config.bg,
        config.text,
        className,
      )}
    >
      {label}
    </span>
  );
}
