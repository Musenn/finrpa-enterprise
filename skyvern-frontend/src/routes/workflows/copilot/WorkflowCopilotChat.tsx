import { useState, useEffect, useLayoutEffect, useRef, memo } from "react";
import { getClient } from "@/api/AxiosClient";
import { useCredentialGetter } from "@/hooks/useCredentialGetter";
import { useParams } from "react-router-dom";
import { ReloadIcon, Cross2Icon } from "@radix-ui/react-icons";
import { stringify as convertToYAML } from "yaml";
import { useWorkflowHasChangesStore } from "@/store/WorkflowHasChangesStore";
import { WorkflowCreateYAMLRequest } from "@/routes/workflows/types/workflowYamlTypes";
import { WorkflowApiResponse } from "@/routes/workflows/types/workflowTypes";
import { toast } from "@/components/ui/use-toast";
import { getSseClient } from "@/api/sse";
import { useI18n } from "@/i18n/useI18n";
import {
  WorkflowCopilotChatHistoryResponse,
  WorkflowCopilotProcessingUpdate,
  WorkflowCopilotStreamErrorUpdate,
  WorkflowCopilotStreamResponseUpdate,
  WorkflowCopilotChatSender,
  WorkflowCopilotChatRequest,
  WorkflowCopilotClearProposedWorkflowRequest,
} from "./workflowCopilotTypes";

interface ChatMessage {
  id: string;
  sender: WorkflowCopilotChatSender;
  content: string;
  timestamp?: string;
}

type WorkflowCopilotSsePayload =
  | WorkflowCopilotProcessingUpdate
  | WorkflowCopilotStreamResponseUpdate
  | WorkflowCopilotStreamErrorUpdate;

