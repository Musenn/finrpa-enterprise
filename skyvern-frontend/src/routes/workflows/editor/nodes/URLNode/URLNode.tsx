import { useEffect } from "react";
import { Flippable } from "@/components/Flippable";
import { Handle, NodeProps, Position } from "@xyflow/react";
import type { URLNode } from "./types";
import { useIsFirstBlockInWorkflow } from "../../hooks/useIsFirstNodeInWorkflow";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { WorkflowBlockInputTextarea } from "@/components/WorkflowBlockInputTextarea";
import { BlockCodeEditor } from "@/routes/workflows/components/BlockCodeEditor";
import { placeholders } from "../../helpContent";
import { useBlockScriptStore } from "@/store/BlockScriptStore";
import { cn } from "@/util/utils";
import { NodeHeader } from "../components/NodeHeader";
import { useParams } from "react-router-dom";
import { statusIsRunningOrQueued } from "@/routes/tasks/types";
import { useWorkflowRunQuery } from "@/routes/workflows/hooks/useWorkflowRunQuery";
import { useI18n } from "@/i18n/useI18n";
import { useUpdate } from "@/routes/workflows/editor/useUpdate";

function URLNode({ id, data, type }: NodeProps<URLNode>) {
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
  const isFirstWorkflowBlock = useIsFirstBlockInWorkflow({ id });
  const update = useUpdate<URLNode["data"]>({ id, editable });

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
            totpIdentifier={null}
            totpUrl={null}
            type="goto_url"
          />
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.url")}</Label>
                {isFirstWorkflowBlock ? (
                  <div className="flex justify-end text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                    Tip: Use the {"+"} button to add parameters!
                  </div>
                ) : null}
              </div>
              <WorkflowBlockInputTextarea
                nodeId={id}
                onChange={(value) => {
                  update({ url: value });
                }}
                value={data.url}
                placeholder={placeholders[type]["url"]}
                className="nopan text-xs"
              />
            </div>
          </div>
        </div>
      </div>
      <BlockCodeEditor
        blockLabel={label}
        blockType="goto_url" // sic: the naming is inconsistent
        script={script}
      />
    </Flippable>
  );
}

export { URLNode };
