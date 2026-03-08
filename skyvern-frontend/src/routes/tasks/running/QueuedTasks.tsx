import { getClient } from "@/api/AxiosClient";
import { TaskApiResponse } from "@/api/types";
import { useQuery } from "@tanstack/react-query";
import { basicLocalTimeFormat, basicTimeFormat } from "@/util/timeFormat";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import { useCredentialGetter } from "@/hooks/useCredentialGetter";
import { useI18n } from "@/i18n/useI18n";

function QueuedTasks() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const credentialGetter = useCredentialGetter();

  const { data: tasks } = useQuery<Array<TaskApiResponse>>({
    queryKey: ["tasks", "queued"],
    queryFn: async () => {
      const client = await getClient(credentialGetter);
      return client
        .get("/tasks", {
          params: {
            task_status: "queued",
            only_standalone_tasks: "true",
          },
        })
        .then((response) => response.data);
    },
    refetchOnMount: "always",
  });

  function handleNavigate(event: React.MouseEvent, id: string) {
    if (event.ctrlKey || event.metaKey) {
      window.open(
        window.location.origin + `/tasks/${id}/actions`,
        "_blank",
        "noopener,noreferrer",
      );
    } else {
      navigate(`${id}/actions`);
    }
  }

  return (
    <div className="border" style={{ borderRadius: "var(--radius-lg)", boxShadow: "var(--glass-shadow)", borderColor: "var(--glass-border)", overflow: "hidden" }}>
      <Table>
        <TableHeader style={{ background: "rgba(26,58,92,0.06)" }}>
          <TableRow>
            <TableHead className="w-1/4" style={{ color: "var(--finrpa-text-muted)" }}>{t("tasks.tableId")}</TableHead>
            <TableHead className="w-1/4" style={{ color: "var(--finrpa-text-muted)" }}>{t("tasks.url")}</TableHead>
            <TableHead className="w-1/4" style={{ color: "var(--finrpa-text-muted)" }}>{t("tasks.status")}</TableHead>
            <TableHead className="w-1/4" style={{ color: "var(--finrpa-text-muted)" }}>{t("tasks.createdAt")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4}>{t("tasks.noQueuedTasks")}</TableCell>
            </TableRow>
          ) : (
            tasks?.map((task) => {
              return (
                <TableRow
                  key={task.task_id}
                  className="w-4"
                  onClick={(event) => handleNavigate(event, task.task_id)}
                >
                  <TableCell className="w-1/4">{task.task_id}</TableCell>
                  <TableCell className="w-1/4 max-w-64 overflow-hidden overflow-ellipsis whitespace-nowrap">
                    {task.request.url}
                  </TableCell>
                  <TableCell className="w-1/4">
                    <StatusBadge status={task.status} />
                  </TableCell>
                  <TableCell
                    className="w-1/4"
                    title={basicTimeFormat(task.created_at)}
                  >
                    {basicLocalTimeFormat(task.created_at)}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export { QueuedTasks };
