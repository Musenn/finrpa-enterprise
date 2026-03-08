import { Pencil1Icon } from "@radix-ui/react-icons";
import { FolderIcon } from "@/components/icons/FolderIcon";
import { cn } from "@/util/utils";
import type { Folder } from "../types/folderTypes";
import { DeleteFolderButton } from "./DeleteFolderButton";
import { EditFolderDialog } from "./EditFolderDialog";
import { useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FolderCardProps {
  folder: Folder;
  isSelected: boolean;
  onClick: () => void;
}

function FolderCard({ folder, isSelected, onClick }: FolderCardProps) {
  const { t } = useI18n();
  const [isHovered, setIsHovered] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  return (
    <>
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "relative flex h-24 flex-col gap-3 border p-4 text-left transition-colors hover:border-blue-400",
          isSelected
            ? "border-blue-400 bg-blue-50 ring-2 ring-blue-400/20"
            : "bg-slate-elevation1",
        )}
        style={{
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--glass-shadow)",
          borderColor: isSelected ? undefined : "var(--glass-border)",
        }}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <FolderIcon className="h-5 w-5 text-blue-400" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate text-sm font-medium" style={{ color: "var(--finrpa-text-primary)" }}>
                {folder.title}
              </h3>
              <div
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "flex gap-1 transition-opacity",
                  isHovered ? "opacity-100" : "opacity-0",
                )}
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setIsEditDialogOpen(true)}
                        className="rounded p-1.5 transition-colors"
                        style={{ color: "var(--finrpa-text-muted)" }}
                        aria-label="Edit folder"
                      >
                        <Pencil1Icon className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t("workflows.editFolder")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <DeleteFolderButton
                  folderId={folder.folder_id}
                  folderTitle={folder.title}
                />
              </div>
            </div>
            <p className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
              {folder.workflow_count}{" "}
              {folder.workflow_count === 1 ? t("workflows.workflow") : t("workflows.workflowsPlural")}
            </p>
          </div>
        </div>
      </button>
      <EditFolderDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        folder={folder}
      />
    </>
  );
}

export { FolderCard };
