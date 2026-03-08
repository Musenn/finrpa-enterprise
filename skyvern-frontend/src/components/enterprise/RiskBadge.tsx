/**
 * Risk level badge with color coding.
 */

import { cn } from "@/util/utils";
import { useI18n } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/locales";

type RiskLevel = "low" | "medium" | "high" | "critical";

const riskConfig: Record<RiskLevel, { bg: string; text: string }> = {
  low:      { bg: "bg-green-50",  text: "text-green-700" },
  medium:   { bg: "bg-amber-50",  text: "text-amber-700" },
  high:     { bg: "bg-red-50",    text: "text-red-700" },
  critical: { bg: "bg-red-100",   text: "text-red-900" },
};

const riskLabelKeys: Record<RiskLevel, string> = {
  low: "common.riskLow",
  medium: "common.riskMedium",
  high: "common.riskHigh",
  critical: "common.riskCritical",
};

type RiskBadgeProps = {
  level: RiskLevel | string;
  className?: string;
};

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const { t } = useI18n();
  const config = riskConfig[level as RiskLevel] ?? {
    bg: "bg-gray-50",
    text: "text-gray-600",
  };
  const label = riskLabelKeys[level as RiskLevel]
    ? t(riskLabelKeys[level as RiskLevel] as MessageKey)
    : level;

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
