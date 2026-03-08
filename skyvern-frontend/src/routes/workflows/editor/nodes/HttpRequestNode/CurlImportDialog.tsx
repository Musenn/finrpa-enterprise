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
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { getClient } from "@/api/AxiosClient";
import { useCredentialGetter } from "@/hooks/useCredentialGetter";
import { toast } from "@/components/ui/use-toast";
import {
  ReloadIcon,
  CodeIcon,
  CheckIcon,
  CopyIcon,
} from "@radix-ui/react-icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { copyText } from "@/util/copyText";
import { useI18n } from "@/i18n/useI18n";

type Props = {
  onImport: (data: {
    method: string;
    url: string;
    headers: string;
    body: string;
    timeout: number;
    followRedirects: boolean;
  }) => void;
  children: React.ReactNode;
};

const curlExamples = [
  {
    nameKey: "editor.exampleGetRequest" as const,
    curl: `curl -X GET "https://api.example.com/users" \\
  -H "Authorization: Bearer token123" \\
  -H "Accept: application/json"`,
  },
  {
    nameKey: "editor.examplePostJson" as const,
    curl: `curl -X POST "https://api.example.com/users" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer token123" \\
  -d '{"name": "John Doe", "email": "john@example.com"}'`,
  },
  {
    nameKey: "editor.examplePutRequest" as const,
    curl: `curl -X PUT "https://api.example.com/users/123" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Jane Doe"}'`,
  },
];

export function CurlImportDialog({ onImport, children }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [curlCommand, setCurlCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
  } | null>(null);
  const credentialGetter = useCredentialGetter();

  const handleImport = async () => {
    if (!curlCommand.trim()) {
      toast({
        title: t("common.error"),
        description: t("editor.pleaseEnterCurl"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const client = await getClient(credentialGetter);
      const response = await client.post("/utilities/curl-to-http", {
        curl_command: curlCommand.trim(),
      });

      const data = response.data;

      onImport({
        method: data.method || "GET",
        url: data.url || "",
        headers: JSON.stringify(data.headers || {}, null, 2),
        body: JSON.stringify(data.body || {}, null, 2),
        timeout: data.timeout || 30,
        followRedirects: data.follow_redirects ?? true,
      });

      toast({
        title: t("common.success"),
        description: t("editor.curlImportedSuccess"),
        variant: "success",
      });

      setOpen(false);
      setCurlCommand("");
      setPreviewData(null);
    } catch (error: unknown) {
      const errorMessage =
        (
          error as {
            response?: { data?: { detail?: string } };
            message?: string;
          }
        ).response?.data?.detail ||
        (error as { message?: string }).message ||
        t("editor.failedParseCurl");
      toast({
        title: t("editor.importFailed"),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!curlCommand.trim()) return;

    setLoading(true);
    try {
      const client = await getClient(credentialGetter);
      const response = await client.post("/utilities/curl-to-http", {
        curl_command: curlCommand.trim(),
      });
      setPreviewData(response.data);
    } catch (error: unknown) {
      const errorMessage =
        (
          error as {
            response?: { data?: { detail?: string } };
            message?: string;
          }
        ).response?.data?.detail ||
        (error as { message?: string }).message ||
        t("editor.failedParseCurl");
      toast({
        title: t("editor.previewFailed"),
        description: errorMessage,
        variant: "destructive",
      });
      setPreviewData(null);
    } finally {
      setLoading(false);
    }
  };

  const copyExample = async (example: string) => {
    const success = await copyText(example);
    if (success) {
      toast({
        title: t("common.copied"),
        description: t("editor.exampleCopied"),
      });
    } else {
      toast({
        title: t("common.error"),
        description: t("editor.failedCopyExample"),
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CodeIcon className="h-5 w-5" />
            {t("editor.importFromCurl")}
          </DialogTitle>
          <DialogDescription>
            {t("editor.curlImportDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left side - Input */}
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">
                {t("editor.curlCommand")}
              </label>
              <Textarea
                placeholder={t("editor.pasteCurlPlaceholder")}
                value={curlCommand}
                onChange={(e) => setCurlCommand(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                disabled={loading}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreview}
                disabled={loading || !curlCommand.trim()}
              >
                {loading && (
                  <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("editor.preview")}
              </Button>
              <Button
                onClick={handleImport}
                disabled={loading || !curlCommand.trim()}
                size="sm"
              >
                {loading && (
                  <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("editor.importRequest")}
              </Button>
            </div>

            <Alert>
              <AlertDescription>
                <strong>{t("editor.supported")}:</strong> -X, -H, -d, --data, --json, -u,
                --user, --cookie, --referer, {t("editor.andMore")}.
              </AlertDescription>
            </Alert>
          </div>

          {/* Right side - Examples and Preview */}
          <div className="space-y-4">
            <div>
              <h4 className="mb-3 text-sm font-medium">{t("editor.examples")}</h4>
              <div className="space-y-2">
                {curlExamples.map((example, index) => (
                  <div key={index} className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium">
                        {t(example.nameKey)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyExample(example.curl)}
                        className="h-6 w-6 p-0"
                      >
                        <CopyIcon className="h-3 w-3" />
                      </Button>
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs">
                      {example.curl}
                    </pre>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            {previewData && (
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <CheckIcon className="h-4 w-4 text-green-500" />
                  {t("editor.preview")}
                </h4>
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {previewData.method}
                    </Badge>
                    <span className="text-xs">
                      {previewData.url}
                    </span>
                  </div>

                  {previewData.headers &&
                    Object.keys(previewData.headers).length > 0 && (
                      <div>
                        <div className="mb-1 text-xs font-medium">{t("editor.headers")}:</div>
                        <div className="space-y-1 text-xs">
                          {Object.entries(previewData.headers).map(
                            ([key, value]) => (
                              <div key={key} className="font-mono">
                                {key}: {value as string}
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                  {previewData.body != null &&
                    (() => {
                      try {
                        const bodyStr = JSON.stringify(
                          previewData.body,
                          null,
                          2,
                        );
                        return (
                          <div>
                            <div className="mb-1 text-xs font-medium">
                              {t("editor.body")}:
                            </div>
                            <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                              {bodyStr || "{}"}
                            </pre>
                          </div>
                        );
                      } catch {
                        return (
                          <div>
                            <div className="mb-1 text-xs font-medium">
                              {t("editor.body")}:
                            </div>
                            <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                              {"{}"}
                            </pre>
                          </div>
                        );
                      }
                    })()}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleImport}
            disabled={loading || !curlCommand.trim()}
          >
            {loading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
            {t("editor.importRequest")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
