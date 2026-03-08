import { useEffect } from "react";
import { Flippable } from "@/components/Flippable";
import { HelpTooltip } from "@/components/HelpTooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { WorkflowBlockInputTextarea } from "@/components/WorkflowBlockInputTextarea";
import { BlockCodeEditor } from "@/routes/workflows/components/BlockCodeEditor";
import { CodeEditor } from "@/routes/workflows/components/CodeEditor";
import { useBlockScriptStore } from "@/store/BlockScriptStore";
import { Handle, NodeProps, Position, useEdges, useNodes } from "@xyflow/react";
import { useState } from "react";
import { helpTooltips, placeholders } from "../../helpContent";
import { errorMappingExampleValue } from "../types";
import type { FileDownloadNode } from "./types";
import { AppNode } from "..";
import {
  getAvailableOutputParameterKeys,
  isNodeInsideForLoop,
} from "../../workflowEditorUtils";
import { ParametersMultiSelect } from "../TaskNode/ParametersMultiSelect";
import { useIsFirstBlockInWorkflow } from "../../hooks/useIsFirstNodeInWorkflow";
import { RunEngineSelector } from "@/components/EngineSelector";
import { ModelSelector } from "@/components/ModelSelector";
import { cn } from "@/util/utils";
import { NodeHeader } from "../components/NodeHeader";
import { useParams } from "react-router-dom";
import { statusIsRunningOrQueued } from "@/routes/tasks/types";
import { useWorkflowRunQuery } from "@/routes/workflows/hooks/useWorkflowRunQuery";
import { useUpdate } from "@/routes/workflows/editor/useUpdate";
import { useRerender } from "@/hooks/useRerender";
import { BROWSER_DOWNLOAD_TIMEOUT_SECONDS } from "@/api/types";

import { DisableCache } from "../DisableCache";
import { BlockExecutionOptions } from "../components/BlockExecutionOptions";
import { AI_IMPROVE_CONFIGS } from "../../constants";
import { useI18n } from "@/i18n/useI18n";

function FileDownloadNode({ id, data }: NodeProps<FileDownloadNode>) {
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
  const isFirstWorkflowBlock = useIsFirstBlockInWorkflow({ id });
  const update = useUpdate<FileDownloadNode["data"]>({ id, editable });
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
          )}
        >
          <NodeHeader
            blockLabel={label}
            editable={editable}
            nodeId={id}
            totpIdentifier={data.totpIdentifier}
            totpUrl={data.totpVerificationUrl}
            type="file_download" // sic: the naming for this block is not consistent
          />
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="flex gap-2">
                  <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.url")}</Label>
                  <HelpTooltip content={helpTooltips["download"]["url"]} />
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
                placeholder={placeholders["download"]["url"]}
                className="nopan text-xs"
              />
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("editor.downloadGoal")}</Label>
                <HelpTooltip content={helpTooltips["download"]["navigationGoal"]} />
              </div>
              <WorkflowBlockInputTextarea
                aiImprove={AI_IMPROVE_CONFIGS.fileDownload.navigationGoal}
                nodeId={id}
                onChange={(value) => {
                  update({ navigationGoal: value });
                }}
                value={data.navigationGoal}
                placeholder={placeholders["download"]["navigationGoal"]}
                className="nopan text-xs"
              />
            </div>
            <div className="space-y-2">
              <div className="space-between flex items-center gap-2">
                <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>
                  {t("editor.downloadTimeoutSec")}
                </Label>
                <HelpTooltip
                  content={t("editor.downloadTimeoutHelp", { seconds: BROWSER_DOWNLOAD_TIMEOUT_SECONDS })}
                />

                <Input
                  className="ml-auto w-16 text-right"
                  value={data.downloadTimeout ?? undefined}
                  placeholder={`${BROWSER_DOWNLOAD_TIMEOUT_SECONDS}`}
                  onChange={(event) => {
                    const value =
                      event.target.value === ""
                        ? null
                        : Number(event.target.value);

                    if (value) {
                      update({ downloadTimeout: value });
                    }
                  }}
                />
              </div>
            </div>
            <div className="rounded-md p-2 text-xs" style={{ background: "var(--glass-bg)", color: "var(--finrpa-text-muted)" }}>
              {t("editor.downloadCompleteHint")}
            </div>
          </div>
          <Separator />
          <Accordion
            type="single"
            collapsible
            onValueChange={() => rerender.bump()}
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
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Label className="text-xs font-normal" style={{ color: "var(--finrpa-text-secondary)" }}>
                        {t("editor.maxStepsOverride")}
                      </Label>
                      <HelpTooltip
                        content={helpTooltips["download"]["maxStepsOverride"]}
                      />
                    </div>
                    <Input
                      type="number"
                      placeholder={placeholders["download"]["maxStepsOverride"]}
                      className="nopan w-52 text-xs"
                      min="0"
                      value={data.maxStepsOverride ?? ""}
                      onChange={(event) => {
                        const value =
                          event.target.value === ""
                            ? null
                            : Number(event.target.value);
                        update({ maxStepsOverride: value });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-4">
                      <div className="flex gap-2">
                        <Label className="text-xs font-normal" style={{ color: "var(--finrpa-text-secondary)" }}>
                          {t("editor.errorMessages")}
                        </Label>
                        <HelpTooltip
                          content={helpTooltips["download"]["errorCodeMapping"]}
                        />
                      </div>
                      <Checkbox
                        checked={data.errorCodeMapping !== "null"}
                        disabled={!editable}
                        onCheckedChange={(checked) => {
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
                    blockType="download"
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
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Label className="text-xs font-normal" style={{ color: "var(--finrpa-text-secondary)" }}>
                        {t("editor.fileName")}
                      </Label>
                      <HelpTooltip
                        content={helpTooltips["download"]["fileSuffix"]}
                      />
                    </div>
                    <WorkflowBlockInputTextarea
                      nodeId={id}
                      onChange={(value) => {
                        update({ downloadSuffix: value });
                      }}
                      value={data.downloadSuffix ?? ""}
                      placeholder={placeholders["download"]["downloadSuffix"]}
                      className="nopan text-xs"
                    />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>
                        {t("editor.twoFaIdentifier")}
                      </Label>
                      <HelpTooltip
                        content={helpTooltips["download"]["totpIdentifier"]}
                      />
                    </div>
                    <WorkflowBlockInputTextarea
                      nodeId={id}
                      onChange={(value) => {
                        update({ totpIdentifier: value });
                      }}
                      value={data.totpIdentifier ?? ""}
                      placeholder={placeholders["download"]["totpIdentifier"]}
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
      <BlockCodeEditor
        blockLabel={label}
        blockType="file_download" // sic: naming is not consistent
        script={script}
      />
    </Flippable>
  );
}

export { FileDownloadNode };
