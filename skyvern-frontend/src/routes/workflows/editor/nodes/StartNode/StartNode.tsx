import {
  Handle,
  Node,
  NodeProps,
  Position,
  useEdges,
  useNodes,
  useReactFlow,
} from "@xyflow/react";
import type { StartNode } from "./types";
import { AppNode } from "..";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProxyLocation } from "@/api/types";
import { Label } from "@/components/ui/label";
import { HelpTooltip } from "@/components/HelpTooltip";
import { WorkflowBlockInputTextarea } from "@/components/WorkflowBlockInputTextarea";
import { Input } from "@/components/ui/input";
import { ProxySelector } from "@/components/ProxySelector";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ModelSelector } from "@/components/ModelSelector";
import { WorkflowModel } from "@/routes/workflows/types/workflowTypes";
import { MAX_SCREENSHOT_SCROLLS_DEFAULT } from "../Taskv2Node/types";
import { KeyValueInput } from "@/components/KeyValueInput";
import { placeholders } from "@/routes/workflows/editor/helpContent";
import { useToggleScriptForNodeCallback } from "@/routes/workflows/hooks/useToggleScriptForNodeCallback";
import { useWorkflowSettingsStore } from "@/store/WorkflowSettingsStore";
import {
  scriptableWorkflowBlockTypes,
  type WorkflowBlockType,
} from "@/routes/workflows/types/workflowTypes";
import { Flippable } from "@/components/Flippable";
import { useRerender } from "@/hooks/useRerender";
import { useBlockScriptStore } from "@/store/BlockScriptStore";
import { useRecordingStore } from "@/store/useRecordingStore";
import { BlockCodeEditor } from "@/routes/workflows/components/BlockCodeEditor";
import { useUpdate } from "@/routes/workflows/editor/useUpdate";
import { cn } from "@/util/utils";
import { Button } from "@/components/ui/button";
import { TestWebhookDialog } from "@/components/TestWebhookDialog";
import { getWorkflowBlocks } from "../../workflowEditorUtils";
import { useI18n } from "@/i18n/useI18n";

interface StartSettings {
  webhookCallbackUrl: string;
  proxyLocation: ProxyLocation;
  persistBrowserSession: boolean;
  model: WorkflowModel | null;
  maxScreenshotScrollingTimes: number | null;
  extraHttpHeaders: string | Record<string, unknown> | null;
  finallyBlockLabel: string | null;
}

