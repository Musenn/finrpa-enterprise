import { Status } from "@/api/types";
import { useWorkflowRunWithWorkflowQuery } from "../hooks/useWorkflowRunWithWorkflowQuery";
import { ZoomableImage } from "@/components/ZoomableImage";
import { useEffect, useState } from "react";
import { statusIsNotFinalized } from "@/routes/tasks/types";
import { useCredentialGetter } from "@/hooks/useCredentialGetter";
import { useFirstParam } from "@/hooks/useFirstParam";
import { getRuntimeApiKey } from "@/util/env";
import { toast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/i18n/useI18n";

type StreamMessage = {
  task_id: string;
  status: string;
  screenshot?: string;
};

interface Props {
  alwaysShowStream?: boolean;
}

let socket: WebSocket | null = null;

const wssBaseUrl = import.meta.env.VITE_WSS_BASE_URL;

function WorkflowRunStream(props?: Props) {
  const { t } = useI18n();
  const alwaysShowStream = props?.alwaysShowStream ?? false;
  const workflowRunId = useFirstParam("workflowRunId", "runId");
  const { data: workflowRun } = useWorkflowRunWithWorkflowQuery();
  const [streamImgSrc, setStreamImgSrc] = useState<string>("");
  const showStream =
    alwaysShowStream || (workflowRun && statusIsNotFinalized(workflowRun));
  const credentialGetter = useCredentialGetter();
  const workflow = workflowRun?.workflow;
  const workflowPermanentId = workflow?.workflow_permanent_id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!showStream) {
      return;
    }

    async function run() {
      // Create WebSocket connection.
      let credential = null;
      if (credentialGetter) {
        const token = await credentialGetter();
        credential = `?token=Bearer ${token}`;
      } else {
        const apiKey = getRuntimeApiKey();
        credential = apiKey ? `?apikey=${apiKey}` : "";
      }
      if (socket) {
        socket.close();
      }
      socket = new WebSocket(
        `${wssBaseUrl}/stream/workflow_runs/${workflowRunId}${credential}`,
      );
      // Listen for messages
      socket.addEventListener("message", (event) => {
        try {
          const message: StreamMessage = JSON.parse(event.data);
          if (message.screenshot) {
            setStreamImgSrc(message.screenshot);
          }
          if (
            message.status === "completed" ||
            message.status === "failed" ||
            message.status === "terminated"
          ) {
            socket?.close();
            queryClient.invalidateQueries({
              queryKey: ["workflowRuns"],
            });
            queryClient.invalidateQueries({
              queryKey: ["workflowRun", workflowPermanentId, workflowRunId],
            });
            queryClient.invalidateQueries({
              queryKey: ["workflowRun", workflowRunId],
            });
            queryClient.invalidateQueries({
              queryKey: ["taskWorkflowRun", workflowRunId],
            });
            queryClient.invalidateQueries({
              queryKey: ["workflowTasks", workflowRunId],
            });
            queryClient.invalidateQueries({
              queryKey: ["runs"],
            });
            if (
              message.status === "failed" ||
              message.status === "terminated"
            ) {
              toast({
                title: t("workflows.runFailed"),
                description: t("workflows.runFailedDesc"),
                variant: "destructive",
              });
            } else if (message.status === "completed") {
              toast({
                title: t("workflows.runCompleted"),
                description: t("workflows.runCompletedDesc"),
                variant: "success",
              });
            }
          }
        } catch (e) {
          console.error("Failed to parse message", e);
        }
      });

      socket.addEventListener("close", () => {
        socket = null;
      });
    }
    run();

    return () => {
      if (socket) {
        socket.close();
        socket = null;
      }
    };
  }, [
    credentialGetter,
    workflowRunId,
    showStream,
    queryClient,
    workflowPermanentId,
  ]);

  if (workflowRun?.status === Status.Created) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-8 rounded-md py-8 text-lg" style={{ background: "var(--glass-bg)" }}>
        <span>{t("workflows.streamCreated")}</span>
        <span>{t("workflows.streamWillStart")}</span>
      </div>
    );
  }
  if (workflowRun?.status === Status.Queued) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-8 rounded-md py-8 text-lg" style={{ background: "var(--glass-bg)" }}>
        <span>{t("workflows.streamQueued")}</span>
        <span>{t("workflows.streamWillStart")}</span>
      </div>
    );
  }

  if (workflowRun?.status === Status.Running && streamImgSrc.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-md py-8 text-lg" style={{ background: "var(--glass-bg)" }}>
        {t("workflows.streamStarting")}
      </div>
    );
  }

  if (workflowRun?.status === Status.Running && streamImgSrc.length > 0) {
    return (
      <div className="h-full w-full">
        <ZoomableImage
          src={`data:image/png;base64,${streamImgSrc}`}
          className="rounded-md"
        />
      </div>
    );
  }

  if (alwaysShowStream) {
    if (streamImgSrc?.length > 0) {
      return (
        <div className="h-full w-full">
          <ZoomableImage
            src={`data:image/png;base64,${streamImgSrc}`}
            className="rounded-md"
          />
        </div>
      );
    }

    return (
      <div className="flex h-full w-full items-center justify-center">
        {t("workflows.streamWaiting")}
      </div>
    );
  }

  return null;
}

export { WorkflowRunStream };
