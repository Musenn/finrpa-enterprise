/**
 * LLM Monitor — visual dashboard for all LLM-related enterprise features.
 *
 * Sections:
 *   1. Cost Analysis (model tier breakdown)
 *   2. Cache Performance (hit rate, entries)
 *   3. Model Routing (complexity distribution)
 *   4. Resilience (retry & human-fallback stats)
 *   5. Human Intervention Queue
 */

import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { GlassCard } from "@/components/enterprise/GlassCard";
import { StatusBadge } from "@/components/enterprise/StatusBadge";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/i18n/useI18n";
import { authFetch } from "@/util/authFetch";

// ── Types ──

type CostBreakdown = {
  model_tier: string;
  total_calls: number;
  cached_calls: number;
  cache_hit_rate: number;
  total_tokens: number;
  estimated_cost_usd: number;
  estimated_saved_usd: number;
};

type CostData = {
  total_cost_usd: number;
  total_saved_usd: number;
  breakdown: CostBreakdown[];
};

type CacheStats = {
  total_entries: number;
  hits: number;
  misses: number;
  hit_rate: number;
  sets: number;
};

type StuckTask = {
  task_id: string;
  department_name: string;
  stuck_action_type: string;
  stuck_since: string;
  llm_errors: string[];
  page_url: string;
};

// ── Demo Data ──

function demoCost(): CostData {
  return {
    total_cost_usd: 42.86,
    total_saved_usd: 18.72,
    breakdown: [
      {
        model_tier: "LIGHT",
        total_calls: 856,
        cached_calls: 312,
        cache_hit_rate: 36.4,
        total_tokens: 128400,
        estimated_cost_usd: 6.42,
        estimated_saved_usd: 2.34,
      },
      {
        model_tier: "STANDARD",
        total_calls: 423,
        cached_calls: 89,
        cache_hit_rate: 21.0,
        total_tokens: 254600,
        estimated_cost_usd: 22.91,
        estimated_saved_usd: 8.01,
      },
      {
        model_tier: "HEAVY",
        total_calls: 67,
        cached_calls: 12,
        cache_hit_rate: 17.9,
        total_tokens: 89200,
        estimated_cost_usd: 13.53,
        estimated_saved_usd: 8.37,
      },
    ],
  };
}

function demoCacheStats(): CacheStats {
  return {
    total_entries: 413,
    hits: 413,
    misses: 933,
    hit_rate: 30.7,
    sets: 933,
  };
}

function demoStuckTasks(): StuckTask[] {
  return [
    {
      task_id: "tsk_demo_002",
      department_name: "对公信贷部",
      stuck_action_type: "extract_data",
      stuck_since: "2026-03-08T09:23:00",
      llm_errors: [
        "JSONDecodeError: Expecting value at line 1",
        "ValidationError: 'account_number' field required",
        "JSONDecodeError: Extra data at line 5",
      ],
      page_url: "https://bank.example.com/loan/detail/2024031",
    },
    {
      task_id: "tsk_demo_005",
      department_name: "个人金融部",
      stuck_action_type: "input_text",
      stuck_since: "2026-03-08T10:45:00",
      llm_errors: [
        "ValidationError: 'amount' must be positive number",
        "JSONDecodeError: Unterminated string",
        "ConnectionError: LLM API timeout after 30s",
      ],
      page_url: "https://bank.example.com/retail/transfer",
    },
  ];
}

// ── Tier display helpers ──

const tierLabels: Record<string, string> = {
  LIGHT: "Haiku / 4o-mini",
  STANDARD: "Sonnet / GPT-4o",
  HEAVY: "Opus / GPT-4",
};

const tierColors: Record<string, string> = {
  LIGHT: "#10B981",
  STANDARD: "#3B82F6",
  HEAVY: "#8B5CF6",
};

// ── Section 1: Cost Analysis ──

