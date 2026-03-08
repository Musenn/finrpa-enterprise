/**
 * Enterprise Dashboard — operational metrics overview.
 * Shows 4 summary cards + 3 chart areas (trend, errors, business lines).
 */

import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { GlassCard } from "@/components/enterprise/GlassCard";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/locales";
import { authFetch } from "@/util/authFetch";

type OverviewData = {
  total_tasks: number;
  success_rate_today: number;
  success_rate_7d: number;
  avg_duration_ms: number;
  pending_approvals: number;
  needs_human_count: number;
};

type TrendItem = {
  date: string;
  success: number;
  failed: number;
  total: number;
};

type ErrorDistribution = Record<string, number>;

type BLComparison = {
  business_line_id: string;
  total_tasks: number;
  success_rate: number;
};

// Demo data generators for when API is unavailable
function demoOverview(): OverviewData {
  return {
    total_tasks: 1247,
    success_rate_today: 94.2,
    success_rate_7d: 91.8,
    avg_duration_ms: 3200,
    pending_approvals: 5,
    needs_human_count: 2,
  };
}

function demoTrend(): TrendItem[] {
  const items: TrendItem[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const success = 30 + Math.floor(Math.random() * 20);
    const failed = Math.floor(Math.random() * 5);
    items.push({
      date: d.toISOString().slice(0, 10),
      success,
      failed,
      total: success + failed,
    });
  }
  return items;
}

function demoErrors(): ErrorDistribution {
  return {
    LLM_FAILURE: 12,
    TIMEOUT: 8,
    PAGE_ERROR: 5,
    APPROVAL_REJECTED: 3,
  };
}

function demoBL(): BLComparison[] {
  return [
    { business_line_id: "Corporate Lending", total_tasks: 320, success_rate: 95.3 },
    { business_line_id: "Retail Credit", total_tasks: 280, success_rate: 92.1 },
    { business_line_id: "Wealth Management", total_tasks: 190, success_rate: 88.5 },
    { business_line_id: "Intl Settlement", total_tasks: 145, success_rate: 96.2 },
  ];
}

function OverviewCards({ data, t }: { data: OverviewData; t: (key: MessageKey, params?: Record<string, string | number>) => string }) {
  const cards = [
    {
      title: t("dashboard.totalTasks"),
      value: data.total_tasks.toLocaleString(),
      icon: "task" as const,
      color: "var(--finrpa-blue)",
    },
    {
      title: t("dashboard.successRate"),
      value: `${data.success_rate_today}%`,
      icon: "check-circle" as const,
      color: "var(--status-completed)",
    },
    {
      title: t("dashboard.pendingApproval"),
      value: data.pending_approvals.toString(),
      icon: "clock" as const,
      color: "var(--finrpa-gold)",
    },
    {
      title: t("dashboard.needsHuman"),
      value: data.needs_human_count.toString(),
      icon: "user-check" as const,
      color: "var(--status-needs-human)",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <GlassCard key={card.title} padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--finrpa-text-muted)" }}>
                {card.title}
              </p>
              <p className="mt-1 text-2xl font-bold" style={{ color: "var(--finrpa-text-primary)" }}>
                {card.value}
              </p>
            </div>
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: `${card.color}10` }}
            >
              <Icon name={card.icon} size={24} color={card.color} />
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function TrendChart({ data, t }: { data: TrendItem[]; t: (key: MessageKey, params?: Record<string, string | number>) => string }) {
  const option = {
    tooltip: { trigger: "axis" as const },
    legend: { data: [t("dashboard.chartSuccess"), t("dashboard.chartFailed")], bottom: 0 },
    grid: { left: 40, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: "category" as const,
      data: data.map((d) => d.date.slice(5)),
      axisLine: { lineStyle: { color: "#D1D5DB" } },
      axisLabel: { color: "#374155" },
    },
    yAxis: {
      type: "value" as const,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "#E5E7EB" } },
      axisLabel: { color: "#374155" },
    },
    series: [
      {
        name: t("dashboard.chartSuccess"),
        type: "line",
        smooth: true,
        data: data.map((d) => d.success),
        lineStyle: { color: "#10B981", width: 2 },
        itemStyle: { color: "#10B981" },
        areaStyle: { color: "rgba(16, 185, 129, 0.08)" },
      },
      {
        name: t("dashboard.chartFailed"),
        type: "line",
        smooth: true,
        data: data.map((d) => d.failed),
        lineStyle: { color: "#EF4444", width: 2 },
        itemStyle: { color: "#EF4444" },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 280 }} />;
}

