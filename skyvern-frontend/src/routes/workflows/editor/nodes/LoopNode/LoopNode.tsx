import { useEffect, useRef } from "react";
import { HelpTooltip } from "@/components/HelpTooltip";
import { Label } from "@/components/ui/label";
import { WorkflowBlockInput } from "@/components/WorkflowBlockInput";
import { WorkflowDataSchemaInputGroup } from "@/components/DataSchemaInputGroup/WorkflowDataSchemaInputGroup";
import type { Node } from "@xyflow/react";
import {
  Handle,
  NodeProps,
  Position,
  useNodes,
  useReactFlow,
} from "@xyflow/react";
import { AppNode } from "..";
import { helpTooltips } from "../../helpContent";
import { dataSchemaExampleValue } from "../types";
import type { LoopNode } from "./types";
import { useIsFirstBlockInWorkflow } from "../../hooks/useIsFirstNodeInWorkflow";
import { Checkbox } from "@/components/ui/checkbox";
import { getLoopNodeWidth } from "../../workflowEditorUtils";
import { cn } from "@/util/utils";
import { NodeHeader } from "../components/NodeHeader";
import { useParams } from "react-router-dom";
import { statusIsRunningOrQueued } from "@/routes/tasks/types";
import { useWorkflowRunQuery } from "@/routes/workflows/hooks/useWorkflowRunQuery";
import { useUpdate } from "@/routes/workflows/editor/useUpdate";
import { useRecordingStore } from "@/store/useRecordingStore";
import { useI18n } from "@/i18n/useI18n";

function LoopNode({ id, data }: NodeProps<LoopNode>) {
  const { t } = useI18n();
  const nodes = useNodes<AppNode>();
  const node = nodes.find((n) => n.id === id);
  if (!node) {
    throw new Error("Node not found"); // not possible
  }
  const { editable, label } = data;
  const { blockLabel: urlBlockLabel } = useParams();
  const { data: workflowRun } = useWorkflowRunQuery();
  const workflowRunIsRunningOrQueued =
    workflowRun && statusIsRunningOrQueued(workflowRun);
  const thisBlockIsTargetted =
    urlBlockLabel !== undefined && urlBlockLabel === label;
  const thisBlockIsPlaying =
    workflowRunIsRunningOrQueued && thisBlockIsTargetted;
  const update = useUpdate<LoopNode["data"]>({ id, editable });
  const isFirstWorkflowBlock = useIsFirstBlockInWorkflow({ id });
  const children = nodes.filter((node) => node.parentId === id);
  const recordingStore = useRecordingStore();
  const headerRef = useRef<HTMLDivElement>(null);
  const { updateNodeData } = useReactFlow();
  const lastHeaderHeight = useRef<number | undefined>(undefined);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      // Use offsetHeight to include padding (py-4 = 32px) in the measurement
      const height = Math.round(el.offsetHeight);
      if (lastHeaderHeight.current !== height) {
        lastHeaderHeight.current = height;
        updateNodeData(id, { _headerHeight: height });
        // Trigger re-layout after React processes the data update
        window.dispatchEvent(new Event("loop-header-resized"));
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [id, updateNodeData]);

  const furthestDownChild: Node | null = children.reduce(
    (acc, child) => {
      if (!acc) {
        return child;
      }
      if (child.position.y > acc.position.y) {
        return child;
      }
      return acc;
    },
    null as Node | null,
  );

  const childrenHeightExtent =
    (furthestDownChild?.measured?.height ?? 0) +
    (furthestDownChild?.position.y ?? 0) +
    24;

  const loopNodeWidth = getLoopNodeWidth(node, nodes);

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
        className="rounded-xl border-2 border-dashed p-2"
        style={{
          borderColor: "var(--glass-border)",
          width: loopNodeWidth,
          height: childrenHeightExtent,
        }}
      >
        <div className="flex w-full justify-center">
          <div
            ref={headerRef}
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
              type="for_loop" // sic: the naming is not consistent
            />
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="flex gap-2">
                  <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("editor.loopValue")}</Label>
                  <HelpTooltip content={helpTooltips["loop"]["loopValue"]} />
                </div>
                {isFirstWorkflowBlock ? (
                  <div className="flex justify-end text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                    {t("editor.tipAddParameters")}
                  </div>
                ) : null}
              </div>
              <WorkflowBlockInput
                nodeId={id}
                value={data.loopVariableReference}
                onChange={(value) => {
                  update({ loopVariableReference: value });
                }}
              />
            </div>
            <WorkflowDataSchemaInputGroup
              value={data.dataSchema}
              onChange={(value) => {
                update({ dataSchema: value });
              }}
              suggestionContext={{
                loop_variable_reference: data.loopVariableReference,
              }}
              exampleValue={dataSchemaExampleValue}
              helpTooltip={t("editor.dataSchemaHelpTooltip")}
            />
            <div className="space-y-2">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={data.completeIfEmpty}
                      disabled={!data.editable}
                      onCheckedChange={(checked) => {
                        update({
                          completeIfEmpty:
                            checked === "indeterminate" ? false : checked,
                        });
                      }}
                    />
                    <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>
                      {t("editor.continueIfEmpty")}
                    </Label>
                    <HelpTooltip content={t("editor.continueIfEmptyHelp")} />
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={data.continueOnFailure}
                      disabled={!data.editable}
                      onCheckedChange={(checked) => {
                        update({
                          continueOnFailure:
                            checked === "indeterminate" ? false : checked,
                        });
                      }}
                    />
                    <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>
                      {t("editor.continueOnFailure")}
                    </Label>
                    <HelpTooltip content={t("editor.continueOnFailureHelp")} />
                  </div>
                </div>
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={data.nextLoopOnFailure ?? false}
                      disabled={!data.editable}
                      onCheckedChange={(checked) => {
                        update({
                          nextLoopOnFailure:
                            checked === "indeterminate" ? false : checked,
                        });
                      }}
                    />
                    <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>
                      {t("editor.nextLoopOnFailure")}
                    </Label>
                    <HelpTooltip
                      content={helpTooltips["loop"]["nextLoopOnFailure"]}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { LoopNode };
