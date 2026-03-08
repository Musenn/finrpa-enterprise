import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { PlusIcon } from "@radix-ui/react-icons";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/useI18n";

type Props = {
  onAdd: (headers: Record<string, string>) => void;
  children: React.ReactNode;
};

const commonHeaders = [
  {
    name: "Content-Type",
    value: "application/json",
    descriptionKey: "editor.headerDescJsonContent" as const,
  },
  {
    name: "Content-Type",
    value: "application/x-www-form-urlencoded",
    descriptionKey: "editor.headerDescFormData" as const,
  },
  {
    name: "Authorization",
    value: "Bearer YOUR_TOKEN",
    descriptionKey: "editor.headerDescBearerAuth" as const,
  },
  {
    name: "Authorization",
    value: "Basic YOUR_CREDENTIALS",
    descriptionKey: "editor.headerDescBasicAuth" as const,
  },
  {
    name: "User-Agent",
    value: "FinRPA/1.0",
    descriptionKey: "editor.headerDescUserAgent" as const,
  },
  {
    name: "Accept",
    value: "application/json",
    descriptionKey: "editor.headerDescAcceptJson" as const,
  },
  {
    name: "Accept",
    value: "*/*",
    descriptionKey: "editor.headerDescAcceptAny" as const,
  },
  {
    name: "X-API-Key",
    value: "YOUR_API_KEY",
    descriptionKey: "editor.headerDescApiKey" as const,
  },
  {
    name: "Cache-Control",
    value: "no-cache",
    descriptionKey: "editor.headerDescNoCache" as const,
  },
  {
    name: "Referer",
    value: "https://example.com",
    descriptionKey: "editor.headerDescReferer" as const,
  },
];

export function QuickHeadersDialog({ onAdd, children }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [selectedHeaders, setSelectedHeaders] = useState<
    Record<string, string>
  >({});
  const [customKey, setCustomKey] = useState("");
  const [customValue, setCustomValue] = useState("");

  const handleAddCustomHeader = () => {
    if (customKey.trim() && customValue.trim()) {
      setSelectedHeaders((prev) => ({
        ...prev,
        [customKey.trim()]: customValue.trim(),
      }));
      setCustomKey("");
      setCustomValue("");
    }
  };

  const handleToggleHeader = (name: string, value: string) => {
    setSelectedHeaders((prev) => {
      const newHeaders = { ...prev };
      if (newHeaders[name] === value) {
        delete newHeaders[name];
      } else {
        newHeaders[name] = value;
      }
      return newHeaders;
    });
  };

  const handleAddHeaders = () => {
    if (Object.keys(selectedHeaders).length > 0) {
      onAdd(selectedHeaders);
      setSelectedHeaders({});
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusIcon className="h-5 w-5" />
            {t("editor.addCommonHeaders")}
          </DialogTitle>
          <DialogDescription>
            {t("editor.addCommonHeadersDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Common Headers */}
          <div>
            <h4 className="mb-3 text-sm font-medium">{t("editor.commonHeaders")}</h4>
            <div className="grid grid-cols-1 gap-2">
              {commonHeaders.map((header, index) => {
                const isSelected =
                  selectedHeaders[header.name] === header.value;
                return (
                  <div
                    key={index}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : ""
                    }`}
                    onClick={() =>
                      handleToggleHeader(header.name, header.value)
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {header.name}
                        </Badge>
                        <span className="text-sm" style={{ color: "var(--finrpa-text-muted)" }}>
                          {header.value}
                        </span>
                      </div>
                      {isSelected && (
                        <Badge variant="default" className="text-xs">
                          {t("editor.selected")}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                      {t(header.descriptionKey)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Header */}
          <div>
            <h4 className="mb-3 text-sm font-medium">{t("editor.customHeader")}</h4>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="custom-key" className="text-xs">
                  {t("editor.headerName")}
                </Label>
                <Input
                  id="custom-key"
                  placeholder="X-Custom-Header"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="custom-value" className="text-xs">
                  {t("editor.headerValue")}
                </Label>
                <Input
                  id="custom-value"
                  placeholder="custom-value"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddCustomHeader}
                  disabled={!customKey.trim() || !customValue.trim()}
                >
                  <PlusIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Selected Headers Preview */}
          {Object.keys(selectedHeaders).length > 0 && (
            <div>
              <h4 className="mb-3 text-sm font-medium">
                {t("editor.selectedHeaders")} ({Object.keys(selectedHeaders).length})
              </h4>
              <div className="rounded-lg border p-3" style={{ background: "rgba(26,58,92,0.06)" }}>
                <pre className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                  {JSON.stringify(selectedHeaders, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleAddHeaders}
            disabled={Object.keys(selectedHeaders).length === 0}
          >
            {t("editor.addHeaders")} ({Object.keys(selectedHeaders).length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
