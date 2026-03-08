import { useEffect } from "react";
import { Flippable } from "@/components/Flippable";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Handle, NodeProps, Position, useEdges, useNodes } from "@xyflow/react";
import { useState } from "react";
import type { ActionNode } from "./types";
import { HelpTooltip } from "@/components/HelpTooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { errorMappingExampleValue } from "../types";
import { CodeEditor } from "@/routes/workflows/components/CodeEditor";
import { Switch } from "@/components/ui/switch";
import { placeholders, helpTooltips } from "../../helpContent";
import { AI_IMPROVE_CONFIGS } from "../../constants";
import { WorkflowBlockInputTextarea } from "@/components/WorkflowBlockInputTextarea";
import { useRerender } from "@/hooks/useRerender";
import { BlockCodeEditor } from "@/routes/workflows/components/BlockCodeEditor";
import { WorkflowBlockInput } from "@/components/WorkflowBlockInput";
import { AppNode } from "..";
import {
  getAvailableOutputParameterKeys,
  isNodeInsideForLoop,
} from "../../workflowEditorUtils";
import { ParametersMultiSelect } from "../TaskNode/ParametersMultiSelect";
import { useIsFirstBlockInWorkflow } from "../../hooks/useIsFirstNodeInWorkflow";
import { RunEngineSelector } from "@/components/EngineSelector";
import { ModelSelector } from "@/components/ModelSelector";
import { useBlockScriptStore } from "@/store/BlockScriptStore";
import { cn } from "@/util/utils";
import { useParams } from "react-router-dom";
import { NodeHeader } from "../components/NodeHeader";
import { statusIsRunningOrQueued } from "@/routes/tasks/types";
import { useWorkflowRunQuery } from "@/routes/workflows/hooks/useWorkflowRunQuery";
import { useUpdate } from "@/routes/workflows/editor/useUpdate";

import { DisableCache } from "../DisableCache";
import { BlockExecutionOptions } from "../components/BlockExecutionOptions";
import { useI18n } from "@/i18n/useI18n";