function StartNode({ id, data, parentId }: NodeProps<StartNode>) {
  const { t } = useI18n();
  const workflowSettingsStore = useWorkflowSettingsStore();
  const reactFlowInstance = useReactFlow();
  const nodes = useNodes<AppNode>();
  const edges = useEdges();
  const [facing, setFacing] = useState<"front" | "back">("front");
  const blockScriptStore = useBlockScriptStore();
  const recordingStore = useRecordingStore();
  const script = blockScriptStore.scripts.__start_block__;
  const rerender = useRerender({ prefix: "accordion" });
  const toggleScriptForNodeCallback = useToggleScriptForNodeCallback();
  const isRecording = recordingStore.isRecording;

  // Local state for webhook URL to fix race condition where data.webhookCallbackUrl
  // isn't updated yet when user clicks "Test Webhook" after typing
  const webhookCallbackUrl = data.withWorkflowSettings
    ? data.webhookCallbackUrl
    : "";
  const [localWebhookUrl, setLocalWebhookUrl] = useState(webhookCallbackUrl);
  const prevWebhookUrl = useRef(webhookCallbackUrl);

  // Sync from parent only on external changes (e.g., undo/redo), not our own updates
  useEffect(() => {
    if (!data.withWorkflowSettings) {
      setLocalWebhookUrl("");
      return;
    }

    const parentChanged = webhookCallbackUrl !== prevWebhookUrl.current;
    const isExternalChange =
      parentChanged && localWebhookUrl === prevWebhookUrl.current;

    if (isExternalChange) {
      setLocalWebhookUrl(webhookCallbackUrl);
    }
    prevWebhookUrl.current = webhookCallbackUrl;
  }, [data.withWorkflowSettings, webhookCallbackUrl, localWebhookUrl]);

  const parentNode = parentId ? reactFlowInstance.getNode(parentId) : null;
  const isInsideConditional = parentNode?.type === "conditional";
  const isInsideLoop = parentNode?.type === "loop";
  const withWorkflowSettings = data.withWorkflowSettings;
  const finallyBlockLabel = withWorkflowSettings
    ? data.finallyBlockLabel
    : null;

  // Only allow terminal blocks (next_block_label === null) for the finally block dropdown.
  const terminalBlockLabels = useMemo(() => {
    return getWorkflowBlocks(nodes, edges)
      .filter((block) => (block.next_block_label ?? null) === null)
      .map((block) => block.label);
  }, [nodes, edges]);
  const terminalBlockLabelSet = useMemo(() => {
    return new Set(terminalBlockLabels);
  }, [terminalBlockLabels]);

  const makeStartSettings = (data: StartNode["data"]): StartSettings => {
    return {
      webhookCallbackUrl: data.withWorkflowSettings
        ? data.webhookCallbackUrl
        : "",
      proxyLocation: data.withWorkflowSettings
        ? data.proxyLocation
        : ProxyLocation.Residential,
      persistBrowserSession: data.withWorkflowSettings
        ? data.persistBrowserSession
        : false,
      model: data.withWorkflowSettings ? data.model : null,
      maxScreenshotScrollingTimes: data.withWorkflowSettings
        ? data.maxScreenshotScrolls
        : null,
      extraHttpHeaders: data.withWorkflowSettings
        ? data.extraHttpHeaders
        : null,
      finallyBlockLabel: data.withWorkflowSettings
        ? data.finallyBlockLabel
        : null,
    };
  };

  const update = useUpdate<StartNode["data"]>({ id, editable: true });

  useEffect(() => {
    setFacing(data.showCode ? "back" : "front");
  }, [data.showCode]);

  useEffect(() => {
    workflowSettingsStore.setWorkflowSettings(makeStartSettings(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (
      withWorkflowSettings &&
      finallyBlockLabel &&
      !terminalBlockLabelSet.has(finallyBlockLabel)
    ) {
      update({ finallyBlockLabel: null });
    }
  }, [finallyBlockLabel, withWorkflowSettings, terminalBlockLabelSet, update]);

  function nodeIsFlippable(node: Node) {
    return (
      scriptableWorkflowBlockTypes.has(node.type as WorkflowBlockType) ||
      node.type === "start"
    );
  }

  // NOTE(jdo): keeping for reference; we seem to revert stuff all the time
  // function showAllScripts() {
  //   for (const node of reactFlowInstance.getNodes()) {
  //     const label = node.data.label;

  //     label &&
  //       nodeIsFlippable(node) &&
  //       typeof label === "string" &&
  //       toggleScriptForNodeCallback({
  //         label,
  //         show: true,
  //       });
  //   }
  // }

  function hideAllScripts() {
    for (const node of reactFlowInstance.getNodes()) {
      const label = node.data.label;

      label &&
        nodeIsFlippable(node) &&
        typeof label === "string" &&
        toggleScriptForNodeCallback({
          label,
          show: false,
        });
    }
  }

  if (data.withWorkflowSettings) {
    return (
      <Flippable facing={facing} preserveFrontsideHeight={true}>
        <div>
          <Handle
            type="source"
            position={Position.Bottom}
            id="a"
            className="opacity-0"
          />
          <div
            className={cn(
              "w-[30rem] rounded-lg bg-slate-elevation3 px-6 py-4 text-center",
              { "h-[20rem] overflow-hidden": facing === "back" },
            )}
          >
            <div className="relative">
              <header className="mb-6 mt-2">{t("editor.start")}</header>
              <Separator />
              <Accordion
                type="single"
                collapsible
                onValueChange={() => rerender.bump()}
              >
                <AccordionItem value="settings" className="mt-4 border-b-0">
                  <AccordionTrigger className="py-2">
                    {t("editor.workflowSettings")}
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
                      </div>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Label>{t("editor.webhookCallbackUrl")}</Label>
                          <HelpTooltip content={t("editor.webhookCallbackUrlHelp")} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Input
                            className="w-full"
                            value={localWebhookUrl}
                            placeholder="https://"
                            onChange={(event) => {
                              setLocalWebhookUrl(event.target.value);
                              update({
                                webhookCallbackUrl: event.target.value,
                              });
                            }}
                          />
                          <TestWebhookDialog
                            runType="workflow_run"
                            runId={null}
                            initialWebhookUrl={localWebhookUrl || undefined}
                            autoRunOnOpen={false}
                            trigger={
                              <Button
                                type="button"
                                variant="secondary"
                                className="self-start"
                                disabled={!localWebhookUrl}
                              >
                                {t("editor.testWebhook")}
                              </Button>
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Label>{t("tasks.proxyLocation")}</Label>
                          <HelpTooltip content={t("tasks.proxyHelper")} />
                        </div>
                        <ProxySelector
                          value={data.proxyLocation}
                          onChange={(value) => {
                            update({ proxyLocation: value });
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-4 rounded-md bg-slate-elevation5 p-4 pl-4">
                        <div className="flex flex-col gap-4">
                          <div className="flex justify-between">
                            <div className="flex items-center gap-2">
                              <Label>{t("workflows.runWith")}</Label>
                              <HelpTooltip content={t("editor.runWithHelp")} />
                            </div>
                            <Select
                              value={data.runWith ?? "agent"}
                              onValueChange={(value) => {
                                update({ runWith: value });
                              }}
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue placeholder={t("editor.runMethod")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="agent">
                                  {t("workflows.finrpaAgent")}
                                </SelectItem>
                                <SelectItem value="code">{t("workflows.code")}</SelectItem>
                                <SelectItem value="code_v2">
                                  <span>{t("workflows.code20")}</span>{" "}
                                  <span className="text-xs italic text-yellow-400">
                                    {t("editor.new")}
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label>{t("workflows.aiFallback")}</Label>
                              <HelpTooltip content={t("workflows.aiFallbackDesc")} />
                              <Switch
                                className="ml-auto"
                                checked={data.aiFallback}
                                onCheckedChange={(value) => {
                                  update({ aiFallback: value });
                                }}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <Label>{t("editor.codeKeyOptional")}</Label>
                              <HelpTooltip content={t("editor.codeKeyHelp")} />
                            </div>
                            <WorkflowBlockInputTextarea
                              nodeId={id}
                              onChange={(value) => {
                                const v = value.length ? value : null;
                                update({ scriptCacheKey: v });
                              }}
                              value={data.scriptCacheKey ?? ""}
                              placeholder={placeholders["scripts"]["scriptKey"]}
                              className="nopan text-xs"
                            />
                          </div>
                        </div>
                        {/* )} */}
                      </div>
                      <div className="flex flex-col gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label>{t("editor.runSequentially")}</Label>
                            <HelpTooltip content={t("editor.runSequentiallyHelp")} />
                            <Switch
                              className="ml-auto"
                              checked={data.runSequentially}
                              onCheckedChange={(value) => {
                                update({
                                  runSequentially: value,
                                  sequentialKey: value
                                    ? data.sequentialKey
                                    : null,
                                });
                              }}
                            />
                          </div>
                        </div>
                        {data.runSequentially && (
                          <div className="flex flex-col gap-4 rounded-md bg-slate-elevation4 p-4 pl-4">
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Label>{t("editor.sequentialKeyOptional")}</Label>
                                <HelpTooltip content={t("editor.sequentialKeyHelp")} />
                              </div>
                              <WorkflowBlockInputTextarea
                                nodeId={id}
                                onChange={(value) => {
                                  const v = value.length ? value : null;
                                  update({ sequentialKey: v });
                                }}
                                value={data.sequentialKey ?? ""}
                                placeholder={placeholders["sequentialKey"]}
                                className="nopan text-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label>{t("editor.saveReuseSession")}</Label>
                          <HelpTooltip content={t("editor.saveReuseSessionHelp")} />
                          <Switch
                            className="ml-auto"
                            checked={data.persistBrowserSession}
                            onCheckedChange={(value) => {
                              update({ persistBrowserSession: value });
                            }}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label>{t("editor.extraHttpHeaders")}</Label>
                          <HelpTooltip content={t("editor.extraHttpHeadersHelp")} />
                        </div>
                        <KeyValueInput
                          value={
                            data.extraHttpHeaders &&
                            typeof data.extraHttpHeaders === "object"
                              ? JSON.stringify(data.extraHttpHeaders)
                              : data.extraHttpHeaders ?? null
                          }
                          onChange={(val) => {
                            const v =
                              val === null
                                ? "{}"
                                : typeof val === "string"
                                  ? val.trim()
                                  : JSON.stringify(val);

                            const normalized = v === "" ? "{}" : v;

                            if (normalized === data.extraHttpHeaders) {
                              return;
                            }

                            update({ extraHttpHeaders: normalized });
                          }}
                          addButtonText={t("editor.addHeader")}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label>{t("editor.maxScreenshotScrolls")}</Label>
                          <HelpTooltip
                            content={`The maximum number of scrolls for the post action screenshot. Default is ${MAX_SCREENSHOT_SCROLLS_DEFAULT}. If it's set to 0, it will take the current viewport screenshot.`}
                          />
                        </div>
                        <Input
                          value={data.maxScreenshotScrolls ?? ""}
                          placeholder={`Default: ${MAX_SCREENSHOT_SCROLLS_DEFAULT}`}
                          onChange={(event) => {
                            const value =
                              event.target.value === ""
                                ? null
                                : Number(event.target.value);

                            update({ maxScreenshotScrolls: value });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label>{t("editor.executeOnAnyOutcome")}</Label>
                          <HelpTooltip content={t("editor.executeOnAnyOutcomeHelp")} />
                        </div>
                        <Select
                          value={data.finallyBlockLabel ?? "none"}
                          onValueChange={(value) => {
                            update({
                              finallyBlockLabel:
                                value === "none" ? null : value,
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("editor.none")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t("editor.none")}</SelectItem>
                            {terminalBlockLabels.map((label) => (
                              <SelectItem key={label} value={label}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </div>

        <BlockCodeEditor
          blockLabel="__start_block__"
          title={t("editor.start")}
          script={script}
          onExit={() => {
            hideAllScripts();
            return false;
          }}
        />
      </Flippable>
    );
  }

  return (
    <div
      className={cn({
        "pointer-events-none opacity-50": isRecording,
      })}
    >
      <Handle
        type="source"
        position={Position.Bottom}
        id="a"
        className="opacity-0"
      />
      <div className="w-[30rem] rounded-lg bg-slate-elevation4 px-6 py-4 text-center text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--finrpa-text-muted)" }}>
        {t("editor.start")}
        {isInsideLoop && (
          <div className="mt-4 flex gap-3 rounded-md p-3 normal-case tracking-normal" style={{ background: "rgba(26,58,92,0.06)" }}>
            <span className="rounded p-1 text-lg" style={{ background: "rgba(26,58,92,0.10)" }}>💡</span>
            <div className="space-y-1 text-left font-normal" style={{ color: "var(--finrpa-text-muted)" }}>
              {t("editor.loopCurrentValueHint")}{" "}
              <code className="text-white">
                &#123;&#123;&nbsp;current_value&nbsp;&#125;&#125;
              </code>
            </div>
          </div>
        )}
        {isInsideConditional && (
          <div className="mt-4 rounded-md border border-dashed p-4 text-center font-normal normal-case tracking-normal" style={{ borderColor: "var(--glass-border)", color: "var(--finrpa-text-secondary)" }}>
            {t("editor.conditionalStartHint")}
          </div>
        )}
      </div>
    </div>
  );
}

export { StartNode };
