import { TaskHistory } from "./TaskHistory";
import { PromptBox } from "../create/PromptBox";
import { useState } from "react";
import { cn } from "@/util/utils";
import { SavedTasks } from "../create/SavedTasks";
import { useI18n } from "@/i18n/useI18n";

function TasksPage() {
  const { t } = useI18n();
  const [view, setView] = useState<"history" | "myTasks">("history");

  return (
    <div className="space-y-8">
      <PromptBox />
      <div className="flex w-fit gap-0.5 rounded-lg p-1" style={{ background: "rgba(26,58,92,0.06)" }}>
        <div
          className={cn(
            "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            view === "history"
              ? "shadow-sm"
              : "hover:bg-white/50",
          )}
          style={{
            color: view === "history" ? "white" : "var(--finrpa-text-muted)",
            background: view === "history" ? "var(--finrpa-blue)" : undefined,
          }}
          onClick={() => setView("history")}
        >
          {t("tasks.runHistory")}
        </div>
        <div
          className={cn(
            "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            view === "myTasks"
              ? "shadow-sm"
              : "hover:bg-white/50",
          )}
          style={{
            color: view === "myTasks" ? "white" : "var(--finrpa-text-muted)",
            background: view === "myTasks" ? "var(--finrpa-blue)" : undefined,
          }}
          onClick={() => setView("myTasks")}
        >
          {t("tasks.myTasks")}
        </div>
      </div>
      {view === "history" && <TaskHistory />}
      {view === "myTasks" && <SavedTasks />}
    </div>
  );
}

export { TasksPage };
