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
import { Switch } from "@/components/ui/switch";
import { WorkflowBlockInput } from "@/components/WorkflowBlockInput";
import { WorkflowBlockInputTextarea } from "@/components/WorkflowBlockInputTextarea";
import { useRerender } from "@/hooks/useRerender";
import { BlockCodeEditor } from "@/routes/workflows/components/BlockCodeEditor";
import { CodeEditor } from "@/routes/workflows/components/CodeEditor";
import { useBlockScriptStore } from "@/store/BlockScriptStore";
import { Handle, NodeProps, Position, useEdges, useNodes } from "@xyflow/react";
import { useState } from "react";
import { helpTooltips, placeholders } from "../../helpContent";
import { errorMappingExampleValue } from "../types";
import type { NavigationNode } from "./types";
import { MAX_STEPS_DEFAULT } from "./types";
import { ParametersMultiSelect } from "../TaskNode/ParametersMultiSelect";
import { AppNode } from "..";
import {
  getAvailableOutputParameterKeys,
  isNodeInsideForLoop,
} from "../../workflowEditorUtils";
import { useIsFirstBlockInWorkflow } from "../../hooks/useIsFirstNodeInWorkflow";
import { RunEngineSelector } from "@/components/EngineSelector";
import { ModelSelector } from "@/components/ModelSelector";
import { cn } from "@/util/utils";
import { useParams } from "react-router-dom";
import { NodeHeader } from "../components/NodeHeader";
import { NodeTabs } from "../components/NodeTabs";
import { statusIsRunningOrQueued } from "@/routes/tasks/types";
import { useWorkflowRunQuery } from "@/routes/workflows/hooks/useWorkflowRunQuery";
import { useUpdate } from "@/routes/workflows/editor/useUpdate";
import { RunEngine } from "@/api/types";

import { DisableCache } from "../DisableCache";
import { BlockExecutionOptions } from "../components/BlockExecutionOptions";
import { AI_IMPROVE_CONFIGS } from "../../constants";
import { useI18n } from "@/i18n/useI18n";