function CostSection({ data }: { data: CostData }) {
  const { t } = useI18n();

  const pieOption = {
    tooltip: {
      trigger: "item" as const,
      formatter: "{b}: ${c} ({d}%)",
    },
    series: [
      {
        type: "pie",
        radius: ["45%", "70%"],
        data: data.breakdown.map((b) => ({
          name: tierLabels[b.model_tier] ?? b.model_tier,
          value: Number(b.estimated_cost_usd.toFixed(2)),
          itemStyle: { color: tierColors[b.model_tier] ?? "#999" },
        })),
        label: { color: "#374155", fontSize: 11 },
      },
    ],
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      {/* Summary cards */}
      <GlassCard padding="md">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--finrpa-text-muted)" }}>
          {t("llm.totalCost")}
        </p>
        <p className="mt-1 text-3xl font-bold" style={{ color: "var(--finrpa-blue)" }}>
          ${data.total_cost_usd.toFixed(2)}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <div className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "rgba(16,185,129,0.1)", color: "#10B981" }}>
            {t("llm.saved")} ${data.total_saved_usd.toFixed(2)}
          </div>
          <span className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
            {t("llm.viaCaching")}
          </span>
        </div>
      </GlassCard>

      {/* Tier table */}
      <GlassCard padding="md">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--finrpa-text-muted)" }}>
          {t("llm.tierBreakdown")}
        </p>
        <div className="space-y-3">
          {data.breakdown.map((b) => (
            <div key={b.model_tier} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: tierColors[b.model_tier] }}
                />
                <span className="text-sm font-medium" style={{ color: "var(--finrpa-text-primary)" }}>
                  {tierLabels[b.model_tier] ?? b.model_tier}
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
                  {b.total_calls.toLocaleString()} {t("llm.calls")}
                </span>
                <span className="ml-2 text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                  ${b.estimated_cost_usd.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Pie chart */}
      <GlassCard padding="md" hoverable={false}>
        <p className="mb-1 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--finrpa-text-muted)" }}>
          {t("llm.costDistribution")}
        </p>
        <ReactECharts option={pieOption} style={{ height: 180 }} />
      </GlassCard>
    </div>
  );
}

// ── Section 2: Cache Performance ──

function CacheSection({ data }: { data: CacheStats }) {
  const { t } = useI18n();

  const gaugeOption = {
    series: [
      {
        type: "gauge",
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        pointer: { show: false },
        progress: {
          show: true,
          width: 16,
          roundCap: true,
          itemStyle: {
            color: data.hit_rate >= 50 ? "#10B981" : data.hit_rate >= 20 ? "#F59E0B" : "#EF4444",
          },
        },
        axisLine: { lineStyle: { width: 16, color: [[1, "#E5E7EB"]] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          valueAnimation: true,
          formatter: "{value}%",
          fontSize: 28,
          fontWeight: "bold" as const,
          color: "var(--finrpa-text-primary)",
          offsetCenter: [0, "10%"],
        },
        title: {
          show: true,
          offsetCenter: [0, "45%"],
          fontSize: 12,
          color: "var(--finrpa-text-muted)",
        },
        data: [{ value: Number(data.hit_rate.toFixed(1)), name: t("llm.hitRate") }],
      },
    ],
  };

  const stats = [
    { label: t("llm.cacheEntries"), value: data.total_entries.toLocaleString(), color: "var(--finrpa-blue)" },
    { label: t("llm.cacheHits"), value: data.hits.toLocaleString(), color: "#10B981" },
    { label: t("llm.cacheMisses"), value: data.misses.toLocaleString(), color: "#EF4444" },
    { label: t("llm.cacheSets"), value: data.sets.toLocaleString(), color: "#F59E0B" },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <GlassCard padding="md" hoverable={false}>
        <p className="mb-1 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--finrpa-text-muted)" }}>
          {t("llm.cacheHitRate")}
        </p>
        <ReactECharts option={gaugeOption} style={{ height: 220 }} />
      </GlassCard>

      <GlassCard padding="md">
        <p className="mb-4 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--finrpa-text-muted)" }}>
          {t("llm.cacheDetails")}
        </p>
        <div className="grid grid-cols-2 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg p-3" style={{ background: "var(--glass-bg-subtle, rgba(255,255,255,0.4))" }}>
              <p className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>{s.label}</p>
              <p className="mt-1 text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

