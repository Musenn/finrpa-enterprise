import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CopyIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  CheckCircledIcon,
} from "@radix-ui/react-icons";
import { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { copyText } from "@/util/copyText";
import { cn } from "@/util/utils";
import { useI18n } from "@/i18n/useI18n";
import { validateUrl, validateJson } from "./httpValidation";

// HTTP Method Badge Component
export function MethodBadge({
  method,
  className,
}: {
  method: string;
  className?: string;
}) {
  const getMethodStyle = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET":
        return "bg-green-100 text-green-800 border-green-300";
      case "POST":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "PUT":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "DELETE":
        return "bg-red-100 text-red-800 border-red-300";
      case "PATCH":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "HEAD":
        return "bg-gray-100 text-gray-800 border-gray-300";
      case "OPTIONS":
        return "bg-cyan-100 text-cyan-800 border-cyan-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300";
    }
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-mono text-xs font-bold",
        getMethodStyle(method),
        className,
      )}
    >
      {method}
    </Badge>
  );
}

// URL Validation Component
export function UrlValidator({ url }: { url: string }) {
  const validation = validateUrl(url);

  if (!url.trim()) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-xs",
        validation.valid
          ? "text-green-600"
          : "text-red-600",
      )}
    >
      {validation.valid ? (
        <CheckCircledIcon className="h-3 w-3" />
      ) : (
        <ExclamationTriangleIcon className="h-3 w-3" />
      )}
      <span>{validation.message}</span>
    </div>
  );
}

// JSON Validation Component
export function JsonValidator({ value }: { value: string }) {
  const validation = validateJson(value);

  if (validation.message === null) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-xs",
        validation.valid
          ? "text-green-600"
          : "text-red-600",
      )}
    >
      {validation.valid ? (
        <CheckCircledIcon className="h-3 w-3" />
      ) : (
        <ExclamationTriangleIcon className="h-3 w-3" />
      )}
      <span>{validation.message}</span>
    </div>
  );
}

// Copy to Curl Component
export function CopyToCurlButton({
  method,
  url,
  headers,
  body,
  className,
}: {
  method: string;
  url: string;
  headers: string;
  body: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const generateCurlCommand = () => {
    let curl = `curl -X ${method.toUpperCase()}`;

    if (url) {
      curl += ` "${url}"`;
    }

    // Parse and add headers
    try {
      const parsedHeaders = JSON.parse(headers || "{}");
      Object.entries(parsedHeaders).forEach(([key, value]) => {
        curl += ` \\\n  -H "${key}: ${value}"`;
      });
    } catch (error) {
      // If headers can't be parsed, skip them
    }

    // Add body for non-GET requests
    if (["POST", "PUT", "PATCH"].includes(method.toUpperCase()) && body) {
      try {
        const parsedBody = JSON.parse(body);
        curl += ` \\\n  -d '${JSON.stringify(parsedBody)}'`;
      } catch (error) {
        // If body can't be parsed, add it as-is
        curl += ` \\\n  -d '${body}'`;
      }
    }

    return curl;
  };

  const handleCopy = async () => {
    const curlCommand = generateCurlCommand();
    const success = await copyText(curlCommand);
    if (success) {
      setCopied(true);
      toast({
        title: t("common.copied"),
        description: t("editor.curlCopiedToClipboard"),
      });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({
        title: t("common.error"),
        description: t("editor.failedCopyCurl"),
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={cn("h-8 px-2", className)}
      disabled={!url}
    >
      {copied ? (
        <CheckIcon className="mr-1 h-4 w-4" />
      ) : (
        <CopyIcon className="mr-1 h-4 w-4" />
      )}
      {copied ? t("common.copied") : t("editor.copyCurl")}
    </Button>
  );
}

// Request Preview Component
export function RequestPreview({
  method,
  url,
  headers,
  body,
  files,
}: {
  method: string;
  url: string;
  headers: string;
  body: string;
  files?: string;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const hasContent = method && url;

  if (!hasContent) return null;

  const hasFiles = files && files.trim() && files !== "{}";

  return (
    <div className="rounded-md border p-3" style={{ background: "rgba(26,58,92,0.06)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MethodBadge method={method} />
          <span className="font-mono text-sm" style={{ color: "var(--finrpa-text-muted)" }}>
            {url || t("editor.noUrlSpecified")}
          </span>
          {hasFiles && (
            <Badge variant="outline" className="text-xs">
              {t("editor.files")}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="h-6 text-xs"
        >
          {expanded ? t("workflows.hideValue") : t("workflows.showValue")} {t("common.details")}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          {/* Headers */}
          <div>
            <div className="mb-1 text-xs font-medium">{t("editor.headers")}:</div>
            <pre className="overflow-x-auto rounded p-2 text-xs" style={{ background: "rgba(26,58,92,0.06)", color: "var(--finrpa-text-muted)" }}>
              {headers || "{}"}
            </pre>
          </div>

          {/* Body (only for POST, PUT, PATCH) */}
          {["POST", "PUT", "PATCH"].includes(method.toUpperCase()) && (
            <div>
              <div className="mb-1 text-xs font-medium">{t("editor.body")}:</div>
              <pre className="overflow-x-auto rounded p-2 text-xs" style={{ background: "rgba(26,58,92,0.06)", color: "var(--finrpa-text-muted)" }}>
                {body || "{}"}
              </pre>
            </div>
          )}

          {/* Files (only for POST, PUT, PATCH) */}
          {["POST", "PUT", "PATCH"].includes(method.toUpperCase()) &&
            hasFiles && (
              <div>
                <div className="mb-1 text-xs font-medium">{t("editor.files")}:</div>
                <pre className="overflow-x-auto rounded p-2 text-xs" style={{ background: "rgba(26,58,92,0.06)", color: "var(--finrpa-text-muted)" }}>
                  {files || "{}"}
                </pre>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