const errorNameKeys: Record<string, MessageKey> = {
  LLM_FAILURE: "error.llmFailure",
  TIMEOUT: "error.timeout",
  PAGE_ERROR: "error.pageError",
  APPROVAL_REJECTED: "error.approvalRejected",
};

function ErrorPieChart({ data, t }: { data: ErrorDistribution; t: (key: MessageKey, params?: Record<string, string | number>) => string }) {
  const entries = Object.entries(data);
  const colors = ["#EF4444", "#F59E0B", "#8B5CF6", "#06B6D4"];
  const option = {
    tooltip: { trigger: "item" as const },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        data: entries.map(([name, value], i) => ({
          name: errorNameKeys[name] ? t(errorNameKeys[name]!) : name,
          value,
          itemStyle: { color: colors[i % colors.length] },
        })),
        label: {
          color: "#374155",
          fontSize: 12,
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 280 }} />;
}

function BLBarChart({ data, t }: { data: BLComparison[]; t: (key: MessageKey, params?: Record<string, string | number>) => string }) {
  const option = {
    grid: { left: 120, right: 30, top: 20, bottom: 20 },
    xAxis: {
      type: "value" as const,
      max: 100,
      axisLabel: { formatter: "{value}%", color: "#374155" },
      splitLine: { lineStyle: { color: "#E5E7EB" } },
    },
    yAxis: {
      type: "category" as const,
      data: data.map((d) => {
        const keyMap: Record<string, MessageKey> = {
          "Corporate Lending": "dashboard.blCorporateLending",
          "Retail Credit": "dashboard.blRetailCredit",
          "Wealth Management": "dashboard.blWealthManagement",
          "Intl Settlement": "dashboard.blIntlSettlement",
        };
        return keyMap[d.business_line_id] ? t(keyMap[d.business_line_id]!) : d.business_line_id;
      }),
      axisLabel: { color: "#374155", fontSize: 12 },
      axisLine: { lineStyle: { color: "#D1D5DB" } },
    },
    tooltip: { trigger: "item" as const },
    series: [
      {
        type: "bar",
        data: data.map((d) => d.success_rate),
        barWidth: 20,
        itemStyle: {
          color: "#1A3A5C",
          borderRadius: [0, 4, 4, 0],
        },
        emphasis: {
          itemStyle: {
            color: "#2A5A8C",
            shadowBlur: 10,
            shadowColor: "rgba(0, 0, 0, 0.2)",
            shadowOffsetY: -2,
          },
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 280 }} />;
}

export function DashboardPage() {
  const { t } = useI18n();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [errors, setErrors] = useState<ErrorDistribution>({});
  const [blData, setBLData] = useState<BLComparison[]>([]);

  useEffect(() => {
    // Attempt to fetch from API, fall back to demo data
    async function load() {
      try {
        const [ov, tr, er, bl] = await Promise.all([
          authFetch("/api/v1/enterprise/dashboard/overview").then((r) => r.ok ? r.json() : null),
          authFetch("/api/v1/enterprise/dashboard/trend?days=7").then((r) => r.ok ? r.json() : null),
          authFetch("/api/v1/enterprise/dashboard/errors").then((r) => r.ok ? r.json() : null),
          authFetch("/api/v1/enterprise/dashboard/business-lines").then((r) => r.ok ? r.json() : null),
        ]);
        setOverview(ov ?? demoOverview());
        setTrend(tr ?? demoTrend());
        setErrors(er ?? demoErrors());
        setBLData(bl ?? demoBL());
      } catch {
        setOverview(demoOverview());
        setTrend(demoTrend());
        setErrors(demoErrors());
        setBLData(demoBL());
      }
    }
    load();
  }, []);

  if (!overview) return null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon name="dashboard" size={24} color="var(--finrpa-blue)" />
          <h1 className="text-xl font-bold" style={{ color: "var(--finrpa-blue)" }}>
            {t("dashboard.title")}
          </h1>
        </div>
        <button className="glass-btn-secondary flex items-center gap-2 text-sm">
          <Icon name="download" size={16} />
          {t("dashboard.exportCsv")}
        </button>
      </div>

      <OverviewCards data={overview} t={t} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <GlassCard hoverable={false} padding="md">
          <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
            {t("dashboard.taskTrend")}
          </h3>
          <TrendChart data={trend} t={t} />
        </GlassCard>

        <GlassCard hoverable={false} padding="md">
          <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
            {t("dashboard.errorDistribution")}
          </h3>
          <ErrorPieChart data={errors} t={t} />
        </GlassCard>
      </div>

      <GlassCard hoverable={false} padding="md">
        <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
          {t("dashboard.businessLineComparison")} — {t("dashboard.successRateLabel")}
        </h3>
        <BLBarChart data={blData} t={t} />
      </GlassCard>
    </div>
  );
}