// ── Section 3: Model Routing Visualization ──

function RoutingSection({ cost }: { cost: CostData }) {
  const { t } = useI18n();

  const total = cost.breakdown.reduce((sum, b) => sum + b.total_calls, 0);
  const barOption = {
    grid: { left: 10, right: 10, top: 10, bottom: 10, containLabel: false },
    xAxis: { type: "value" as const, show: false, max: total },
    yAxis: { type: "category" as const, show: false, data: [""] },
    series: cost.breakdown.map((b) => ({
      type: "bar" as const,
      stack: "total",
      name: b.model_tier,
      data: [b.total_calls],
      barWidth: 32,
      itemStyle: {
        color: tierColors[b.model_tier],
        borderRadius: b.model_tier === "LIGHT" ? [4, 0, 0, 4] : b.model_tier === "HEAVY" ? [0, 4, 4, 0] : 0,
      },
    })),
    tooltip: { trigger: "item" as const, formatter: "{a}: {c}" },
  };

  return (
    <GlassCard padding="md" hoverable={false}>
      <p className="mb-4 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--finrpa-text-muted)" }}>
        {t("llm.routingDistribution")}
      </p>
      <ReactECharts option={barOption} style={{ height: 60 }} />
      <div className="mt-4 flex justify-around">
        {cost.breakdown.map((b) => {
          const pct = total > 0 ? ((b.total_calls / total) * 100).toFixed(1) : "0";
          return (
            <div key={b.model_tier} className="text-center">
              <div className="flex items-center justify-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: tierColors[b.model_tier] }} />
                <span className="text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
                  {b.model_tier}
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                {tierLabels[b.model_tier]}
              </p>
              <p className="mt-1 text-lg font-bold" style={{ color: tierColors[b.model_tier] }}>
                {pct}%
              </p>
              <p className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                {b.total_calls.toLocaleString()} {t("llm.calls")}
              </p>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

// ── Section 4: Resilience Stats ──

function ResilienceSection({ cost }: { cost: CostData }) {
  const { t } = useI18n();

  const totalCalls = cost.breakdown.reduce((s, b) => s + b.total_calls, 0);
  const cachedCalls = cost.breakdown.reduce((s, b) => s + b.cached_calls, 0);
  const totalTokens = cost.breakdown.reduce((s, b) => s + b.total_tokens, 0);

  const items = [
    { label: t("llm.totalLlmCalls"), value: totalCalls.toLocaleString(), icon: "workflow" as const, color: "var(--finrpa-blue)" },
    { label: t("llm.cachedResponses"), value: cachedCalls.toLocaleString(), icon: "check-circle" as const, color: "#10B981" },
    { label: t("llm.totalTokens"), value: (totalTokens / 1000).toFixed(0) + "K", icon: "audit" as const, color: "#8B5CF6" },
    { label: t("llm.avgCacheRate"), value: (totalCalls > 0 ? ((cachedCalls / totalCalls) * 100).toFixed(1) : "0") + "%", icon: "refresh" as const, color: "#F59E0B" },
  ];

  return (
    <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
      {items.map((item) => (
        <GlassCard key={item.label} padding="md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `${item.color}10` }}>
              <Icon name={item.icon} size={20} color={item.color} />
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>{item.label}</p>
              <p className="text-lg font-bold" style={{ color: "var(--finrpa-text-primary)" }}>{item.value}</p>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

// ── Section 5: Human Intervention Queue ──

function HumanQueueSection({ tasks }: { tasks: StuckTask[] }) {
  const { t } = useI18n();

  if (tasks.length === 0) {
    return (
      <GlassCard padding="md">
        <div className="flex flex-col items-center py-8" style={{ color: "var(--finrpa-text-muted)" }}>
          <Icon name="check-circle" size={40} color="#10B981" />
          <p className="mt-3 text-sm font-medium">{t("llm.noStuckTasks")}</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => {
        const stuckMinutes = Math.floor(
          (Date.now() - new Date(task.stuck_since).getTime()) / 60000,
        );
        return (
          <GlassCard key={task.task_id} padding="md">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
                    {task.task_id}
                  </span>
                  <StatusBadge status="needs_human" />
                  <span className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                    {task.department_name}
                  </span>
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                  {t("llm.stuckAction")}: <strong>{task.stuck_action_type}</strong> — {t("llm.stuckFor")} {stuckMinutes} {t("llm.minutes")}
                </p>
                <p className="mt-0.5 truncate text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                  {task.page_url}
                </p>

                {/* LLM error trail */}
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-medium" style={{ color: "#EF4444" }}>
                    {t("llm.retryErrors")} ({task.llm_errors.length}/3):
                  </p>
                  {task.llm_errors.map((err, i) => (
                    <div
                      key={i}
                      className="rounded px-2 py-1 text-xs"
                      style={{ background: "rgba(239,68,68,0.06)", color: "#991B1B" }}
                    >
                      #{i + 1}: {err}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="ml-4 flex flex-col gap-2">
                <button className="glass-btn-primary px-3 py-1.5 text-xs">{t("llm.actionSkip")}</button>
                <button className="glass-btn-secondary px-3 py-1.5 text-xs">{t("llm.actionManual")}</button>
                <button
                  className="rounded px-3 py-1.5 text-xs font-medium"
                  style={{ background: "rgba(239,68,68,0.08)", color: "#DC2626" }}
                >
                  {t("llm.actionTerminate")}
                </button>
              </div>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}

// ── Page Root ──

export function LLMMonitorPage() {
  const { t } = useI18n();
  const [cost, setCost] = useState<CostData | null>(null);
  const [cache, setCache] = useState<CacheStats | null>(null);
  const [stuckTasks, setStuckTasks] = useState<StuckTask[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [costResp, cacheResp] = await Promise.all([
          authFetch("/api/v1/enterprise/dashboard/cost").then((r) => (r.ok ? r.json() : null)),
          authFetch("/api/v1/enterprise/cache/stats").then((r) => (r.ok ? r.json() : null)),
        ]);
        setCost(costResp ?? demoCost());
        setCache(cacheResp ?? demoCacheStats());
      } catch {
        setCost(demoCost());
        setCache(demoCacheStats());
      }
      // Stuck tasks — demo for now
      setStuckTasks(demoStuckTasks());
    }
    load();
  }, []);

  if (!cost || !cache) return null;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Icon name="workflow" size={24} color="var(--finrpa-blue)" />
        <h1 className="text-xl font-bold" style={{ color: "var(--finrpa-blue)" }}>
          {t("llm.title")}
        </h1>
      </div>

      {/* Section 1: Resilience overview */}
      <ResilienceSection cost={cost} />

      {/* Section 2: Cost Analysis */}
      <div>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
          {t("llm.costAnalysis")}
        </h2>
        <CostSection data={cost} />
      </div>

      {/* Section 3: Model Routing */}
      <div>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
          {t("llm.modelRouting")}
        </h2>
        <RoutingSection cost={cost} />
      </div>

      {/* Section 4: Cache Performance */}
      <div>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
          {t("llm.cachePerformance")}
        </h2>
        <CacheSection data={cache} />
      </div>

      {/* Section 5: Human Intervention Queue */}
      <div>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
          {t("llm.humanQueue")}
        </h2>
        <HumanQueueSection tasks={stuckTasks} />
      </div>
    </div>
  );
}
