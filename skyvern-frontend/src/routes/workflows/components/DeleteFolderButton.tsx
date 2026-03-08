import { GarbageIcon } from "@/components/icons/GarbageIcon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ReloadIcon } from "@radix-ui/react-icons";
import { useEffect, useState } from "react";
import { useDeleteFolderMutation } from "../hooks/useFolderMutations";
import { useI18n } from "@/i18n/useI18n";

type Props = {
  folderId: string;
  folderTitle: string;
};

function DeleteFolderButton({ folderId, folderTitle }: Props) {
  const { t } = useI18n();
  const [deleteOption, setDeleteOption] = useState<
    "folder_only" | "folder_and_workflows"
  >("folder_only");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const {
    mutate: deleteFolder,
    isPending: isDeleteFolderPending,
    isSuccess: isDeleteFolderSuccess,
  } = useDeleteFolderMutation();

  // Close dialog when deletion succeeds
  useEffect(() => {
    if (isDeleteFolderSuccess) setIsDialogOpen(false);
  }, [isDeleteFolderSuccess]);

  const handleDelete = () => {
    const deleteWorkflows = deleteOption === "folder_and_workflows";
    deleteFolder({ folderId, folderTitle, deleteWorkflows });
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="rounded p-1.5 text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300"
                aria-label="Delete folder"
              >
                <GarbageIcon className="h-4 w-4" />
              </button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>{t("workflows.deleteFolder")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t("workflows.deleteFolderTitle")}: {folderTitle}</DialogTitle>
          <DialogDescription>
            {t("workflows.deleteFolderDesc")}
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={deleteOption}
          onValueChange={(value) =>
            setDeleteOption(value as typeof deleteOption)
          }
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="folder_only" id="folder_only" />
            <Label htmlFor="folder_only" className="font-normal">
              {t("workflows.deleteFolderOnly")}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value="folder_and_workflows"
              id="folder_and_workflows"
            />
            <Label htmlFor="folder_and_workflows" className="font-normal">
              {t("workflows.deleteFolderAndWorkflows")}
            </Label>
          </div>
        </RadioGroup>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">{t("common.cancel")}</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleteFolderPending}
          >
            {isDeleteFolderPending && (
              <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { DeleteFolderButton };
