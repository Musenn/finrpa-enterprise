import { DotsHorizontalIcon } from "@radix-ui/react-icons";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRecordingStore } from "@/store/useRecordingStore";
import { useI18n } from "@/i18n/useI18n";

type Props = {
  isDeletable?: boolean;
  isScriptable?: boolean;
  showScriptText?: string;
  onDelete?: () => void;
  onShowScript?: () => void;
};

function NodeActionMenu({
  isDeletable = true,
  isScriptable = false,
  showScriptText,
  onDelete,
  onShowScript,
}: Props) {
  const { t } = useI18n();
  const recordingStore = useRecordingStore();
  const isRecording = recordingStore.isRecording;

  if (!isDeletable && !isScriptable) {
    return null;
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <DotsHorizontalIcon className="h-6 w-6 cursor-pointer" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{t("editor.blockActions")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isDeletable && (
          <DropdownMenuItem
            disabled={isRecording}
            onSelect={() => {
              onDelete?.();
            }}
          >
            {t("editor.deleteBlock")}
          </DropdownMenuItem>
        )}
        {isScriptable && onShowScript && (
          <DropdownMenuItem
            onSelect={() => {
              onShowScript();
            }}
          >
            {showScriptText ?? t("editor.showCode")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { NodeActionMenu };
