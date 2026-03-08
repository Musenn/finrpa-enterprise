import { RunEngine } from "@/api/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { cn } from "@/util/utils";
import { useI18n } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/locales";

type EngineOption = {
  value: RunEngine;
  label: string;
  badgeKey?: string;
  badgeVariant?: "default" | "success" | "warning";
};

type Props = {
  value: RunEngine | null;
  onChange: (value: RunEngine) => void;
  className?: string;
  availableEngines?: Array<RunEngine>;
};

const allEngineOptions: Array<EngineOption> = [
  {
    value: RunEngine.SkyvernV1,
    label: "FinRPA 1.0",
    badgeKey: "common.recommended",
    badgeVariant: "success",
  },
  {
    value: RunEngine.SkyvernV2,
    label: "FinRPA 2.0",
    badgeKey: "common.multiGoal",
    badgeVariant: "warning",
  },
  {
    value: RunEngine.OpenaiCua,
    label: "OpenAI CUA",
  },
  {
    value: RunEngine.AnthropicCua,
    label: "Anthropic CUA",
  },
];

// Default engines for blocks that don't support V2 mode
const defaultEngines: Array<RunEngine> = [
  RunEngine.SkyvernV1,
  RunEngine.OpenaiCua,
  RunEngine.AnthropicCua,
];

function BadgeLabel({ option }: { option: EngineOption }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <span>{option.label}</span>
      {option.badgeKey && (
        <span
          className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", {
            "bg-green-500/20 text-green-400": option.badgeVariant === "success",
            "bg-amber-500/20 text-amber-400": option.badgeVariant === "warning",
            "bg-gray-500/20 text-gray-500":
              option.badgeVariant === "default" || !option.badgeVariant,
          })}
        >
          {t(option.badgeKey as MessageKey)}
        </span>
      )}
    </div>
  );
}

function RunEngineSelector({
  value,
  onChange,
  className,
  availableEngines,
}: Props) {
  const engines = availableEngines ?? defaultEngines;
  const engineOptions = allEngineOptions.filter((opt) =>
    engines.includes(opt.value),
  );

  const selectedOption = engineOptions.find(
    (opt) => opt.value === (value ?? RunEngine.SkyvernV1),
  );

  return (
    <Select value={value ?? RunEngine.SkyvernV1} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue>
          {selectedOption && <BadgeLabel option={selectedOption} />}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {engineOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <BadgeLabel option={option} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { RunEngineSelector };
