import { getClient } from "@/api/AxiosClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import { useCredentialGetter } from "@/hooks/useCredentialGetter";
import { DotsHorizontalIcon, ReloadIcon } from "@radix-ui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n/useI18n";

type Props = {
  workflowId: string;
  title: string;
  description: string;
  url: string;
};

function SavedTaskCard({ workflowId, title, url, description }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const credentialGetter = useCredentialGetter();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [hovering, setHovering] = useState(false);

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const client = await getClient(credentialGetter);
      return client
        .delete(`/workflows/${id}`)
        .then((response) => response.data);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: t("tasks.errorDeletingTemplate"),
        description: error.message,
      });
      setOpen(false);
    },
    onSuccess: () => {
      toast({
        title: t("tasks.templateDeleted"),
        description: t("tasks.templateDeletedSuccessfully"),
      });
      queryClient.invalidateQueries({
        queryKey: ["savedTasks"],
      });
      setOpen(false);
      navigate("/create");
    },
  });

  return (
    <Card
      className="overflow-hidden border-0"
      style={{
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--glass-shadow)",
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onMouseOver={() => setHovering(true)}
      onMouseOut={() => setHovering(false)}
    >
      <CardHeader
        className="rounded-t-md"
        style={{ background: hovering ? "rgba(26,58,92,0.10)" : "var(--glass-bg)" }}
      >
        <CardTitle className="flex items-center justify-between font-normal">
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            {title}
          </span>
          <Dialog
            open={open}
            onOpenChange={() => {
              setOpen(false);
            }}
          >
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <DotsHorizontalIcon className="cursor-pointer" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>{t("tasks.templateActions")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    setOpen(true);
                  }}
                >
                  {t("tasks.deleteTemplate")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("common.areYouSure")}</DialogTitle>
                <DialogDescription>
                  {t("tasks.confirmDeleteTemplate")}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setOpen(false);
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    deleteTaskMutation.mutate(workflowId);
                  }}
                  disabled={deleteTaskMutation.isPending}
                >
                  {deleteTaskMutation.isPending && (
                    <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("common.delete")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardTitle>
        <CardDescription className="overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: "var(--finrpa-text-muted)" }}>
          {url}
        </CardDescription>
      </CardHeader>
      <CardContent
        className="h-36 cursor-pointer overflow-scroll rounded-b-md p-4 text-sm"
        style={{
          color: "var(--finrpa-text-secondary)",
          background: hovering ? "rgba(26,58,92,0.10)" : "var(--glass-bg)",
        }}
        onClick={() => {
          navigate(`/tasks/create/${workflowId}`);
        }}
      >
        {description}
      </CardContent>
    </Card>
  );
}

export { SavedTaskCard };