function ActionNode({ id, data, type }: NodeProps<ActionNode>) {
  const { t } = useI18n();
  const [facing, setFacing] = useState<"front" | "back">("front");
  const blockScriptStore = useBlockScriptStore();
  const { editable, label } = data;
  const script = blockScriptStore.scripts[label];
  const { blockLabel: urlBlockLabel } = useParams();
  const { data: workflowRun } = useWorkflowRunQuery();
  const workflowRunIsRunningOrQueued =
    workflowRun && statusIsRunningOrQueued(workflowRun);
  const thisBlockIsTargetted =
    urlBlockLabel !== undefined && urlBlockLabel === label;
  const thisBlockIsPlaying =
    workflowRunIsRunningOrQueued && thisBlockIsTargetted;
  const rerender = useRerender({ prefix: "accordian" });
  const nodes = useNodes<AppNode>();
  const edges = useEdges();
  const outputParameterKeys = getAvailableOutputParameterKeys(nodes, edges, id);
  const update = useUpdate<ActionNode["data"]>({ id, editable });
  const isFirstWorkflowBlock = useIsFirstBlockInWorkflow({ id });
  const isInsideForLoop = isNodeInsideForLoop(nodes, id);

  useEffect(() => {
    setFacing(data.showCode ? "back" : "front");
  }, [data.showCode]);

  return (
    <Flippable facing={facing} preserveFrontsideHeight={true}>
      <div>
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
            totpIdentifier={data.totpIdentifier}
            totpUrl={data.totpVerificationUrl}
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
                  <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.url")}</Label>
                  <HelpTooltip content={helpTooltips["action"]["url"]} />
                </div>
                {isFirstWorkflowBlock ? (
                  <div className="flex justify-end text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                    {t("editor.tipAddParameters")}
                  </div>
                ) : null}
              </div>

              <WorkflowBlockInputTextarea
                nodeId={id}
                onChange={(value) => {
                  update({ url: value });
                }}
                value={data.url}
                placeholder={placeholders["action"]["url"]}
                className="nopan text-xs"
              />
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>
                  {t("editor.actionInstruction")}
                </Label>
                <HelpTooltip content={helpTooltips["action"]["navigationGoal"]} />
              </div>
              <WorkflowBlockInputTextarea
                aiImprove={AI_IMPROVE_CONFIGS.action.navigationGoal}
                nodeId={id}
                onChange={(value) => {
                  update({ navigationGoal: value });
                }}
                value={data.navigationGoal}
                placeholder={placeholders["action"]["navigationGoal"]}
                className="nopan text-xs"
              />
            </div>
            <div className="rounded-md p-2" style={{ background: "var(--glass-bg)" }}>
              <div className="space-y-1 text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                {t("editor.actionBlockTip")}
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
            <AccordionItem value="advanced" className="border-b-0">
              <AccordionTrigger className="py-0">
                {t("editor.advancedSettings")}
              </AccordionTrigger>
              <AccordionContent className="pl-6 pr-1 pt-1">
                <div key={rerender.key} className="space-y-4">
                  <div className="space-y-2">
                    <ModelSelector
                      className="nopan w-52 text-xs"
                      value={data.model}
                      onChange={(value) => {
                        update({ model: value });
                      }}
                    />
                    <ParametersMultiSelect
                      availableOutputParameters={outputParameterKeys}
                      parameters={data.parameterKeys}
                      onParametersChange={(parameterKeys) => {
                        update({ parameterKeys });
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Label className="text-xs font-normal" style={{ color: "var(--finrpa-text-secondary)" }}>
                        {t("tasks.engine")}
                      </Label>
                    </div>
                    <RunEngineSelector
                      value={data.engine}
                      onChange={(value) => {
                        update({ engine: value });
                      }}
                      className="nopan w-52 text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-4">
                      <div className="flex gap-2">
                        <Label className="text-xs font-normal" style={{ color: "var(--finrpa-text-secondary)" }}>
                          {t("editor.errorMessages")}
                        </Label>
                        <HelpTooltip
                          content={helpTooltips["action"]["errorCodeMapping"]}
                        />
                      </div>
                      <Checkbox
                        checked={data.errorCodeMapping !== "null"}
                        disabled={!editable}
                        onCheckedChange={(checked) => {
                          if (!editable) {
                            return;
                          }
                          update({
                            errorCodeMapping: checked
                              ? JSON.stringify(
                                  errorMappingExampleValue,
                                  null,
                                  2,
                                )
                              : "null",
                          });
                        }}
                      />
                    </div>
                    {data.errorCodeMapping !== "null" && (
                      <div>
                        <CodeEditor
                          language="json"
                          value={data.errorCodeMapping}
                          onChange={(value) => {
                            if (!editable) {
                              return;
                            }
                            update({ errorCodeMapping: value });
                          }}
                          className="nopan"
                          fontSize={8}
                        />
                      </div>
                    )}
                  </div>
                  <BlockExecutionOptions
                    continueOnFailure={data.continueOnFailure}
                    nextLoopOnFailure={data.nextLoopOnFailure}
                    editable={editable}
                    isInsideForLoop={isInsideForLoop}
                    blockType="action"
                    onContinueOnFailureChange={(checked) => {
                      update({ continueOnFailure: checked });
                    }}
                    onNextLoopOnFailureChange={(checked) => {
                      update({ nextLoopOnFailure: checked });
                    }}
                  />
                  <DisableCache
                    disableCache={data.disableCache}
                    editable={editable}
                    onDisableCacheChange={(disableCache) => {
                      update({ disableCache });
                    }}
                  />
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Label className="text-xs font-normal" style={{ color: "var(--finrpa-text-secondary)" }}>
                        {t("editor.completeOnDownload")}
                      </Label>
                      <HelpTooltip
                        content={helpTooltips["action"]["completeOnDownload"]}
                      />
                    </div>
                    <div className="w-52">
                      <Switch
                        checked={data.allowDownloads}
                        onCheckedChange={(checked) => {
                          if (!editable) {
                            return;
                          }
                          update({ allowDownloads: checked });
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Label className="text-xs font-normal" style={{ color: "var(--finrpa-text-secondary)" }}>
                        {t("editor.fileName")}
                      </Label>
                      <HelpTooltip
                        content={helpTooltips["action"]["fileSuffix"]}
                      />
                    </div>
                    <WorkflowBlockInput
                      nodeId={id}
                      type="text"
                      placeholder={placeholders["action"]["downloadSuffix"]}
                      className="nopan w-52 text-xs"
                      value={data.downloadSuffix ?? ""}
                      onChange={(value) => {
                        update({ downloadSuffix: value });
                      }}
                    />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>
                        {t("editor.twoFaIdentifier")}
                      </Label>
                      <HelpTooltip
                        content={helpTooltips["action"]["totpIdentifier"]}
                      />
                    </div>
                    <WorkflowBlockInputTextarea
                      nodeId={id}
                      onChange={(value) => {
                        update({ totpIdentifier: value });
                      }}
                      value={data.totpIdentifier ?? ""}
                      placeholder={placeholders["action"]["totpIdentifier"]}
                      className="nopan text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>
                        {t("editor.twoFaVerificationUrl")}
                      </Label>
                      <HelpTooltip
                        content={helpTooltips["task"]["totpVerificationUrl"]}
                      />
                    </div>
                    <WorkflowBlockInputTextarea
                      nodeId={id}
                      onChange={(value) => {
                        update({ totpVerificationUrl: value });
                      }}
                      value={data.totpVerificationUrl ?? ""}
                      placeholder={placeholders["task"]["totpVerificationUrl"]}
                      className="nopan text-xs"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
      <BlockCodeEditor blockLabel={label} blockType={type} script={script} />
    </Flippable>
  );
}

export { ActionNode };
