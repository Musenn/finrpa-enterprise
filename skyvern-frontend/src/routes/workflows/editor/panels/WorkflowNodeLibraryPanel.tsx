import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";
import { useWorkflowPanelStore } from "@/store/WorkflowPanelStore";
import { useState, useRef, useEffect } from "react";
import {
  Cross2Icon,
  PlusIcon,
  MagnifyingGlassIcon,
} from "@radix-ui/react-icons";
import { WorkflowBlockTypes } from "../../types/workflowTypes";
import { WorkflowBlockNode } from "../nodes";
import { WorkflowBlockIcon } from "../nodes/WorkflowBlockIcon";
import { AddNodeProps } from "../Workspace";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/locales";

const enableCodeBlock =
  import.meta.env.VITE_ENABLE_CODE_BLOCK?.toLowerCase() === "true";

function getNodeLibraryItems(t: (key: MessageKey) => string): Array<{
  nodeType: NonNullable<WorkflowBlockNode["type"]>;
  icon: JSX.Element;
  title: string;
  description: string;
}> {
  return [
    {
      nodeType: "login",
      icon: (
        <WorkflowBlockIcon
          workflowBlockType={WorkflowBlockTypes.Login}
          className="size-6"
        />
      ),
      title: t("editor.blockLoginTitle"),
      description: t("editor.blockLoginDesc"),
    },
    {
      nodeType: "navigation",
      icon: (
        <WorkflowBlockIcon
          workflowBlockType={WorkflowBlockTypes.Navigation}
          className="size-6"
        />
      ),
      title: t("editor.blockBrowserTaskTitle"),
      description: t("editor.blockBrowserTaskDesc"),
    },
    {
      nodeType: "action",
      icon: (
        <WorkflowBlockIcon
          workflowBlockType={WorkflowBlockTypes.Action}
          className="size-6"
        />
      ),
      title: t("editor.blockBrowserActionTitle"),
      description: t("editor.blockBrowserActionDesc"),
    },
    {
      nodeType: "extraction",
      icon: (
        <WorkflowBlockIcon
          workflowBlockType={WorkflowBlockTypes.Extraction}
          className="size-6"
        />
      ),
      title: t("editor.blockExtractionTitle"),
      description: t("editor.blockExtractionDesc"),
    },
    {
      nodeType: "validation",
      icon: (
        <WorkflowBlockIcon
          workflowBlockType={WorkflowBlockTypes.Validation}
          className="size-6"
        />
      ),
      title: t("editor.blockValidationTitle"),
      description: t("editor.blockValidationDesc"),
    },
    {
      nodeType: "human_interaction",
      icon: (
        <WorkflowBlockIcon
          workflowBlockType={WorkflowBlockTypes.HumanInteraction}
          className="size-6"
        />
      ),
      title: t("editor.blockHumanInteractionTitle"),
      description: t("editor.blockHumanInteractionDesc"),
    },
    {
      nodeType: "url",
      icon: (
        <WorkflowBlockIcon
          workflowBlockType={WorkflowBlockTypes.URL}
          className="size-6"
        />
      ),
      title: t("editor.blockGoToUrlTitle"),
      description: t("editor.blockGoToUrlDesc"),
    },
    {
      nodeType: "textPrompt",
      icon: (
        <WorkflowBlockIcon
          workflowBlockType={WorkflowBlockTypes.TextPrompt}
          className="size-6"
        />
      ),
      title: t("editor.blockTextPromptTitle"),
      description: t("editor.blockTextPromptDesc"),
    },
    {
      nodeType: "conditional",
      icon: (
        <WorkflowBlockIcon
          workflowBlockType={WorkflowBlockTypes.Conditional}
          className="size-6"
        />
      ),
      title: t("editor.blockConditionalTitle"),
      description: t("editor.blockConditionalDesc"),
    },
    {
      nodeType: "sendEmail",
      icon: (
        <WorkflowBlockIcon
          workflowBlockType={WorkflowBlockTypes.SendEmail}
          className="size-6"
        />
      ),
      title: t("editor.blockSendEmailTitle"),
      description: t("editor.blockSendEmailDesc"),
    },
    {
      nodeType: "loop",
      icon: (
        <WorkflowBlockIcon
          workflowBlockType={WorkflowBlockTypes.ForLoop}
          className="size-6"
        />
      ),
      title: t("editor.blockLoopTitle"),
      description: t("editor.blockLoopDesc"),
    },
    {
      nodeType: "codeBlock",
      icon: (
        <WorkflowBlockIcon
          workflowBlockType={WorkflowBlockTypes.Code}
          className="size-6"
        />
      ),
      title: t("editor.blockCodeTitle"),
      description: t("editor.blockCodeDesc"),
    },
    {
      nodeType: "fileParser",
      icon: (
        <WorkflowBlockIcon
          workflowBlockType={WorkflowBlockTypes.FileURLParser}
          className="size-6"
        />
      ),
      title: t("editor.blockFileParserTitle"),
      description: t("editor.blockFileParserDesc"),
    },
    {
      nodeType: "fileUpload",
      icon: (
        <WorkflowBlockIcon
          workflowBlockType={WorkflowBlockTypes.FileUpload}
          className="size-6"
        />
      ),
      title: t("editor.blockCloudStorageTitle"),
      description: t("editor.blockCloudStorageDesc"),
    },
    {
      nodeType: "fileDownload",
      icon: (
        <WorkflowBlockIcon
          workflowBlockType={WorkflowBlockTypes.FileDownload}
          className="size-6"
        />
      ),
      title: t("editor.blockFileDownloadTitle"),
      description: t("editor.blockFileDownloadDesc"),
    },
    {
      nodeType: "wait",
      icon: (
        <WorkflowBlockIcon
          workflowBlockType={WorkflowBlockTypes.Wait}
          className="size-6"
        />
      ),
      title: t("editor.blockWaitTitle"),
      description: t("editor.blockWaitDesc"),
    },
    {
      nodeType: "http_request",
      icon: (
        <WorkflowBlockIcon
          workflowBlockType={WorkflowBlockTypes.HttpRequest}
          className="size-6"
        />
      ),
      title: t("editor.blockHttpRequestTitle"),
      description: t("editor.blockHttpRequestDesc"),
    },
    {
      nodeType: "printPage",
      icon: (
        <WorkflowBlockIcon
          workflowBlockType={WorkflowBlockTypes.PrintPage}
          className="size-6"
        />
      ),
      title: t("editor.blockPrintPageTitle"),
      description: t("editor.blockPrintPageDesc"),
    },
    {
      nodeType: "workflowTrigger",
      icon: (
        <WorkflowBlockIcon
          workflowBlockType={WorkflowBlockTypes.WorkflowTrigger}
          className="size-6"
        />
      ),
      title: t("editor.blockWorkflowTriggerTitle"),
      description: t("editor.blockWorkflowTriggerDesc"),
    },
  ];
}

