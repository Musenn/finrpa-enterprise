import { HelpTooltip } from "@/components/HelpTooltip";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { type HumanInteractionNode } from "./types";
import { WorkflowBlockInput } from "@/components/WorkflowBlockInput";
import { WorkflowBlockInputTextarea } from "@/components/WorkflowBlockInputTextarea";
import { cn } from "@/util/utils";
import { NodeHeader } from "../components/NodeHeader";
import { useParams } from "react-router-dom";
import { statusIsRunningOrQueued } from "@/routes/tasks/types";
import { useWorkflowRunQuery } from "@/routes/workflows/hooks/useWorkflowRunQuery";
import { useUpdate } from "@/routes/workflows/editor/useUpdate";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useRerender } from "@/hooks/useRerender";
import { useRecordingStore } from "@/store/useRecordingStore";
import { AI_IMPROVE_CONFIGS } from "../../constants";
import { useI18n } from "@/i18n/useI18n";

function HumanInteractionNode({
  id,
  data,
  type,
}: NodeProps<HumanInteractionNode>) {
  const { t } = useI18n();
  const { editable, label } = data;
  const { blockLabel: urlBlockLabel } = useParams();
  const { data: workflowRun } = useWorkflowRunQuery();
  const recordingStore = useRecordingStore();
  const workflowRunIsRunningOrQueued =
    workflowRun && statusIsRunningOrQueued(workflowRun);
  const thisBlockIsTargetted =
    urlBlockLabel !== undefined && urlBlockLabel === label;
  const thisBlockIsPlaying =
    workflowRunIsRunningOrQueued && thisBlockIsTargetted;
  const update = useUpdate<HumanInteractionNode["data"]>({ id, editable });
  const rerender = useRerender({ prefix: "accordian" });

  return (
    <div
      className={cn({
        "pointer-events-none opacity-50": recordingStore.isRecording,
      })}
    >
      <Handle
        type="source"
        position={Position.Bottom}
        id="a"
        className="opacity-0"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="b"
        className="opacity-0"
      />
      <div
        className={cn(
          "transform-origin-center w-[30rem] space-y-4 rounded-lg bg-slate-elevation3 px-6 py-4 transition-all",
          {
            "pointer-events-none": thisBlockIsPlaying,
            "outline outline-2 outline-primary":
              thisBlockIsTargetted,
          },
          data.comparisonColor,
        )}
      >
        <NodeHeader
          blockLabel={label}
          editable={editable}
          nodeId={id}
          totpIdentifier={null}
          totpUrl={null}
          type={type}
        />
        <div
          className={cn("space-y-4", {
            "opacity-50": thisBlockIsPlaying,
          })}
        >
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="flex gap-2">
                <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>
                  {t("editor.instructionsForHuman")}
                </Label>
                <HelpTooltip content={t("editor.instructionsForHumanHelp")} />
              </div>
            </div>
            {/* TODO(jdo): 'instructions' allows templating; but it requires adding a column to the workflow_block_runs
            table, and I don't want to do that just yet (see /timeline endpoint) */}
            <WorkflowBlockInput
              nodeId={id}
              onChange={(value) => {
                update({ instructions: value });
              }}
              value={data.instructions}
              placeholder={t("editor.instructionsPlaceholder")}
              className="nopan text-xs"
            />
          </div>
          <div className="space-between flex items-center gap-2">
            <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("editor.timeoutMinutes")}</Label>
            <HelpTooltip content={t("editor.humanTimeoutHelp")} />
            <Input
              className="ml-auto w-16 text-right"
              value={data.timeoutSeconds / 60}
              placeholder="120"
              onChange={(event) => {
                if (!editable) {
                  return;
                }
                const value = Number(event.target.value);
                update({ timeoutSeconds: value * 60 });
              }}
            />
          </div>
          <div className="flex items-center justify-center gap-2 rounded-md p-2" style={{ background: "rgba(26,58,92,0.06)" }}>
            <span className="rounded p-1 text-lg" style={{ background: "rgba(26,58,92,0.10)" }}>💡</span>
            <div className="space-y-1 text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
              {t("editor.humanInteractionInfo")}
            </div>
          </div>
          <div className="space-y-4 rounded-md p-4" style={{ background: "rgba(26,58,92,0.06)" }}>
            <h2>{t("editor.emailSettings")}</h2>
            <div className="space-y-2">
              <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("editor.recipients")}</Label>
              <WorkflowBlockInput
                nodeId={id}
                onChange={(value) => {
                  update({ recipients: value });
                }}
                value={data.recipients}
                placeholder="example@gmail.com, example2@gmail.com..."
                className="nopan text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("editor.subject")}</Label>
              <WorkflowBlockInput
                nodeId={id}
                onChange={(value) => {
                  update({ subject: value });
                }}
                value={data.subject}
                placeholder={t("editor.subjectPlaceholder")}
                className="nopan text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("editor.body")}</Label>
              <WorkflowBlockInputTextarea
                aiImprove={AI_IMPROVE_CONFIGS.humanInteraction.body}
                nodeId={id}
                onChange={(value) => {
                  update({ body: value });
                }}
                value={data.body}
                placeholder={t("editor.bodyPlaceholder")}
                className="nopan text-xs"
              />
            </div>
          </div>
        </div>
        <Separator />
        <Accordion
          className={cn({
            "pointer-events-none opacity-50": thisBlockIsPlaying,
          })}
          type="single"
          onValueChange={() => rerender.bump()}
          collapsible
        >
          <AccordionItem value="email" className="border-b-0">
            <AccordionTrigger className="py-0">
              {t("editor.advancedSettings")}
            </AccordionTrigger>
            <AccordionContent className="pl-6 pr-1 pt-1">
              <div key={rerender.key} className="space-y-4 pt-4">
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>
                        {t("editor.negativeButtonLabel")}
                      </Label>
                      <HelpTooltip content={t("editor.negativeButtonHelp")} />
                    </div>
                    <WorkflowBlockInput
                      nodeId={id}
                      onChange={(value) => {
                        update({ negativeDescriptor: value });
                      }}
                      value={data.negativeDescriptor}
                      placeholder="Reject"
                      className="nopan text-xs"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>
                        {t("editor.positiveButtonLabel")}
                      </Label>
                      <HelpTooltip content={t("editor.positiveButtonHelp")} />
                    </div>
                    <WorkflowBlockInput
                      nodeId={id}
                      onChange={(value) => {
                        update({ positiveDescriptor: value });
                      }}
                      value={data.positiveDescriptor}
                      placeholder="Approve"
                      className="nopan text-xs"
                    />
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}

export { HumanInteractionNode };