const formatChatTimestamp = (value: string) => {
  let normalizedValue = value.replace(/\.(\d{3})\d*/, ".$1");
  if (!normalizedValue.endsWith("Z")) {
    normalizedValue += "Z";
  }
  return new Date(normalizedValue).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

interface MessageItemProps {
  message: ChatMessage;
  footer?: React.ReactNode;
}

const MessageItem = memo(({ message, footer }: MessageItemProps) => {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${
          message.sender === "ai" ? "bg-blue-600" : "bg-purple-600"
        }`}
      >
        {message.sender === "ai" ? "AI" : "U"}
      </div>
      <div className="relative flex-1 rounded-lg p-3 pr-12" style={{ background: "var(--glass-bg)" }}>
        <p className="whitespace-pre-wrap pr-3 text-sm text-foreground">
          {message.content}
        </p>
        {footer ? <div className="mt-3 flex gap-2">{footer}</div> : null}
        {message.timestamp ? (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground" style={{ background: "rgba(26,58,92,0.06)" }}>
            {formatChatTimestamp(message.timestamp)}
          </span>
        ) : null}
      </div>
    </div>
  );
});

interface WorkflowCopilotChatProps {
  onWorkflowUpdate?: (workflow: WorkflowApiResponse) => void;
  onReviewWorkflow?: (
    workflow: WorkflowApiResponse,
    clearPending: () => void,
  ) => void;
  isOpen?: boolean;
  onClose?: () => void;
  onMessageCountChange?: (count: number) => void;
  buttonRef?: React.RefObject<HTMLButtonElement>;
}

const DEFAULT_WINDOW_WIDTH = 600;
const DEFAULT_WINDOW_HEIGHT = 400;
const MIN_WINDOW_WIDTH = 300;
const MIN_WINDOW_HEIGHT = 300;
const OFFSET = 24;

const calculateDefaultPosition = (
  width: number,
  height: number,
  buttonRef?: React.RefObject<HTMLButtonElement>,
) => {
  // If button ref is available, align left edge of window with left edge of button
  if (buttonRef?.current) {
    const buttonRect = buttonRef.current.getBoundingClientRect();
    return {
      x: buttonRect.left - OFFSET,
      y: window.innerHeight - height - 2 * OFFSET,
    };
  }

  // Fallback to centered position
  return {
    x: window.innerWidth / 2 - width / 2,
    y: window.innerHeight - height - 2 * OFFSET,
  };
};

const constrainPosition = (
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const maxX = window.innerWidth - width - OFFSET;
  const maxY = window.innerHeight - height - OFFSET;

  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  };
};

export function WorkflowCopilotChat({
  onWorkflowUpdate,
  onReviewWorkflow,
  isOpen = true,
  onClose,
  onMessageCountChange,
  buttonRef,
}: WorkflowCopilotChatProps = {}) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [proposedWorkflow, setProposedWorkflow] =
    useState<WorkflowApiResponse | null>(null);
  const [autoAccept, setAutoAccept] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const streamingAbortController = useRef<AbortController | null>(null);
  const pendingMessageId = useRef<string | null>(null);
  const [workflowCopilotChatId, setWorkflowCopilotChatId] = useState<
    string | null
  >(null);
  const [size, setSize] = useState({
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
  });
  const [position, setPosition] = useState(
    calculateDefaultPosition(
      DEFAULT_WINDOW_WIDTH,
      DEFAULT_WINDOW_HEIGHT,
      buttonRef,
    ),
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<
    "n" | "s" | "e" | "w" | "se" | "sw" | "ne" | "nw"
  >("se");
  const [resizeStart, setResizeStart] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    posX: 0,
    posY: 0,
  });
  const credentialGetter = useCredentialGetter();
  const { workflowRunId, workflowPermanentId } = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { getSaveData } = useWorkflowHasChangesStore();
  const hasInitializedPosition = useRef(false);
  const hasScrolledOnLoad = useRef(false);

  const scrollToBottom = (behavior: ScrollBehavior) => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue]);

  const handleNewChat = () => {
    setMessages([]);
    setWorkflowCopilotChatId(null);
    setProposedWorkflow(null);
    setAutoAccept(false);
    hasScrolledOnLoad.current = false;
  };

  const applyWorkflowUpdate = (workflow: WorkflowApiResponse): boolean => {
    if (!onWorkflowUpdate) {
      return true;
    }
    try {
      onWorkflowUpdate(workflow);
      return true;
    } catch (updateError) {
      console.error("Failed to update workflow:", updateError);
      toast({
        title: t("workflows.updateFailed"),
        description: t("workflows.failedApplyWorkflowChanges"),
        variant: "destructive",
      });
      return false;
    }
  };

  const handleAcceptWorkflow = (
    workflow: WorkflowApiResponse,
    alwaysAccept: boolean = false,
  ) => {
    if (!applyWorkflowUpdate(workflow)) {
      return;
    }
    setProposedWorkflow(null);
    if (alwaysAccept) {
      setAutoAccept(true);
    }
    void clearProposedWorkflow(alwaysAccept);
  };

  const handleRejectWorkflow = () => {
    setProposedWorkflow(null);
    void clearProposedWorkflow(false);
  };

  const clearProposedWorkflow = async (autoAcceptValue: boolean) => {
    try {
      const client = await getClient(credentialGetter, "sans-api-v1");
      await client.post<WorkflowCopilotClearProposedWorkflowRequest>(
        "/workflow/copilot/clear-proposed-workflow",
        {
          workflow_copilot_chat_id: workflowCopilotChatId ?? "",
          auto_accept: autoAcceptValue,
        } as WorkflowCopilotClearProposedWorkflowRequest,
      );
    } catch (error) {
      console.error("Failed to clear proposed workflow:", error);
      toast({
        title: t("workflows.copilotUpdateFailed"),
        description: autoAcceptValue
          ? t("workflows.autoAcceptNotUpdated")
          : t("workflows.failedClearProposal"),
        variant: "destructive",
      });
    }
  };

  const handleReviewWorkflow = (workflow: WorkflowApiResponse) => {
    onReviewWorkflow?.(workflow, () => setProposedWorkflow(null));
  };

  // Notify parent of message count changes
  useEffect(() => {
    if (onMessageCountChange) {
      onMessageCountChange(messages.length);
    }
  }, [messages.length, onMessageCountChange]);

  useEffect(() => {
    if (!isOpen) {
      hasScrolledOnLoad.current = false;
      return;
    }
    if (isLoadingHistory) {
      return;
    }
    if (!hasScrolledOnLoad.current) {
      scrollToBottom("auto");
      hasScrolledOnLoad.current = true;
      return;
    }
    scrollToBottom("smooth");
  }, [messages, isLoading, isLoadingHistory, isOpen]);

  useEffect(() => {
    if (!workflowPermanentId) {
      setMessages([]);
      setWorkflowCopilotChatId(null);
      setProposedWorkflow(null);
      setAutoAccept(false);
      return;
    }

    let isMounted = true;

    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      hasScrolledOnLoad.current = false;
      try {
        const client = await getClient(credentialGetter, "sans-api-v1");
        const response = await client.get<WorkflowCopilotChatHistoryResponse>(
          "/workflow/copilot/chat-history",
          {
            params: { workflow_permanent_id: workflowPermanentId },
          },
        );

        if (!isMounted) return;

        const historyMessages = response.data.chat_history.map(
          (message, index) => ({
            id: `${index}-${Date.now()}`,
            sender: message.sender,
            content: message.content,
            timestamp: message.created_at,
          }),
        );
        setMessages(historyMessages);
        setWorkflowCopilotChatId(response.data.workflow_copilot_chat_id);
        setProposedWorkflow(response.data.proposed_workflow ?? null);
        setAutoAccept(response.data.auto_accept ?? false);
      } catch (error) {
        console.error("Failed to load chat history:", error);
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    };

    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [credentialGetter, workflowPermanentId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !isOpen || !isLoading) {
        return;
      }
      cancelSend();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLoading, isOpen]);

  const cancelSend = async () => {
    if (!streamingAbortController.current) return;

    if (pendingMessageId.current) {
      const messageId = pendingMessageId.current;
      pendingMessageId.current = null;
      setMessages((prev) => prev.filter((message) => message.id !== messageId));
    }
    setIsLoading(false);
    setProcessingStatus("");
    streamingAbortController.current?.abort();
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    if (!workflowPermanentId) {
      toast({
        title: t("workflows.missingWorkflow"),
        description: t("workflows.workflowIdRequiredToChat"),
        variant: "destructive",
      });
      return;
    }

    const userMessageId = Date.now().toString();
    const userMessage: ChatMessage = {
      id: userMessageId,
      sender: "user",
      content: inputValue,
    };

    pendingMessageId.current = userMessageId;
    setMessages((prev) => [...prev, userMessage]);
    setProposedWorkflow(null);
    const messageContent = inputValue;
    setInputValue("");
    setIsLoading(true);
    setProcessingStatus(t("workflows.copilotStarting"));

    const abortController = new AbortController();
    streamingAbortController.current?.abort();
    streamingAbortController.current = abortController;

    try {
      const saveData = getSaveData();
      const workflowId = saveData?.workflow.workflow_id;
      let workflowYaml = "";

      if (!workflowId) {
        toast({
          title: t("workflows.missingWorkflow"),
          description: t("workflows.workflowIdRequiredToChat"),
          variant: "destructive",
        });
        return;
      }

      if (saveData) {
        const extraHttpHeaders: Record<string, string> = {};
        if (saveData.settings.extraHttpHeaders) {
          try {
            const parsedHeaders = JSON.parse(
              saveData.settings.extraHttpHeaders,
            );
            if (
              parsedHeaders &&
              typeof parsedHeaders === "object" &&
              !Array.isArray(parsedHeaders)
            ) {
              for (const [key, value] of Object.entries(parsedHeaders)) {
                if (key && typeof key === "string") {
                  extraHttpHeaders[key] = String(value);
                }
              }
            }
          } catch (error) {
            console.error("Error parsing extra HTTP headers:", error);
          }
        }

        const scriptCacheKey = saveData.settings.scriptCacheKey ?? "";
        const normalizedKey =
          scriptCacheKey === "" ? "default" : saveData.settings.scriptCacheKey;

        const requestBody: WorkflowCreateYAMLRequest = {
          title: saveData.title,
          description: saveData.workflow.description,
          proxy_location: saveData.settings.proxyLocation,
          webhook_callback_url: saveData.settings.webhookCallbackUrl,
          persist_browser_session: saveData.settings.persistBrowserSession,
          model: saveData.settings.model,
          max_screenshot_scrolls: saveData.settings.maxScreenshotScrolls,
          totp_verification_url: saveData.workflow.totp_verification_url,
          extra_http_headers: extraHttpHeaders,
          run_with:
            saveData.settings.runWith === "code_v2"
              ? "code"
              : saveData.settings.runWith,
          cache_key: normalizedKey,
          ai_fallback: saveData.settings.aiFallback ?? true,
          adaptive_caching: saveData.settings.runWith === "code_v2",
          workflow_definition: {
            version: saveData.workflowDefinitionVersion,
            parameters: saveData.parameters,
            blocks: saveData.blocks,
          },
          is_saved_task: saveData.workflow.is_saved_task,
          status: saveData.workflow.status,
          run_sequentially: saveData.settings.runSequentially,
          sequential_key: saveData.settings.sequentialKey,
        };

        workflowYaml = convertToYAML(requestBody);
      }

      const handleProcessingUpdate = (
        payload: WorkflowCopilotProcessingUpdate,
      ) => {
        if (payload.status) {
          setProcessingStatus(payload.status);
        }

        const pendingId = pendingMessageId.current;
        if (!pendingId || !payload.timestamp) {
          return;
        }

        setMessages((prev) =>
          prev.map((message) =>
            message.id === pendingId
              ? { ...message, timestamp: payload.timestamp }
              : message,
          ),
        );
      };

      const handleResponse = (
        response: WorkflowCopilotStreamResponseUpdate,
      ) => {
        setWorkflowCopilotChatId(response.workflow_copilot_chat_id);

        const aiMessage: ChatMessage = {
          id: Date.now().toString(),
          sender: "ai",
          content: response.message,
          timestamp: response.response_time,
        };

        setMessages((prev) => [...prev, aiMessage]);
        if (response.updated_workflow && autoAccept) {
          applyWorkflowUpdate(response.updated_workflow);
        } else {
          setProposedWorkflow(response.updated_workflow ?? null);
        }
      };

      const handleError = (payload: WorkflowCopilotStreamErrorUpdate) => {
        const errorMessage: ChatMessage = {
          id: Date.now().toString(),
          sender: "ai",
          content: payload.error,
        };
        setMessages((prev) => [...prev, errorMessage]);
      };

      const client = await getSseClient(credentialGetter);
      await client.postStreaming<WorkflowCopilotSsePayload>(
        "/workflow/copilot/chat-post",
        {
          workflow_id: workflowId,
          workflow_permanent_id: workflowPermanentId,
          workflow_copilot_chat_id: workflowCopilotChatId,
          workflow_run_id: workflowRunId,
          message: messageContent,
          workflow_yaml: workflowYaml,
        } as WorkflowCopilotChatRequest,
        (payload) => {
          switch (payload.type) {
            case "processing_update":
              handleProcessingUpdate(payload);
              return false;
            case "response":
              handleResponse(payload);
              return true;
            case "error":
              handleError(payload);
              return true;
            default:
              return false;
          }
        },
        { signal: abortController.signal },
      );
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }
      console.error("Failed to send message:", error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        sender: "ai",
        content: t("workflows.copilotError"),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      if (streamingAbortController.current === abortController) {
        streamingAbortController.current = null;
      }
      pendingMessageId.current = null;
      setIsLoading(false);
      setProcessingStatus("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleResizeMouseDown = (
    e: React.MouseEvent,
    direction: "n" | "s" | "e" | "w" | "se" | "sw" | "ne" | "nw",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
      if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;

        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;
        let newX = resizeStart.posX;
        let newY = resizeStart.posY;

        // Corners
        if (resizeDirection === "se") {
          // Southeast: resize from bottom-right
          newWidth = Math.max(MIN_WINDOW_WIDTH, resizeStart.width + deltaX);
          newHeight = Math.max(MIN_WINDOW_HEIGHT, resizeStart.height + deltaY);
        } else if (resizeDirection === "sw") {
          // Southwest: resize from bottom-left
          newWidth = Math.max(MIN_WINDOW_WIDTH, resizeStart.width - deltaX);
          newHeight = Math.max(MIN_WINDOW_HEIGHT, resizeStart.height + deltaY);
          if (resizeStart.width - deltaX >= MIN_WINDOW_WIDTH) {
            newX = resizeStart.posX + deltaX;
          }
        } else if (resizeDirection === "ne") {
          // Northeast: resize from top-right
          newWidth = Math.max(MIN_WINDOW_WIDTH, resizeStart.width + deltaX);
          newHeight = Math.max(MIN_WINDOW_HEIGHT, resizeStart.height - deltaY);
          if (resizeStart.height - deltaY >= MIN_WINDOW_HEIGHT) {
            newY = resizeStart.posY + deltaY;
          }
        } else if (resizeDirection === "nw") {
          // Northwest: resize from top-left
          newWidth = Math.max(MIN_WINDOW_WIDTH, resizeStart.width - deltaX);
          newHeight = Math.max(MIN_WINDOW_HEIGHT, resizeStart.height - deltaY);
          if (resizeStart.width - deltaX >= MIN_WINDOW_WIDTH) {
            newX = resizeStart.posX + deltaX;
          }
          if (resizeStart.height - deltaY >= MIN_WINDOW_HEIGHT) {
            newY = resizeStart.posY + deltaY;
          }
        }
        // Edges
        else if (resizeDirection === "n") {
          // North: resize from top
          newHeight = Math.max(MIN_WINDOW_HEIGHT, resizeStart.height - deltaY);
          if (resizeStart.height - deltaY >= MIN_WINDOW_HEIGHT) {
            newY = resizeStart.posY + deltaY;
          }
        } else if (resizeDirection === "s") {
          // South: resize from bottom
          newHeight = Math.max(MIN_WINDOW_HEIGHT, resizeStart.height + deltaY);
        } else if (resizeDirection === "e") {
          // East: resize from right
          newWidth = Math.max(MIN_WINDOW_WIDTH, resizeStart.width + deltaX);
        } else if (resizeDirection === "w") {
          // West: resize from left
          newWidth = Math.max(MIN_WINDOW_WIDTH, resizeStart.width - deltaX);
          if (resizeStart.width - deltaX >= MIN_WINDOW_WIDTH) {
            newX = resizeStart.posX + deltaX;
          }
        }

        setSize({
          width: newWidth,
          height: newHeight,
        });
        setPosition({
          x: newX,
          y: newY,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart, isResizing, resizeStart, resizeDirection]);

  // Handle window resize to keep chat window within viewport
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) =>
        constrainPosition(prev.x, prev.y, size.width, size.height),
      );
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [size]);

  // Recalculate position when chat opens to align with button (only first time)
  useLayoutEffect(() => {
    if (isOpen && buttonRef?.current && !hasInitializedPosition.current) {
      const newPosition = calculateDefaultPosition(
        size.width,
        size.height,
        buttonRef,
      );
      setPosition(newPosition);
      hasInitializedPosition.current = true;
    }
  }, [isOpen, buttonRef, size.width, size.height]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed z-50 flex flex-col rounded-lg border shadow-2xl"
      style={{
        borderColor: "var(--glass-border)",
        background: "var(--glass-bg)",
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
      }}
    >
      {/* Header */}
      <div
        className="flex cursor-move items-center justify-between border-b px-4 py-2"
        style={{ borderColor: "var(--glass-border)" }}
        onMouseDown={handleMouseDown}
      >
        <h3 className="text-sm font-semibold text-foreground">
          {t("workflows.workflowCopilotBeta")}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleNewChat}
            onMouseDown={(e) => e.stopPropagation()}
            className="rounded border px-2 py-1 text-xs hover:bg-muted" style={{ borderColor: "var(--glass-border)", color: "var(--finrpa-text-secondary)" }}
          >
            {t("workflows.newChat")}
          </button>
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <span className="text-xs text-muted-foreground">{t("workflows.copilotActive")}</span>
          <button
            type="button"
            onClick={() => onClose?.()}
            onMouseDown={(e) => e.stopPropagation()}
            className="ml-2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title={t("common.close")}
          >
            <Cross2Icon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {!isLoadingHistory && messages.length === 0 && !isLoading ? (
            <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--glass-border)", background: "rgba(26,58,92,0.06)", color: "var(--finrpa-text-secondary)" }}>
              <p className="font-semibold text-foreground">{t("workflows.startNewChat")}</p>
              <p className="mt-2 text-muted-foreground">
                {t("workflows.copilotInstructions")}
              </p>
              <p className="mt-2 text-muted-foreground">
                {t("workflows.copilotExample")}
              </p>
            </div>
          ) : null}
          {messages.map((message, index) => {
            const isLastMessage = index === messages.length - 1;
            const showProposedPanel = isLastMessage && proposedWorkflow;
            return (
              <MessageItem
                key={message.id}
                message={message}
                footer={
                  showProposedPanel ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleReviewWorkflow(proposedWorkflow)}
                        className="rounded border border-blue-500/60 bg-blue-500/10 px-3 py-1 text-xs text-blue-100 hover:bg-blue-500/20"
                      >
                        {t("workflows.review")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAcceptWorkflow(proposedWorkflow)}
                        className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
                      >
                        {t("workflows.accept")}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleAcceptWorkflow(proposedWorkflow, true)
                        }
                        className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700"
                      >
                        {t("workflows.alwaysAccept")}
                      </button>
                      <button
                        type="button"
                        onClick={handleRejectWorkflow}
                        className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
                      >
                        {t("workflows.reject")}
                      </button>
                    </>
                  ) : null
                }
              />
            );
          })}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                AI
              </div>
              <div className="flex-1 rounded-lg p-3" style={{ background: "var(--glass-bg)" }}>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ReloadIcon className="h-4 w-4 animate-spin" />
                  <span>{processingStatus || t("workflows.copilotProcessing")}</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t p-3" style={{ borderColor: "var(--glass-border)" }}>
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            placeholder={t("workflows.copilotPlaceholder")}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none rounded-md border px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderColor: "var(--glass-border)",
              background: "var(--glass-bg)",
              minHeight: "38px",
              maxHeight: "150px",
              overflow: "auto",
            }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("workflows.send")}
          </button>
        </div>
      </div>

      {/* Resize Handles */}
      {/* Corners */}
      <div
        className="absolute bottom-0 right-0 z-10 h-3 w-3 cursor-nwse-resize"
        onMouseDown={(e) => handleResizeMouseDown(e, "se")}
        title="Resize"
      />
      <div
        className="absolute bottom-0 left-0 z-10 h-3 w-3 cursor-nesw-resize"
        onMouseDown={(e) => handleResizeMouseDown(e, "sw")}
        title="Resize"
      />
      <div
        className="absolute right-0 top-0 z-10 h-3 w-3 cursor-nesw-resize"
        onMouseDown={(e) => handleResizeMouseDown(e, "ne")}
        title="Resize"
      />
      <div
        className="absolute left-0 top-0 z-10 h-3 w-3 cursor-nwse-resize"
        onMouseDown={(e) => handleResizeMouseDown(e, "nw")}
        title="Resize"
      />
      {/* Edges */}
      <div
        className="absolute left-3 right-3 top-0 z-10 h-1 cursor-ns-resize"
        onMouseDown={(e) => handleResizeMouseDown(e, "n")}
        title="Resize"
      />
      <div
        className="absolute bottom-0 left-3 right-3 z-10 h-1 cursor-ns-resize"
        onMouseDown={(e) => handleResizeMouseDown(e, "s")}
        title="Resize"
      />
      <div
        className="absolute bottom-3 left-0 top-3 z-10 w-1 cursor-ew-resize"
        onMouseDown={(e) => handleResizeMouseDown(e, "w")}
        title="Resize"
      />
      <div
        className="absolute bottom-3 right-0 top-3 z-10 w-1 cursor-ew-resize"
        onMouseDown={(e) => handleResizeMouseDown(e, "e")}
        title="Resize"
      />
    </div>
  );
}
