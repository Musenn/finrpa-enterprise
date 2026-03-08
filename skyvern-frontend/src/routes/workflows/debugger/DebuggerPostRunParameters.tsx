import { useWorkflowRunQuery } from "../hooks/useWorkflowRunQuery";
import { CodeEditor } from "../components/CodeEditor";
import { AutoResizingTextarea } from "@/components/AutoResizingTextarea/AutoResizingTextarea";
import { useActiveWorkflowRunItem } from "@/routes/workflows/workflowRun/useActiveWorkflowRunItem";
import { useWorkflowRunTimelineQuery } from "../hooks/useWorkflowRunTimelineQuery";
import { isAction, isWorkflowRunBlock } from "../types/workflowRunTypes";
import { findBlockSurroundingAction } from "@/routes/workflows/workflowRun/workflowTimelineUtils";
import { DebuggerTaskBlockParameters } from "./DebuggerTaskBlockParameters";
import { isTaskVariantBlock, WorkflowBlockTypes } from "../types/workflowTypes";
import { Input } from "@/components/ui/input";
import { ProxySelector } from "@/components/ProxySelector";
import { DebuggerSendEmailBlockParameters } from "./DebuggerSendEmailBlockInfo";
import { ProxyLocation } from "@/api/types";
import { KeyValueInput } from "@/components/KeyValueInput";
import { HelpTooltip } from "@/components/HelpTooltip";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/useI18n";

