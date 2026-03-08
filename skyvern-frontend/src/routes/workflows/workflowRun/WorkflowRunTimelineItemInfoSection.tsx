import { Status } from "@/api/types";
import {
  hasExtractedInformation,
  isAction,
  isActionItem,
  isObserverThought,
  isWorkflowRunBlock,
} from "../types/workflowRunTypes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeEditor } from "../components/CodeEditor";
import { AutoResizingTextarea } from "@/components/AutoResizingTextarea/AutoResizingTextarea";
import { WorkflowBlockTypes } from "../types/workflowTypes";
import { statusIsAFailureType } from "@/routes/tasks/types";
import { WorkflowRunOverviewActiveElement } from "./WorkflowRunOverview";
import { ExternalLinkIcon } from "@radix-ui/react-icons";
import { Link } from "react-router-dom";
import { SendEmailBlockParameters } from "./blockInfo/SendEmailBlockInfo";
import { useI18n } from "@/i18n/useI18n";

type Props = {
  activeItem: WorkflowRunOverviewActiveElement;
};

function WorkflowRunTimelineItemInfoSection({ activeItem }: Props) {
  const { t } = useI18n();
  const item = isActionItem(activeItem) ? activeItem.block : activeItem;

  if (!item) {
    return null;
  }
  if (item === "stream") {
    return null;
  }
  if (isAction(item)) {
    return null;
  }
  if (isObserverThought(item)) {
    return (
      <div className="rounded bg-slate-elevation1 p-4">
        <Tabs key="thought" defaultValue="observation">
          <TabsList>
            <TabsTrigger value="observation">{t("workflows.observation")}</TabsTrigger>
            <TabsTrigger value="thought">{t("workflows.thought")}</TabsTrigger>
            <TabsTrigger value="answer">{t("workflows.answer")}</TabsTrigger>
          </TabsList>
          <TabsContent value="observation">
            <AutoResizingTextarea value={item.observation ?? ""} readOnly />
          </TabsContent>
          <TabsContent value="thought">
            <AutoResizingTextarea value={item.thought ?? ""} readOnly />
          </TabsContent>
          <TabsContent value="answer">
            <AutoResizingTextarea value={item.answer ?? ""} readOnly />
          </TabsContent>
        </Tabs>
      </div>
    );
  }
  if (isWorkflowRunBlock(item)) {
    const showExtractedInformationTab = item.status === Status.Completed;
    const showFailureReasonTab =
      item.status &&
      (statusIsAFailureType({ status: item.status }) ||
        item.status === Status.Canceled);
    const defaultTab = showExtractedInformationTab
      ? "extracted_information"
      : showFailureReasonTab
        ? "failure_reason"
        : "navigation_goal";
    if (
      item.block_type === WorkflowBlockTypes.Task ||
      item.block_type === WorkflowBlockTypes.Navigation ||
      item.block_type === WorkflowBlockTypes.Action ||
      item.block_type === WorkflowBlockTypes.Extraction ||
      item.block_type === WorkflowBlockTypes.Validation ||
      item.block_type === WorkflowBlockTypes.Login ||
      item.block_type === WorkflowBlockTypes.FileDownload
    ) {
      return (
        <div className="rounded bg-slate-elevation1 p-4">
          <Tabs key={item.task_id ?? item.block_type} defaultValue={defaultTab}>
            <TabsList>
              {item.status === Status.Completed && (
                <TabsTrigger value="extracted_information">
                  {t("tasks.extractedData")}
                </TabsTrigger>
              )}
              {showFailureReasonTab && (
                <TabsTrigger value="failure_reason">{t("tasks.failureReason")}</TabsTrigger>
              )}
              <TabsTrigger value="navigation_goal">{t("tasks.navigationGoal")}</TabsTrigger>
              <TabsTrigger value="parameters">{t("workflows.parameters")}</TabsTrigger>
              {item.task_id && (
                <Link
                  to={`/tasks/${item.task_id}/diagnostics`}
                  title="Go to diagnostics"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center gap-2 px-3 py-1 text-sm font-medium">
                    <ExternalLinkIcon />
                    <span>{t("tasks.diagnostics")}</span>
                  </div>
                </Link>
              )}
            </TabsList>
            {item.status === Status.Completed && (
              <TabsContent value="extracted_information">
                <CodeEditor
                  language="json"
                  value={JSON.stringify(
                    (hasExtractedInformation(item.output) &&
                      item.output.extracted_information) ??
                      null,
                    null,
                    2,
                  )}
                  minHeight="96px"
                  maxHeight="500px"
                  readOnly
                />
              </TabsContent>
            )}
            {showFailureReasonTab && (
              <TabsContent value="failure_reason">
                <AutoResizingTextarea
                  value={
                    item.status === "canceled"
                      ? t("workflows.blockWasCancelled")
                      : item.failure_reason ?? ""
                  }
                  readOnly
                />
              </TabsContent>
            )}
            <TabsContent value="navigation_goal">
              <AutoResizingTextarea
                value={item.navigation_goal ?? ""}
                readOnly
              />
            </TabsContent>
            <TabsContent value="parameters">
              <CodeEditor
                value={JSON.stringify(item.navigation_payload, null, 2)}
                minHeight="96px"
                maxHeight="500px"
                language="json"
                readOnly
              />
            </TabsContent>
          </Tabs>
        </div>
      );
    }
    if (item.block_type === WorkflowBlockTypes.SendEmail) {
      if (
        item.body !== null &&
        typeof item.body !== "undefined" &&
        item.recipients !== null &&
        typeof item.recipients !== "undefined" &&
        item.subject !== null &&
        typeof item.subject !== "undefined"
      ) {
        return (
          <SendEmailBlockParameters
            body={item.body}
            recipients={item.recipients}
            subject={item.subject}
          />
        );
      }
      return null;
    }

    if (item.block_type === WorkflowBlockTypes.TextPrompt) {
      if (item.prompt !== null) {
        return (
          <div className="rounded bg-slate-elevation1 p-4">
            <Tabs key={item.block_type} defaultValue="prompt">
              <TabsList>
                <TabsTrigger value="prompt">{t("tasks.prompt")}</TabsTrigger>
                <TabsTrigger value="output">{t("workflows.output")}</TabsTrigger>
              </TabsList>
              <TabsContent value="prompt">
                <CodeEditor
                  value={item.prompt ?? ""}
                  minHeight="96px"
                  maxHeight="500px"
                  readOnly
                />
              </TabsContent>
              <TabsContent value="output">
                <CodeEditor
                  value={JSON.stringify(item.output, null, 2)}
                  minHeight="96px"
                  maxHeight="500px"
                  language="json"
                  readOnly
                />
              </TabsContent>
            </Tabs>
          </div>
        );
      }
      return null;
    }

    if (item.block_type === WorkflowBlockTypes.Wait) {
      if (item.wait_sec !== null && typeof item.wait_sec !== "undefined") {
        return (
          <div className="flex w-1/2 justify-between rounded bg-slate-elevation1 p-4">
            <span className="text-sm" style={{ color: "var(--finrpa-text-muted)" }}>{t("workflows.waitTime")}</span>
            <span className="text-sm">{item.wait_sec} {t("workflows.seconds")}</span>
          </div>
        );
      }
      return null;
    }

    const fallbackDefaultTab = showFailureReasonTab
      ? "failure_reason"
      : "output";
    return (
      <div className="rounded bg-slate-elevation1 p-4">
        <Tabs key={item.block_type} defaultValue={fallbackDefaultTab}>
          <TabsList>
            {showFailureReasonTab && (
              <TabsTrigger value="failure_reason">{t("tasks.failureReason")}</TabsTrigger>
            )}
            <TabsTrigger value="output">{t("workflows.output")}</TabsTrigger>
          </TabsList>
          {showFailureReasonTab && (
            <TabsContent value="failure_reason">
              <AutoResizingTextarea
                value={
                  item.status === "canceled"
                    ? t("workflows.blockWasCancelled")
                    : item.failure_reason ?? ""
                }
                readOnly
              />
            </TabsContent>
          )}
          <TabsContent value="output">
            <CodeEditor
              value={JSON.stringify(item.output, null, 2)}
              minHeight="96px"
              maxHeight="500px"
              language="json"
              readOnly
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }
}

export { WorkflowRunTimelineItemInfoSection };