function NavigationNode({ id, data, type }: NodeProps<NavigationNode>) {
  const { t } = useI18n();
  const { blockLabel: urlBlockLabel } = useParams();
  const [facing, setFacing] = useState<"front" | "back">("front");
  const blockScriptStore = useBlockScriptStore();
  const { editable, label } = data;
  const script = blockScriptStore.scripts[label];
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
  const update = useUpdate<NavigationNode["data"]>({ id, editable });
  const isInsideForLoop = isNodeInsideForLoop(nodes, id);

  // Determine if we're in V2 mode (Skyvern 2.0)
  const isV2Mode = data.engine === RunEngine.SkyvernV2;

  const handleEngineChange = (value: RunEngine) => {
    const updates: Partial<NavigationNode["data"]> = { engine: value };
    if (value === RunEngine.SkyvernV2) {
      // Switching to V2 — preserve prompt content, clear V1-specific fields
      updates.prompt = data.navigationGoal || data.prompt;
      updates.navigationGoal = "";
      updates.completeCriterion = "";
      updates.terminateCriterion = "";
      updates.errorCodeMapping = "null";
      updates.parameterKeys = [];
      updates.maxRetries = null;
      updates.maxStepsOverride = null;
      updates.allowDownloads = false;
      updates.downloadSuffix = null;
      updates.includeActionHistoryInVerification = false;
    } else if (data.engine === RunEngine.SkyvernV2) {
      // Switching away from V2 — preserve prompt content, clear V2-specific fields
      updates.navigationGoal = data.prompt || data.navigationGoal;
      updates.prompt = "";
      updates.maxSteps = MAX_STEPS_DEFAULT;
    }
    update(updates);
  };

  useEffect(() => {
    setFacing(data.showCode ? "back" : "front");
  }, [data.showCode]);

  // V2 Mode UI (simpler interface)
  const renderV2Content = () => (
    <>
      <div
        className={cn("space-y-4", {
          "opacity-50": thisBlockIsPlaying,
        })}
      >
        <div className="space-y-2">
          <div className="flex gap-2">
            <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.url")}</Label>
            <HelpTooltip content={helpTooltips["navigation"]["url"]} />
          </div>
          <WorkflowBlockInputTextarea
            nodeId={id}
            onChange={(value) => {
              update({ url: value });
            }}
            value={data.url}
            placeholder={placeholders["taskv2"]["url"]}
            className="nopan text-xs"
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("editor.prompt")}</Label>
            {isFirstWorkflowBlock ? (
              <div className="flex justify-end text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                {t("editor.tipAddParameters")}
              </div>
            ) : null}
          </div>
          <WorkflowBlockInputTextarea
            aiImprove={AI_IMPROVE_CONFIGS.taskV2.prompt}
            nodeId={id}
            onChange={(value) => {
              update({ prompt: value });
            }}
            value={data.prompt}
            placeholder={placeholders["taskv2"]["prompt"]}
            className="nopan text-xs"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Label className="text-xs font-normal" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.engine")}</Label>
            <HelpTooltip content={helpTooltips["navigation"]["engine"]} />
          </div>
          <RunEngineSelector
            value={data.engine}
            onChange={handleEngineChange}
            className="nopan w-72 text-xs"
            availableEngines={[
              RunEngine.SkyvernV1,
              RunEngine.SkyvernV2,
              RunEngine.OpenaiCua,
              RunEngine.AnthropicCua,
            ]}
          />
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
          <AccordionContent key={rerender.key} className="pl-6 pr-1 pt-4">
            <div className="space-y-4">
              <ModelSelector
                className="nopan w-52 text-xs"
                value={data.model}
                onChange={(value) => {
                  update({ model: value });
                }}
              />
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.maxSteps")}</Label>
                  <HelpTooltip content={helpTooltips["taskv2"]["maxSteps"]} />
                </div>
                <Input
                  type="number"
                  placeholder={`${MAX_STEPS_DEFAULT}`}
                  className="nopan text-xs"
                  value={data.maxSteps ?? MAX_STEPS_DEFAULT}
                  onChange={(event) => {
                    update({
                      maxSteps: Number(event.target.value),
                    });
                  }}
                />
              </div>
              <Separator />
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
                  <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>
                    {t("editor.twoFaIdentifier")}
                  </Label>
                  <HelpTooltip
                    content={helpTooltips["taskv2"]["totpIdentifier"]}
                  />
                </div>
                <WorkflowBlockInputTextarea
                  nodeId={id}
                  onChange={(value) => {
                    update({ totpIdentifier: value });
                  }}
                  value={data.totpIdentifier ?? ""}
                  placeholder={placeholders["navigation"]["totpIdentifier"]}
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
    </>
  );

  // V1 Mode UI (full navigation interface)
  const renderV1Content = () => (
    <>
      <div
        className={cn("space-y-4", {
          "opacity-50": thisBlockIsPlaying,
        })}
      >
        <div className="space-y-2">
          <div className="flex justify-between">
            <div className="flex gap-2">
              <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.url")}</Label>
              <HelpTooltip content={helpTooltips["navigation"]["url"]} />
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
            placeholder={placeholders["navigation"]["url"]}
            className="nopan text-xs"
          />
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("editor.prompt")}</Label>
            <HelpTooltip
              content={helpTooltips["navigation"]["navigationGoal"]}
            />
          </div>
          <WorkflowBlockInputTextarea
            aiImprove={AI_IMPROVE_CONFIGS.navigation.navigationGoal}
            nodeId={id}
            onChange={(value) => {
              update({ navigationGoal: value });
            }}
            value={data.navigationGoal}
            placeholder={placeholders["navigation"]["navigationGoal"]}
            className="nopan text-xs"
          />
        </div>
        <div className="rounded-md p-2" style={{ background: "var(--glass-bg)" }}>
          <div className="space-y-1 text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
            {t("editor.promptGoalTip")}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Label className="text-xs font-normal" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.engine")}</Label>
            <HelpTooltip content={helpTooltips["navigation"]["engine"]} />
          </div>
          <RunEngineSelector
            value={data.engine}
            onChange={handleEngineChange}
            className="nopan w-72 text-xs"
            availableEngines={[
              RunEngine.SkyvernV1,
              RunEngine.SkyvernV2,
              RunEngine.OpenaiCua,
              RunEngine.AnthropicCua,
            ]}
          />
        </div>
      </div>
      <Separator />
      <Accordion
        className={cn({
          "pointer-events-none opacity-50": thisBlockIsPlaying,
        })}
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
                <ParametersMultiSelect
                  availableOutputParameters={outputParameterKeys}
                  parameters={data.parameterKeys}
                  onParametersChange={(parameterKeys) => {
                    update({ parameterKeys });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("editor.completeIf")}</Label>
                <WorkflowBlockInputTextarea
                  aiImprove={AI_IMPROVE_CONFIGS.navigation.completeCriterion}
                  nodeId={id}
                  onChange={(value) => {
                    update({ completeCriterion: value });
                  }}
                  value={data.completeCriterion}
                  className="nopan text-xs"
                />
              </div>
              <Separator />
              <ModelSelector
                className="nopan w-52 text-xs"
                value={data.model}
                onChange={(value) => {
                  update({ model: value });
                }}
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Label className="text-xs font-normal" style={{ color: "var(--finrpa-text-secondary)" }}>
                    {t("editor.maxStepsOverride")}
                  </Label>
                  <HelpTooltip
                    content={helpTooltips["navigation"]["maxStepsOverride"]}
                  />
                </div>
                <Input
                  type="number"
                  placeholder={placeholders["navigation"]["maxStepsOverride"]}
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
                      content={helpTooltips["navigation"]["errorCodeMapping"]}
                    />
                  </div>
                  <Checkbox
                    checked={data.errorCodeMapping !== "null"}
                    disabled={!editable}
                    onCheckedChange={(checked) => {
                      update({
                        errorCodeMapping: checked
                          ? JSON.stringify(errorMappingExampleValue, null, 2)
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
                includeActionHistoryInVerification={
                  data.includeActionHistoryInVerification
                }
                editable={editable}
                isInsideForLoop={isInsideForLoop}
                blockType="navigation"
                showOptions={{
                  continueOnFailure: true,
                  nextLoopOnFailure: true,
                  includeActionHistoryInVerification: true,
                }}
                onContinueOnFailureChange={(checked) => {
                  update({ continueOnFailure: checked });
                }}
                onNextLoopOnFailureChange={(checked) => {
                  update({ nextLoopOnFailure: checked });
                }}
                onIncludeActionHistoryInVerificationChange={(checked) => {
                  update({
                    includeActionHistoryInVerification: checked,
                  });
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
                    content={helpTooltips["navigation"]["completeOnDownload"]}
                  />
                </div>
                <div className="w-52">
                  <Switch
                    checked={data.allowDownloads}
                    onCheckedChange={(checked) => {
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
                    content={helpTooltips["navigation"]["fileSuffix"]}
                  />
                </div>
                <WorkflowBlockInput
                  nodeId={id}
                  type="text"
                  placeholder={placeholders["navigation"]["downloadSuffix"]}
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
                    content={helpTooltips["navigation"]["totpIdentifier"]}
                  />
                </div>
                <WorkflowBlockInputTextarea
                  nodeId={id}
                  onChange={(value) => {
                    update({ totpIdentifier: value });
                  }}
                  value={data.totpIdentifier ?? ""}
                  placeholder={placeholders["navigation"]["totpIdentifier"]}
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
    </>
  );

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
            type={isV2Mode ? "task_v2" : type}
          />
          {isV2Mode ? renderV2Content() : renderV1Content()}
          <NodeTabs blockLabel={label} />
        </div>
      </div>

      <BlockCodeEditor
        blockLabel={label}
        blockType={isV2Mode ? "task_v2" : type}
        script={script}
      />
    </Flippable>
  );
}

export { NavigationNode };