function DebuggerPostRunParameters() {
  const { t } = useI18n();
  const { data: workflowRunTimeline, isLoading: workflowRunTimelineIsLoading } =
    useWorkflowRunTimelineQuery();
  const [activeItem] = useActiveWorkflowRunItem();
  const { data: workflowRun, isLoading: workflowRunIsLoading } =
    useWorkflowRunQuery();
  const parameters = workflowRun?.parameters ?? {};

  if (workflowRunIsLoading || workflowRunTimelineIsLoading) {
    return <div>{t("workflows.loadingParameters")}</div>;
  }

  if (!workflowRun || !workflowRunTimeline) {
    return null;
  }

  function getActiveBlock() {
    if (!workflowRunTimeline) {
      return;
    }
    if (isWorkflowRunBlock(activeItem)) {
      return activeItem;
    }
    if (isAction(activeItem)) {
      return findBlockSurroundingAction(
        workflowRunTimeline,
        activeItem.action_id,
      );
    }
  }

  const activeBlock = getActiveBlock();
  const isTaskV2 = workflowRun.task_v2 !== null;

  const webhookCallbackUrl = isTaskV2
    ? workflowRun.task_v2?.webhook_callback_url
    : workflowRun.webhook_callback_url;

  const proxyLocation = isTaskV2
    ? workflowRun.task_v2?.proxy_location
    : workflowRun.proxy_location;

  const extraHttpHeaders = isTaskV2
    ? workflowRun.task_v2?.extra_http_headers
    : workflowRun.extra_http_headers;

  return (
    <div className="space-y-5">
      {activeBlock && isTaskVariantBlock(activeBlock) ? (
        <div className="rounded bg-slate-elevation2 p-6">
          <div className="space-y-4">
            <h1 className="text-sm font-bold">{t("workflows.taskBlockParameters")}</h1>
            <DebuggerTaskBlockParameters block={activeBlock} />
          </div>
        </div>
      ) : null}
      {activeBlock &&
      activeBlock.block_type === WorkflowBlockTypes.SendEmail ? (
        <div className="rounded bg-slate-elevation2 p-6">
          <div className="space-y-4">
            <h1 className="text-sm font-bold">{t("workflows.emailBlockParameters")}</h1>
            <DebuggerSendEmailBlockParameters
              body={activeBlock?.body ?? ""}
              recipients={activeBlock?.recipients ?? []}
              subject={activeBlock?.subject ?? ""}
            />
          </div>
        </div>
      ) : null}
      {activeBlock && activeBlock.block_type === WorkflowBlockTypes.ForLoop ? (
        <div className="rounded bg-slate-elevation2 p-6">
          <div className="space-y-4">
            <h1 className="text-sm font-bold">{t("workflows.forLoopBlockParameters")}</h1>
            <div className="flex flex-col gap-2">
              <div className="flex w-full items-center justify-start gap-2">
                <h1 className="text-sm">{t("workflows.loopValues")}</h1>
                <HelpTooltip content={t("workflows.loopValuesTooltip")} />
              </div>
              <CodeEditor
                className="w-full"
                language="json"
                value={JSON.stringify(activeBlock?.loop_values, null, 2)}
                readOnly
                minHeight="96px"
                maxHeight="200px"
              />
            </div>
          </div>
        </div>
      ) : null}
      {activeBlock && activeBlock.block_type === WorkflowBlockTypes.Wait ? (
        <div className="rounded bg-slate-elevation2 p-6">
          <div className="space-y-4">
            <h1 className="text-sm font-bold">{t("workflows.waitBlockParameters")}</h1>
            <div className="flex flex-col gap-2">
              <div className="flex w-full items-center justify-start gap-2">
                <h1 className="text-sm">{t("workflows.waitDuration")}</h1>
                <HelpTooltip content={t("workflows.waitDurationTooltip")} />
              </div>
              <Input
                value={
                  typeof activeBlock.wait_sec === "number"
                    ? `${activeBlock.wait_sec}s`
                    : "N/A"
                }
                readOnly
              />
            </div>
          </div>
        </div>
      ) : null}
      {activeBlock &&
      activeBlock.block_type === WorkflowBlockTypes.HumanInteraction ? (
        <div className="rounded bg-slate-elevation2 p-6">
          <div className="space-y-4">
            <h1 className="text-sm font-bold">
              {t("workflows.humanInteractionBlockParameters")}
            </h1>
            {activeBlock.instructions ? (
              <div className="flex flex-col gap-2">
                <div className="flex w-full items-center justify-start gap-2">
                  <h1 className="text-sm">{t("workflows.instructions")}</h1>
                  <HelpTooltip content={t("workflows.humanInteractionInstructionsTooltip")} />
                </div>
                <AutoResizingTextarea
                  value={activeBlock.instructions}
                  readOnly
                />
              </div>
            ) : null}
            {activeBlock.positive_descriptor ? (
              <div className="flex flex-col gap-2">
                <h1 className="text-sm">{t("workflows.positiveDescriptor")}</h1>
                <Input value={activeBlock.positive_descriptor} readOnly />
              </div>
            ) : null}
            {activeBlock.negative_descriptor ? (
              <div className="flex flex-col gap-2">
                <h1 className="text-sm">{t("workflows.negativeDescriptor")}</h1>
                <Input value={activeBlock.negative_descriptor} readOnly />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {activeBlock &&
      activeBlock.block_type === WorkflowBlockTypes.Conditional ? (
        <div className="rounded bg-slate-elevation2 p-6">
          <div className="space-y-4">
            <h1 className="text-sm font-bold">{t("workflows.conditionalBlockParameters")}</h1>
            {activeBlock.executed_branch_expression ? (
              <div className="flex flex-col gap-2">
                <div className="flex w-full items-center justify-start gap-2">
                  <h1 className="text-sm">{t("workflows.executedExpression")}</h1>
                  <HelpTooltip content={t("workflows.executedExpressionTooltip")} />
                </div>
                <AutoResizingTextarea
                  value={activeBlock.executed_branch_expression}
                  readOnly
                />
              </div>
            ) : null}
            {typeof activeBlock.executed_branch_result === "boolean" ? (
              <div className="flex flex-col gap-2">
                <h1 className="text-sm">{t("workflows.branchResult")}</h1>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={activeBlock.executed_branch_result}
                    disabled
                  />
                  <span className="text-sm" style={{ color: "var(--finrpa-text-muted)" }}>
                    {activeBlock.executed_branch_result ? "True" : "False"}
                  </span>
                </div>
              </div>
            ) : null}
            {activeBlock.executed_branch_next_block ? (
              <div className="flex flex-col gap-2">
                <h1 className="text-sm">{t("workflows.nextBlock")}</h1>
                <Input
                  value={activeBlock.executed_branch_next_block}
                  readOnly
                />
              </div>
            ) : null}
            {activeBlock.executed_branch_id ? (
              <div className="flex flex-col gap-2">
                <h1 className="text-sm">{t("workflows.executedBranchId")}</h1>
                <Input value={activeBlock.executed_branch_id} readOnly />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {activeBlock &&
      activeBlock.block_type === WorkflowBlockTypes.TextPrompt ? (
        <div className="rounded bg-slate-elevation2 p-6">
          <div className="space-y-4">
            <h1 className="text-sm font-bold">{t("workflows.textPromptBlockParameters")}</h1>
            {activeBlock.prompt ? (
              <div className="flex flex-col gap-2">
                <div className="flex w-full items-center justify-start gap-2">
                  <h1 className="text-sm">{t("tasks.prompt")}</h1>
                  <HelpTooltip content={t("workflows.promptTooltip")} />
                </div>
                <AutoResizingTextarea value={activeBlock.prompt} readOnly />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="rounded bg-slate-elevation2 p-6">
        <div className="space-y-4">
          <h1 className="text-sm font-bold">{t("workflows.workflowParameters")}</h1>
          {Object.entries(parameters).map(([key, value]) => {
            return (
              <div key={key} className="flex flex-col gap-2">
                <div className="flex w-full items-center justify-start gap-2">
                  <h1 className="text-sm">{key}</h1>
                  <HelpTooltip content={t("workflows.parameterValueTooltip")} />
                </div>
                {typeof value === "string" ||
                typeof value === "number" ||
                typeof value === "boolean" ? (
                  <AutoResizingTextarea value={String(value)} readOnly />
                ) : (
                  <CodeEditor
                    value={JSON.stringify(value, null, 2)}
                    readOnly
                    language="json"
                    minHeight="96px"
                    maxHeight="200px"
                    className="w-full"
                  />
                )}
              </div>
            );
          })}
          {Object.entries(parameters).length === 0 ? (
            <div className="text-sm">
              {t("workflows.noInputParametersFound")}
            </div>
          ) : null}
          <h1 className="text-sm font-bold">{t("workflows.otherWorkflowParameters")}</h1>
          <div className="flex flex-col gap-2">
            <div className="flex w-full items-center justify-start gap-2">
              <h1 className="text-sm">{t("tasks.webhookUrl")}</h1>
              <HelpTooltip content={t("workflows.webhookCallbackUrlTooltip")} />
            </div>
            <Input value={webhookCallbackUrl ?? ""} readOnly />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex w-full items-center justify-start gap-2">
              <h1 className="text-sm">{t("tasks.proxyLocation")}</h1>
              <HelpTooltip content={t("workflows.proxyLocationTooltip")} />
            </div>
            <ProxySelector
              value={proxyLocation ?? ProxyLocation.Residential}
              onChange={() => {
                // TODO
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex w-full items-center justify-start gap-2">
              <h1 className="text-sm">{t("tasks.extraHttpHeaders")}</h1>
              <HelpTooltip content={t("workflows.extraHttpHeadersTooltip")} />
            </div>
            <div className="w-full">
              <KeyValueInput
                value={
                  extraHttpHeaders ? JSON.stringify(extraHttpHeaders) : null
                }
                readOnly={true}
                onChange={() => {}}
              />
            </div>
          </div>
          {workflowRun.browser_session_id ? (
            <div className="flex flex-col gap-2">
              <div className="flex w-full items-center justify-start gap-2">
                <h1 className="text-sm">{t("tasks.browserSessionId")}</h1>
                <HelpTooltip content={t("workflows.browserSessionIdTooltip")} />
              </div>
              <Input value={workflowRun.browser_session_id} readOnly />
            </div>
          ) : null}
          {workflowRun.max_screenshot_scrolls != null ? (
            <div className="flex flex-col gap-2">
              <div className="flex w-full items-center justify-start gap-2">
                <h1 className="text-sm">{t("tasks.maxScreenshotScrolls")}</h1>
                <HelpTooltip content={t("workflows.maxScreenshotScrollsTooltip")} />
              </div>
              <Input
                value={workflowRun.max_screenshot_scrolls.toString()}
                readOnly
              />
            </div>
          ) : null}
        </div>
      </div>
      {workflowRun.task_v2 ? (
        <div className="rounded bg-slate-elevation2 p-6">
          <div className="space-y-4">
            <h1 className="text-sm font-bold">{t("workflows.task20Parameters")}</h1>
            <div className="flex flex-col gap-2">
              <div className="flex w-full items-center justify-start gap-2">
                <h1 className="text-sm">{t("workflows.task20Prompt")}</h1>
                <HelpTooltip content={t("workflows.task20PromptTooltip")} />
              </div>
              <AutoResizingTextarea
                value={workflowRun.task_v2?.prompt ?? ""}
                readOnly
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { DebuggerPostRunParameters };
