/**
 * Enterprise Dashboard — operational metrics overview.
 * Rich demo data for presentation when API is unavailable.
 */

import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { GlassCard } from "@/components/enterprise/GlassCard";
import { StatusBadge } from "@/components/enterprise/StatusBadge";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/locales";
import { authFetch } from "@/util/authFetch";

/* ──────────────────────────── Type definitions ──────────────────────────── */

type OverviewData = {
  total_tasks: number;
  success_rate_today: number;
  success_rate_7d: number;
  avg_duration_ms: number;
  pending_approvals: number;
  needs_human_count: number;
  delta_tasks?: number;       // % change vs yesterday
  delta_success?: number;     // pp change vs yesterday
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

type ApprovalHour = {
  hour: number;
  avg_minutes: number;
  count: number;
};

type LLMCostRow = {
  tier: string;
  calls: number;
  cache_hits: number;
  cost_usd: number;
};

type RecentTask = {
  id: string;
  name: string;
  status: string;
  department: string;
  duration_s: number;
  time: string;
};

/* ──────────────────── Deterministic demo data generators ─────────────────── */

// Seeded pseudo-random for consistent demo renders
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function demoOverview(): OverviewData {
  return {
    total_tasks: 3_842,
    success_rate_today: 96.3,
    success_rate_7d: 94.1,
    avg_duration_ms: 4_280,
    pending_approvals: 7,
    needs_human_count: 3,
    delta_tasks: 12.5,
    delta_success: 1.8,
  };
}

function demoTrend(): TrendItem[] {
  const rng = seededRandom(42);
  const items: TrendItem[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const base = isWeekend ? 60 : 120;
    const success = Math.round(base + rng() * 40);
    const failed = Math.round(2 + rng() * (isWeekend ? 3 : 8));
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
    LLM_FAILURE: 47,
    TIMEOUT: 31,
    PAGE_ERROR: 23,
    APPROVAL_REJECTED: 15,
    ELEMENT_NOT_FOUND: 12,
    SESSION_EXPIRED: 8,
  };
}

function demoBL(): BLComparison[] {
  return [
    { business_line_id: "Corporate Lending", total_tasks: 842, success_rate: 97.1 },
    { business_line_id: "Retail Credit", total_tasks: 716, success_rate: 94.8 },
    { business_line_id: "Wealth Management", total_tasks: 623, success_rate: 92.3 },
    { business_line_id: "Intl Settlement", total_tasks: 534, success_rate: 98.2 },
    { business_line_id: "Trade Finance", total_tasks: 487, success_rate: 95.6 },
    { business_line_id: "Risk & Compliance", total_tasks: 640, success_rate: 99.1 },
  ];
}

function demoApprovalHours(): ApprovalHour[] {
  const rng = seededRandom(99);
  return Array.from({ length: 24 }, (_, h) => {
    const isWork = h >= 9 && h <= 18;
    const isPeak = h >= 9 && h <= 11;
    return {
      hour: h,
      avg_minutes: isWork
        ? isPeak
          ? Math.round(3 + rng() * 4)
          : Math.round(8 + rng() * 15)
        : Math.round(25 + rng() * 30),
      count: isWork ? Math.round(5 + rng() * 12) : Math.round(rng() * 3),
    };
  });
}

function demoLLMCost(): LLMCostRow[] {
  return [
    { tier: "Light", calls: 12_480, cache_hits: 8_736, cost_usd: 18.72 },
    { tier: "Standard", calls: 6_230, cache_hits: 3_115, cost_usd: 62.30 },
    { tier: "Heavy", calls: 1_890, cache_hits: 567, cost_usd: 94.50 },
  ];
}

function demoRecentTasks(): RecentTask[] {
  const now = new Date();
  const tasks: { name: string; status: string; dept: string; dur: number; minAgo: number }[] = [
    { name: "Bank Statement Collection — ICBC", status: "completed", dept: "Corporate Lending", dur: 38, minAgo: 3 },
    { name: "Loan Repayment Reminder — Batch #127", status: "completed", dept: "Retail Credit", dur: 125, minAgo: 8 },
    { name: "Cross-border Wire — HK$2.4M", status: "pending_approval", dept: "Intl Settlement", dur: 0, minAgo: 12 },
    { name: "Claim Status Query — Case #A20260308", status: "running", dept: "Risk & Compliance", dur: 15, minAgo: 15 },
    { name: "Fund NAV Data Scrape — 6 Funds", status: "completed", dept: "Wealth Management", dur: 87, minAgo: 22 },
    { name: "Policy Renewal Check — Batch #89", status: "failed", dept: "Retail Credit", dur: 42, minAgo: 35 },
    { name: "Trade Finance LC Verification", status: "needs_human", dept: "Trade Finance", dur: 63, minAgo: 41 },
    { name: "Daily Reconciliation — Branch #032", status: "completed", dept: "Corporate Lending", dur: 156, minAgo: 55 },
    { name: "KYC Document Auto-fill — 15 clients", status: "completed", dept: "Risk & Compliance", dur: 210, minAgo: 68 },
    { name: "Research Report Archive — Q1 2026", status: "completed", dept: "Wealth Management", dur: 94, minAgo: 82 },
  ];
  return tasks.map((t, i) => {
    const time = new Date(now);
    time.setMinutes(time.getMinutes() - t.minAgo);
    return {
      id: `task_demo_${i}`,
      name: t.name,
      status: t.status,
      department: t.dept,
      duration_s: t.dur,
      time: `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`,
    };
  });
}

/* ──────────────────────────── Sub-components ─────────────────────────────── */

function OverviewCards({ data, t }: { data: OverviewData; t: (key: MessageKey, params?: Record<string, string | number>) => string }) {
  const cards = [
    {
      title: t("dashboard.totalTasks"),
      value: data.total_tasks.toLocaleString(),
      icon: "task" as const,
      color: "var(--finrpa-blue)",
      delta: data.delta_tasks != null ? `+${data.delta_tasks}%` : null,
      deltaUp: true,
    },
    {
      title: t("dashboard.successRate"),
      value: `${data.success_rate_today}%`,
      icon: "check-circle" as const,
      color: "var(--status-completed)",
      delta: data.delta_success != null ? `+${data.delta_success}pp` : null,
      deltaUp: true,
    },
    {
      title: t("dashboard.pendingApproval"),
      value: data.pending_approvals.toString(),
      icon: "clock" as const,
      color: "var(--finrpa-gold)",
      delta: null,
      deltaUp: false,
    },
    {
      title: t("dashboard.needsHuman"),
      value: data.needs_human_count.toString(),
      icon: "user-check" as const,
      color: "var(--status-needs-human)",
      delta: null,
      deltaUp: false,
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
              {card.delta && (
                <p className="mt-1 text-xs" style={{ color: card.deltaUp ? "var(--status-completed)" : "var(--status-failed)" }}>
                  {card.delta} {t("dashboard.vsYesterday")}
                </p>
              )}
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
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: "rgba(255,255,255,0.95)",
      borderColor: "#E5E7EB",
      textStyle: { color: "#374155" },
    },
    legend: { data: [t("dashboard.chartSuccess"), t("dashboard.chartFailed")], bottom: 0, textStyle: { color: "#374155" } },
    grid: { left: 45, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: "category" as const,
      data: data.map((d) => d.date.slice(5)),
      axisLine: { lineStyle: { color: "#D1D5DB" } },
      axisLabel: { color: "#374155", fontSize: 11, interval: 4 },
      boundaryGap: false,
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
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(16,185,129,0.18)" }, { offset: 1, color: "rgba(16,185,129,0.02)" }] } },
        symbol: "none",
      },
      {
        name: t("dashboard.chartFailed"),
        type: "line",
        smooth: true,
        data: data.map((d) => d.failed),
        lineStyle: { color: "#EF4444", width: 2 },
        itemStyle: { color: "#EF4444" },
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(239,68,68,0.10)" }, { offset: 1, color: "rgba(239,68,68,0.01)" }] } },
        symbol: "none",
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 300 }} />;
}

const errorNameKeys: Record<string, MessageKey> = {
  LLM_FAILURE: "error.llmFailure",
  TIMEOUT: "error.timeout",
  PAGE_ERROR: "error.pageError",
  APPROVAL_REJECTED: "error.approvalRejected",
  ELEMENT_NOT_FOUND: "error.llmFailure",
  SESSION_EXPIRED: "error.timeout",
};

const errorDisplayNames: Record<string, string> = {
  ELEMENT_NOT_FOUND: "Element Not Found",
  SESSION_EXPIRED: "Session Expired",
};

function ErrorPieChart({ data, t }: { data: ErrorDistribution; t: (key: MessageKey, params?: Record<string, string | number>) => string }) {
  const entries = Object.entries(data);
  const colors = ["#EF4444", "#F59E0B", "#8B5CF6", "#06B6D4", "#1A3A5C", "#C9A84C"];
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const option = {
    tooltip: {
      trigger: "item" as const,
      formatter: (p: { name: string; value: number; percent: number }) => `${p.name}: ${p.value} (${p.percent}%)`,
      backgroundColor: "rgba(255,255,255,0.95)",
      borderColor: "#E5E7EB",
      textStyle: { color: "#374155" },
    },
    graphic: [
      { type: "text", left: "center", top: "42%", style: { text: total.toString(), fontSize: 22, fontWeight: "bold", fill: "#1A1D2E", textAlign: "center" } },
      { type: "text", left: "center", top: "54%", style: { text: "Total", fontSize: 12, fill: "#526077", textAlign: "center" } },
    ],
    series: [
      {
        type: "pie",
        radius: ["45%", "72%"],
        center: ["50%", "50%"],
        data: entries.map(([name, value], i) => ({
          name: errorDisplayNames[name] ?? (errorNameKeys[name] ? t(errorNameKeys[name]!) : name),
          value,
          itemStyle: { color: colors[i % colors.length] },
        })),
        label: { color: "#374155", fontSize: 11, formatter: "{b}: {c}" },
        emphasis: { scaleSize: 6 },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 300 }} />;
}

const blKeyMap: Record<string, MessageKey> = {
  "Corporate Lending": "dashboard.blCorporateLending",
  "Retail Credit": "dashboard.blRetailCredit",
  "Wealth Management": "dashboard.blWealthManagement",
  "Intl Settlement": "dashboard.blIntlSettlement",
  "Trade Finance": "dashboard.blTradeFinance",
  "Risk & Compliance": "dashboard.blRiskCompliance",
};

function BLBarChart({ data, t }: { data: BLComparison[]; t: (key: MessageKey, params?: Record<string, string | number>) => string }) {
  const sorted = [...data].sort((a, b) => b.success_rate - a.success_rate);
  const option = {
    grid: { left: 110, right: 50, top: 15, bottom: 15 },
    xAxis: {
      type: "value" as const,
      min: 85,
      max: 100,
      axisLabel: { formatter: "{value}%", color: "#374155" },
      splitLine: { lineStyle: { color: "#E5E7EB" } },
    },
    yAxis: {
      type: "category" as const,
      data: sorted.map((d) => blKeyMap[d.business_line_id] ? t(blKeyMap[d.business_line_id]!) : d.business_line_id),
      axisLabel: { color: "#374155", fontSize: 12 },
      axisLine: { lineStyle: { color: "#D1D5DB" } },
    },
    tooltip: {
      trigger: "axis" as const,
      formatter: (params: Array<{ name: string; value: number; dataIndex: number }>) => {
        const p = params[0];
        if (!p) return "";
        const item = sorted[p.dataIndex];
        return `${p.name}<br/>${t("dashboard.successRateLabel")}: ${p.value}%<br/>${t("dashboard.totalTasks")}: ${item?.total_tasks.toLocaleString() ?? ""}`;
      },
      backgroundColor: "rgba(255,255,255,0.95)",
      borderColor: "#E5E7EB",
      textStyle: { color: "#374155" },
    },
    series: [
      {
        type: "bar",
        data: sorted.map((d) => ({
          value: d.success_rate,
          itemStyle: {
            color: d.success_rate >= 97 ? "#10B981" : d.success_rate >= 95 ? "#1A3A5C" : d.success_rate >= 93 ? "#F59E0B" : "#EF4444",
            borderRadius: [0, 4, 4, 0],
          },
        })),
        barWidth: 18,
        label: {
          show: true,
          position: "right" as const,
          formatter: "{c}%",
          fontSize: 11,
          color: "#374155",
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 260 }} />;
}

function ApprovalResponseChart({ data, t }: { data: ApprovalHour[]; t: (key: MessageKey, params?: Record<string, string | number>) => string }) {
  const option = {
    tooltip: {
      trigger: "axis" as const,
      formatter: (params: Array<{ dataIndex: number; value: number }>) => {
        const p = params[0];
        if (!p) return "";
        const item = data[p.dataIndex];
        return `${p.dataIndex}:00 - ${p.dataIndex}:59<br/>${t("dashboard.avgResponseMin")}: ${p.value}<br/>${t("dashboard.calls")}: ${item?.count ?? 0}`;
      },
      backgroundColor: "rgba(255,255,255,0.95)",
      borderColor: "#E5E7EB",
      textStyle: { color: "#374155" },
    },
    grid: { left: 45, right: 20, top: 15, bottom: 30 },
    xAxis: {
      type: "category" as const,
      data: data.map((d) => `${d.hour}:00`),
      axisLine: { lineStyle: { color: "#D1D5DB" } },
      axisLabel: { color: "#374155", fontSize: 10, interval: 2 },
    },
    yAxis: {
      type: "value" as const,
      name: "min",
      nameTextStyle: { color: "#526077", fontSize: 11 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "#E5E7EB" } },
      axisLabel: { color: "#374155" },
    },
    series: [
      {
        type: "bar",
        data: data.map((d) => ({
          value: d.avg_minutes,
          itemStyle: {
            color: d.avg_minutes <= 10 ? "#10B981" : d.avg_minutes <= 20 ? "#C9A84C" : "#EF4444",
            borderRadius: [3, 3, 0, 0],
          },
        })),
        barWidth: 14,
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 240 }} />;
}

function LLMCostTable({ data, t }: { data: LLMCostRow[]; t: (key: MessageKey, params?: Record<string, string | number>) => string }) {
  const tierKeys: Record<string, MessageKey> = {
    Light: "dashboard.modelLight",
    Standard: "dashboard.modelStandard",
    Heavy: "dashboard.modelHeavy",
  };
  const tierColors: Record<string, string> = {
    Light: "var(--status-completed)",
    Standard: "var(--finrpa-blue)",
    Heavy: "var(--status-needs-human)",
  };
  const totalCalls = data.reduce((s, r) => s + r.calls, 0);
  const totalHits = data.reduce((s, r) => s + r.cache_hits, 0);
  const totalCost = data.reduce((s, r) => s + r.cost_usd, 0);
  const hitRate = totalCalls > 0 ? ((totalHits / totalCalls) * 100).toFixed(1) : "0";

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <th className="pb-3 text-left font-medium" style={{ color: "var(--finrpa-text-muted)" }}>{t("dashboard.modelTier")}</th>
            <th className="pb-3 text-right font-medium" style={{ color: "var(--finrpa-text-muted)" }}>{t("dashboard.calls")}</th>
            <th className="pb-3 text-right font-medium" style={{ color: "var(--finrpa-text-muted)" }}>{t("dashboard.cacheHits")}</th>
            <th className="pb-3 text-right font-medium" style={{ color: "var(--finrpa-text-muted)" }}>{t("dashboard.cost")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.tier} style={{ borderBottom: "1px solid var(--glass-border)" }}>
              <td className="py-3">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: tierColors[row.tier] }} />
                  <span style={{ color: "var(--finrpa-text-primary)" }}>{tierKeys[row.tier] ? t(tierKeys[row.tier]!) : row.tier}</span>
                </span>
              </td>
              <td className="py-3 text-right" style={{ color: "var(--finrpa-text-secondary)" }}>{row.calls.toLocaleString()}</td>
              <td className="py-3 text-right" style={{ color: "var(--finrpa-text-secondary)" }}>{row.cache_hits.toLocaleString()}</td>
              <td className="py-3 text-right font-medium" style={{ color: "var(--finrpa-text-primary)" }}>${row.cost_usd.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "rgba(26,58,92,0.04)" }}>
        <div className="flex items-center gap-4">
          <span className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
            {t("dashboard.totalCost")}: <strong style={{ color: "var(--finrpa-text-primary)" }}>${totalCost.toFixed(2)}</strong>
          </span>
          <span className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
            {t("dashboard.cacheHitRate")}: <strong style={{ color: "var(--status-completed)" }}>{hitRate}%</strong>
          </span>
        </div>
        <span className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
          {t("dashboard.calls")}: {totalCalls.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function RecentTasksTable({ data, t }: { data: RecentTask[]; t: (key: MessageKey, params?: Record<string, string | number>) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <th className="pb-3 text-left font-medium" style={{ color: "var(--finrpa-text-muted)" }}>{t("dashboard.taskName")}</th>
            <th className="pb-3 text-left font-medium" style={{ color: "var(--finrpa-text-muted)" }}>{t("dashboard.status")}</th>
            <th className="pb-3 text-left font-medium" style={{ color: "var(--finrpa-text-muted)" }}>{t("dashboard.department")}</th>
            <th className="pb-3 text-right font-medium" style={{ color: "var(--finrpa-text-muted)" }}>{t("dashboard.duration")}</th>
            <th className="pb-3 text-right font-medium" style={{ color: "var(--finrpa-text-muted)" }}>{t("dashboard.time")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((task) => (
            <tr key={task.id} style={{ borderBottom: "1px solid var(--glass-border)" }}>
              <td className="max-w-[280px] truncate py-3 pr-4" style={{ color: "var(--finrpa-text-primary)" }} title={task.name}>
                {task.name}
              </td>
              <td className="py-3">
                <StatusBadge status={task.status} />
              </td>
              <td className="py-3 text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{task.department}</td>
              <td className="py-3 text-right tabular-nums" style={{ color: "var(--finrpa-text-secondary)" }}>
                {task.status === "running" || task.status === "pending_approval"
                  ? "—"
                  : `${task.duration_s}${t("dashboard.seconds")}`}
              </td>
              <td className="py-3 text-right tabular-nums" style={{ color: "var(--finrpa-text-muted)" }}>{task.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ──────────────────────────── Main Page ──────────────────────────────────── */

export function DashboardPage() {
  const { t } = useI18n();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [errors, setErrors] = useState<ErrorDistribution>({});
  const [blData, setBLData] = useState<BLComparison[]>([]);
  const [approvalHours, setApprovalHours] = useState<ApprovalHour[]>([]);
  const [llmCost, setLLMCost] = useState<LLMCostRow[]>([]);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [ov, tr, er, bl] = await Promise.all([
          authFetch("/api/v1/enterprise/dashboard/overview").then((r) => r.ok ? r.json() : null),
          authFetch("/api/v1/enterprise/dashboard/trend?days=30").then((r) => r.ok ? r.json() : null),
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
      // Approval-time and cost — fetch from backend, fallback to demo
      try {
        const [ahResp, costResp] = await Promise.all([
          authFetch("/api/v1/enterprise/dashboard/approval-time").then((r) => r.ok ? r.json() : null),
          authFetch("/api/v1/enterprise/dashboard/cost").then((r) => r.ok ? r.json() : null),
        ]);
        setApprovalHours(ahResp ?? demoApprovalHours());
        if (costResp?.breakdown) {
          setLLMCost(costResp.breakdown.map((b: { model_tier: string; total_calls: number; cached_calls: number; estimated_cost_usd: number }) => ({
            tier: b.model_tier.charAt(0).toUpperCase() + b.model_tier.slice(1),
            calls: b.total_calls,
            cache_hits: b.cached_calls,
            cost_usd: b.estimated_cost_usd,
          })));
        } else {
          setLLMCost(demoLLMCost());
        }
      } catch {
        setApprovalHours(demoApprovalHours());
        setLLMCost(demoLLMCost());
      }
      setRecentTasks(demoRecentTasks());
    }
    load();
  }, []);

  if (!overview) return null;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon name="dashboard" size={24} color="var(--finrpa-blue)" />
          <h1 className="text-xl font-bold" style={{ color: "var(--finrpa-blue)" }}>
            {t("dashboard.title")}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: "rgba(16,185,129,0.1)", color: "var(--status-completed)" }}>
            {t("dashboard.successRate7d")}: {overview.success_rate_7d}%
          </span>
          <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: "rgba(26,58,92,0.06)", color: "var(--finrpa-blue)" }}>
            {t("dashboard.avgDuration")}: {(overview.avg_duration_ms / 1000).toFixed(1)}{t("dashboard.seconds")}
          </span>
          <button className="glass-btn-secondary flex items-center gap-2 text-sm">
            <Icon name="download" size={16} />
            {t("dashboard.exportCsv")}
          </button>
        </div>
      </div>

      {/* Row 1: Overview Cards */}
      <OverviewCards data={overview} t={t} />

      {/* Row 2: Trend + Error Distribution */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <GlassCard hoverable={false} padding="md" className="xl:col-span-2">
          <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
            {t("dashboard.taskTrend30")}
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

      {/* Row 3: Business Line + Approval Response Time */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <GlassCard hoverable={false} padding="md">
          <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
            {t("dashboard.businessLineComparison")} — {t("dashboard.successRateLabel")}
          </h3>
          <BLBarChart data={blData} t={t} />
        </GlassCard>

        <GlassCard hoverable={false} padding="md">
          <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
            {t("dashboard.approvalResponseTime")}
          </h3>
          <ApprovalResponseChart data={approvalHours} t={t} />
        </GlassCard>
      </div>

      {/* Row 4: LLM Cost + Recent Tasks */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <GlassCard hoverable={false} padding="md">
          <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
            {t("dashboard.llmCostAnalysis")}
          </h3>
          <LLMCostTable data={llmCost} t={t} />
        </GlassCard>

        <GlassCard hoverable={false} padding="md" className="xl:col-span-2">
          <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
            {t("dashboard.recentTasks")}
          </h3>
          <RecentTasksTable data={recentTasks} t={t} />
        </GlassCard>
      </div>
    </div>
  );
}
