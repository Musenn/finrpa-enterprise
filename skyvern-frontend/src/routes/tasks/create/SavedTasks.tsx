import { getClient } from "@/api/AxiosClient";
import { queryClient } from "@/api/QueryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { useCredentialGetter } from "@/hooks/useCredentialGetter";
import { PlusIcon, ReloadIcon } from "@radix-ui/react-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { stringify as convertToYAML } from "yaml";
import { SavedTaskCard } from "./SavedTaskCard";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TaskBlock,
  WorkflowApiResponse,
} from "@/routes/workflows/types/workflowTypes";
import { useI18n } from "@/i18n/useI18n";

function createEmptyTaskTemplate(newTemplateLabel: string) {
  return {
    title: newTemplateLabel,
    description: "",
    is_saved_task: true,
    webhook_callback_url: null,
    proxy_location: "RESIDENTIAL",
    workflow_definition: {
      version: 2,
      parameters: [
        {
          parameter_type: "workflow",
          workflow_parameter_type: "json",
          key: "navigation_payload",
          default_value: "null",
        },
      ],
      blocks: [
        {
          block_type: "task",
          label: newTemplateLabel,
          url: "https://example.com",
          navigation_goal: "",
          data_extraction_goal: null,
          data_schema: null,
        },
      ],
    },
  };
}

function SavedTasks() {
  const { t } = useI18n();
  const credentialGetter = useCredentialGetter();
  const navigate = useNavigate();
  const [hovering, setHovering] = useState(false);

  const { data, isLoading: savedTasksIsLoading } = useQuery<
    Array<WorkflowApiResponse>
  >({
    queryKey: ["savedTasks"],
    queryFn: async () => {
      const client = await getClient(credentialGetter);
      return client
        .get("/workflows?only_saved_tasks=true")
        .then((response) => response.data);
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const request = createEmptyTaskTemplate(t("tasks.newTemplate"));
      const client = await getClient(credentialGetter);
      const yaml = convertToYAML(request);
      return client
        .post<string, { data: { workflow_permanent_id: string } }>(
          "/workflows",
          yaml,
          {
            headers: {
              "Content-Type": "text/plain",
            },
          },
        )
        .then((response) => response.data);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: t("tasks.errorSaving"),
        description: error.message,
      });
    },
    onSuccess: (response) => {
      toast({
        variant: "success",
        title: t("tasks.newTemplateCreated"),
        description: t("tasks.templateCreatedSuccessfully"),
      });
      queryClient.invalidateQueries({
        queryKey: ["savedTasks"],
      });
      navigate(`/tasks/create/${response.workflow_permanent_id}`);
    },
  });

  return (
    <div className="grid grid-cols-4 gap-4">
      <Card
        className="border-0"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onMouseOver={() => setHovering(true)}
        onMouseOut={() => setHovering(false)}
      >
        <CardHeader
          className="rounded-t-md"
          style={{ background: hovering ? "rgba(26,58,92,0.10)" : "var(--glass-bg)" }}
        >
          <CardTitle className="font-normal">{t("tasks.createNew")}</CardTitle>
          <CardDescription>{"https://.."}</CardDescription>
        </CardHeader>
        <CardContent
          className="flex h-36 cursor-pointer items-center justify-center rounded-b-md p-4 text-sm"
          style={{
            color: "var(--finrpa-text-secondary)",
            background: hovering ? "rgba(26,58,92,0.10)" : "var(--glass-bg)",
          }}
          onClick={() => {
            if (mutation.isPending) {
              return;
            }
            mutation.mutate();
          }}
        >
          {!mutation.isPending && <PlusIcon className="h-12 w-12" />}
          {mutation.isPending && (
            <ReloadIcon className="h-12 w-12 animate-spin" />
          )}
        </CardContent>
      </Card>
      {savedTasksIsLoading && (
        <>
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </>
      )}
      {data?.map((workflow) => {
        const firstBlock = workflow.workflow_definition.blocks[0];
        if (!firstBlock || firstBlock.block_type !== "task") {
          return null; // saved tasks have only one block and it's a task
        }
        const task = firstBlock as TaskBlock;
        return (
          <SavedTaskCard
            key={workflow.workflow_permanent_id}
            workflowId={workflow.workflow_permanent_id}
            title={workflow.title}
            description={workflow.description}
            url={task.url ?? ""}
          />
        );
      })}
    </div>
  );
}

export { SavedTasks };
