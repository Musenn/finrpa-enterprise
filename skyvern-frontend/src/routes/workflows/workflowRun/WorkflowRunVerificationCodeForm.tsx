import { VerificationCodeBanner } from "@/components/VerificationCodeBanner";
import { statusIsFinalized } from "@/routes/tasks/types";
import { useWorkflowRunWithWorkflowQuery } from "../hooks/useWorkflowRunWithWorkflowQuery";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/i18n/useI18n";

function WorkflowRunVerificationCodeForm() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: workflowRun } = useWorkflowRunWithWorkflowQuery();

  const isRunFinalized = workflowRun ? statusIsFinalized(workflowRun) : false;
  const isWaitingForCode =
    !isRunFinalized && (workflowRun?.waiting_for_verification_code ?? false);

  const navigateUrl =
    workflowRun?.workflow?.workflow_permanent_id && workflowRun?.workflow_run_id
      ? `/workflows/${workflowRun.workflow.workflow_permanent_id}/${workflowRun.workflow_run_id}`
      : undefined;

  return (
    <VerificationCodeBanner
      isWaitingForCode={isWaitingForCode}
      pollingStartedAt={
        workflowRun?.verification_code_polling_started_at ?? null
      }
      label={`${t("workflows.workflow")} "${workflowRun?.workflow?.title ?? t("tasks.run")}"`}
      notificationTag={`2fa-required-${workflowRun?.workflow_run_id}`}
      navigateUrl={navigateUrl}
      defaultIdentifier={workflowRun?.verification_code_identifier ?? null}
      defaultWorkflowRunId={workflowRun?.workflow_run_id}
      defaultWorkflowId={workflowRun?.workflow?.workflow_permanent_id}
      onCodeSent={() =>
        queryClient.invalidateQueries({ queryKey: ["workflowRun"] })
      }
    />
  );
}

export { WorkflowRunVerificationCodeForm };
