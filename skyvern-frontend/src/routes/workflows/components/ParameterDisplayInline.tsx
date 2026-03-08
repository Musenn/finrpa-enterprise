import { ReactNode } from "react";
import { cn } from "@/util/utils";
import { HighlightText } from "./HighlightText";
import { useI18n } from "@/i18n/useI18n";

type ParameterDisplayItem = {
  key: string;
  value: unknown;
  description?: string | null;
};

type ParameterDisplayInlineProps = {
  title?: string;
  parameters: Array<ParameterDisplayItem>;
  searchQuery: string;
  keywordMatchesParameter: (parameter: ParameterDisplayItem) => boolean;
  showDescription?: boolean;
  emptyMessage?: ReactNode;
  className?: string;
};

function getDisplayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function ParameterDisplayInline({
  title,
  parameters,
  searchQuery,
  keywordMatchesParameter,
  showDescription = true,
  emptyMessage,
  className,
}: ParameterDisplayInlineProps) {
  const { t } = useI18n();
  const resolvedTitle = title ?? t("workflows.parameters");
  const resolvedEmptyMessage = emptyMessage ?? t("runs.noParameters");
  if (!parameters || parameters.length === 0) {
    return (
      <div className={cn("ml-8 py-4 text-sm", className)} style={{ color: "var(--finrpa-text-muted)" }}>
        {resolvedEmptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("ml-8 space-y-2 py-4", className)}>
      <div className="mb-3 text-sm font-medium">{resolvedTitle}</div>
      <div className="space-y-2">
        {parameters.map((parameter) => {
          const displayValue = getDisplayValue(parameter.value);
          const matches = keywordMatchesParameter(parameter);

          return (
            <div
              key={parameter.key}
              className={cn(
                "grid gap-6 rounded border p-3 text-sm",
                showDescription
                  ? "grid-cols-[minmax(200px,1fr)_minmax(200px,1fr)_minmax(300px,2fr)]"
                  : "grid-cols-[minmax(200px,1fr)_minmax(300px,2fr)]",
                matches &&
                  "shadow-[0_0_15px_rgba(59,130,246,0.3)] ring-2 ring-blue-500/50",
              )}
              style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)" }}
            >
              <div className="font-medium text-blue-600">
                <HighlightText text={parameter.key} query={searchQuery} />
              </div>
              <div className="truncate">
                {displayValue === "-" ? (
                  <span style={{ color: "var(--finrpa-text-muted)" }}>-</span>
                ) : (
                  <HighlightText text={displayValue} query={searchQuery} />
                )}
              </div>
              {showDescription ? (
                <div style={{ color: "var(--finrpa-text-muted)" }}>
                  {parameter.description ? (
                    <HighlightText
                      text={parameter.description}
                      query={searchQuery}
                    />
                  ) : (
                    <span style={{ color: "var(--finrpa-text-muted)" }}>{t("workflows.noDescription")}</span>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type { ParameterDisplayItem };
export { ParameterDisplayInline };
