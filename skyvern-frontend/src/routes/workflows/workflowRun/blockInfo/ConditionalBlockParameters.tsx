import { AutoResizingTextarea } from "@/components/AutoResizingTextarea/AutoResizingTextarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { BranchCondition } from "@/routes/workflows/types/workflowTypes";
import { useI18n } from "@/i18n/useI18n";

type Props = {
  branchConditions: Array<BranchCondition> | null;
  executedBranchId: string | null;
  executedBranchExpression: string | null;
  executedBranchResult: boolean | null;
  executedBranchNextBlock: string | null;
};

function ConditionalBlockParameters({
  branchConditions,
  executedBranchId,
  executedBranchExpression,
  executedBranchResult,
  executedBranchNextBlock,
}: Props) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      {executedBranchExpression ? (
        <div className="flex gap-16">
          <div className="w-80">
            <h1 className="text-lg">{t("workflows.executedExpression")}</h1>
            <h2 className="text-base" style={{ color: "var(--finrpa-text-muted)" }}>
              {t("workflows.executedExpressionDesc")}
            </h2>
          </div>
          <AutoResizingTextarea value={executedBranchExpression} readOnly />
        </div>
      ) : null}
      {typeof executedBranchResult === "boolean" ? (
        <div className="flex gap-16">
          <div className="w-80">
            <h1 className="text-lg">{t("workflows.branchResult")}</h1>
          </div>
          <div className="flex w-full items-center gap-3">
            <Switch checked={executedBranchResult} disabled />
            <span className="text-sm" style={{ color: "var(--finrpa-text-muted)" }}>
              {executedBranchResult ? "True" : "False"}
            </span>
          </div>
        </div>
      ) : null}
      {executedBranchNextBlock ? (
        <div className="flex gap-16">
          <div className="w-80">
            <h1 className="text-lg">{t("workflows.nextBlock")}</h1>
            <h2 className="text-base" style={{ color: "var(--finrpa-text-muted)" }}>
              {t("workflows.nextBlockDesc")}
            </h2>
          </div>
          <Input value={executedBranchNextBlock} readOnly />
        </div>
      ) : null}
      {executedBranchId ? (
        <div className="flex gap-16">
          <div className="w-80">
            <h1 className="text-lg">{t("workflows.executedBranchId")}</h1>
          </div>
          <Input value={executedBranchId} readOnly />
        </div>
      ) : null}
      {branchConditions && branchConditions.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-base font-semibold" style={{ color: "var(--finrpa-text-secondary)" }}>
            {t("workflows.branchConditions")}
          </h2>
          {branchConditions.map((condition) => (
            <div
              key={condition.id}
              className="space-y-2 rounded border bg-slate-elevation3 p-3"
              style={{ borderColor: "var(--glass-border)" }}
            >
              {condition.description ? (
                <p className="text-sm" style={{ color: "var(--finrpa-text-muted)" }}>
                  {condition.description}
                </p>
              ) : null}
              {condition.criteria?.expression ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t("workflows.expression")}:</span>
                  <code className="text-sm" style={{ color: "var(--finrpa-text-secondary)" }}>
                    {condition.criteria.expression}
                  </code>
                </div>
              ) : null}
              {condition.next_block_label ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t("workflows.nextBlock")}:</span>
                  <span className="text-sm" style={{ color: "var(--finrpa-text-secondary)" }}>
                    {condition.next_block_label}
                  </span>
                </div>
              ) : null}
              {condition.is_default ? (
                <span className="inline-block rounded px-2 py-0.5 text-xs" style={{ background: "var(--glass-bg)" }}>
                  {t("workflows.default")}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { ConditionalBlockParameters };
