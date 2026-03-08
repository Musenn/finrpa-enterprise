import { forwardRef } from "react";
import { ChatBubbleIcon } from "@radix-ui/react-icons";
import { useI18n } from "@/i18n/useI18n";

interface WorkflowCopilotButtonProps {
  messageCount: number;
  onClick: () => void;
}

export const WorkflowCopilotButton = forwardRef<
  HTMLButtonElement,
  WorkflowCopilotButtonProps
>(({ messageCount, onClick }, ref) => {
  const { t } = useI18n();
  return (
    <button
      ref={ref}
      onClick={onClick}
      className="flex items-center gap-2"
      title={t("workflows.openWorkflowCopilot")}
    >
      <ChatBubbleIcon className="h-4 w-4" />
      <span>{t("workflows.copilot")}</span>
      {messageCount > 0 && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {messageCount}
        </span>
      )}
    </button>
  );
});

WorkflowCopilotButton.displayName = "WorkflowCopilotButton";