type Props = {
  onMouseDownCapture?: () => void;
  onNodeClick: (props: AddNodeProps) => void;
  first?: boolean;
};

function WorkflowNodeLibraryPanel({
  onMouseDownCapture,
  onNodeClick,
  first,
}: Props) {
  const { t } = useI18n();
  const workflowPanelData = useWorkflowPanelStore(
    (state) => state.workflowPanelState.data,
  );
  const workflowPanelActive = useWorkflowPanelStore(
    (state) => state.workflowPanelState.active,
  );
  const closeWorkflowPanel = useWorkflowPanelStore(
    (state) => state.closeWorkflowPanel,
  );
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input when the panel becomes active
    if (workflowPanelActive && inputRef.current) {
      // Use multiple approaches to ensure focus works
      const focusInput = () => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select(); // Also select any existing text
        }
      };

      // Try immediate focus
      focusInput();

      // Also try with a small delay for animations/transitions
      const timeoutId = setTimeout(() => {
        focusInput();
      }, 100);

      // And try with a longer delay as backup
      const backupTimeoutId = setTimeout(() => {
        focusInput();
      }, 300);

      return () => {
        clearTimeout(timeoutId);
        clearTimeout(backupTimeoutId);
      };
    }
  }, [workflowPanelActive]);

  const nodeLibraryItems = getNodeLibraryItems(t);
  const filteredItems = nodeLibraryItems.filter((item) => {
    if (workflowPanelData?.disableLoop && item.nodeType === "loop") {
      return false;
    }
    if (!enableCodeBlock && item.nodeType === "codeBlock") {
      return false;
    }

    const term = search.toLowerCase();
    if (!term) {
      return true;
    }

    return (
      item.nodeType.toLowerCase().includes(term) ||
      item.title.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term)
    );
  });

  return (
    <div
      className="h-full w-[25rem] rounded-xl border p-5 shadow-xl"
      style={{ borderColor: "var(--glass-border)", background: "var(--glass-bg)" }}
      onMouseDownCapture={() => onMouseDownCapture?.()}
    >
      <div className="flex h-full flex-col space-y-4">
        <header className="space-y-2">
          <div className="flex justify-between">
            <h1 className="text-lg">{t("editor.blockLibrary")}</h1>
            {!first && (
              <Cross2Icon
                className="size-6 cursor-pointer"
                onClick={() => {
                  closeWorkflowPanel();
                }}
              />
            )}
          </div>
          <span className="text-sm" style={{ color: "var(--finrpa-text-muted)" }}>
            {first
              ? t("editor.blockLibraryFirstDesc")
              : t("editor.blockLibraryDesc")}
          </span>
        </header>
        <div className="relative">
          <div className="absolute left-0 top-0 flex size-9 items-center justify-center">
            <MagnifyingGlassIcon className="size-5" />
          </div>
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder={t("editor.searchBlocks")}
            className="pl-9"
            ref={inputRef}
            autoFocus
            tabIndex={0}
          />
        </div>
        <ScrollArea className="h-full flex-1">
          <ScrollAreaViewport className="h-full">
            <div className="space-y-2">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const itemContent = (
                    <div
                      key={item.nodeType}
                      className={`flex items-center justify-between rounded-sm bg-slate-elevation4 p-4 ${"cursor-pointer hover:bg-slate-elevation5"}`}
                      onClick={() => {
                        onNodeClick({
                          nodeType: item.nodeType,
                          next: workflowPanelData?.next ?? null,
                          parent: workflowPanelData?.parent,
                          previous: workflowPanelData?.previous ?? null,
                          connectingEdgeType:
                            workflowPanelData?.connectingEdgeType ??
                            "edgeWithAddButton",
                          branch: workflowPanelData?.branchContext,
                        });
                        closeWorkflowPanel();
                      }}
                    >
                      <div className="flex gap-2">
                        <div className="flex h-[2.75rem] w-[2.75rem] shrink-0 items-center justify-center rounded border" style={{ borderColor: "var(--glass-border)" }}>
                          {item.icon}
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="max-w-64 truncate text-base">
                            {item.title}
                          </span>
                          <span className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                            {item.description}
                          </span>
                        </div>
                      </div>
                      <PlusIcon className="size-6 shrink-0" />
                    </div>
                  );

                  return itemContent;
                })
              ) : (
                <div className="p-4 text-center text-sm" style={{ color: "var(--finrpa-text-muted)" }}>
                  {t("editor.noResultsFound")}
                </div>
              )}
            </div>
          </ScrollAreaViewport>
        </ScrollArea>
      </div>
    </div>
  );
}

export { WorkflowNodeLibraryPanel };
