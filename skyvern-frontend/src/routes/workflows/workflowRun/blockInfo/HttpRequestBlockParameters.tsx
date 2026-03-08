import { AutoResizingTextarea } from "@/components/AutoResizingTextarea/AutoResizingTextarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CodeEditor } from "@/routes/workflows/components/CodeEditor";
import { useI18n } from "@/i18n/useI18n";

type Props = {
  method: string;
  url: string | null;
  headers: Record<string, string> | null;
  body: Record<string, unknown> | null;
  files: Record<string, string> | null;
  timeout: number;
  followRedirects: boolean;
  downloadFilename: string | null;
  saveResponseAsFile: boolean;
};

function HttpRequestBlockParameters({
  method,
  url,
  headers,
  body,
  files,
  timeout,
  followRedirects,
  downloadFilename,
  saveResponseAsFile,
}: Props) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="flex gap-16">
        <div className="w-80">
          <h1 className="text-lg">{t("workflows.httpMethod")}</h1>
        </div>
        <Input value={method} readOnly />
      </div>
      {url ? (
        <div className="flex gap-16">
          <div className="w-80">
            <h1 className="text-lg">{t("workflows.urlLabel")}</h1>
          </div>
          <AutoResizingTextarea value={url} readOnly />
        </div>
      ) : null}
      {headers && Object.keys(headers).length > 0 ? (
        <div className="flex gap-16">
          <div className="w-80">
            <h1 className="text-lg">{t("workflows.httpHeaders")}</h1>
          </div>
          <CodeEditor
            className="w-full"
            language="json"
            value={JSON.stringify(headers, null, 2)}
            readOnly
            minHeight="96px"
            maxHeight="200px"
          />
        </div>
      ) : null}
      {body && Object.keys(body).length > 0 ? (
        <div className="flex gap-16">
          <div className="w-80">
            <h1 className="text-lg">{t("workflows.httpBody")}</h1>
          </div>
          <CodeEditor
            className="w-full"
            language="json"
            value={JSON.stringify(body, null, 2)}
            readOnly
            minHeight="96px"
            maxHeight="200px"
          />
        </div>
      ) : null}
      {files && Object.keys(files).length > 0 ? (
        <div className="flex gap-16">
          <div className="w-80">
            <h1 className="text-lg">{t("workflows.httpFiles")}</h1>
            <h2 className="text-base" style={{ color: "var(--finrpa-text-muted)" }}>
              {t("workflows.httpFilesDesc")}
            </h2>
          </div>
          <CodeEditor
            className="w-full"
            language="json"
            value={JSON.stringify(files, null, 2)}
            readOnly
            minHeight="96px"
            maxHeight="200px"
          />
        </div>
      ) : null}
      <div className="flex gap-16">
        <div className="w-80">
          <h1 className="text-lg">{t("workflows.httpTimeout")}</h1>
          <h2 className="text-base" style={{ color: "var(--finrpa-text-muted)" }}>{t("workflows.inSeconds")}</h2>
        </div>
        <Input value={timeout.toString()} readOnly />
      </div>
      <div className="flex gap-16">
        <div className="w-80">
          <h1 className="text-lg">{t("workflows.followRedirects")}</h1>
        </div>
        <div className="flex w-full items-center gap-3">
          <Switch checked={followRedirects} disabled />
          <span className="text-sm" style={{ color: "var(--finrpa-text-muted)" }}>
            {followRedirects ? t("common.enabled") : t("common.disabled")}
          </span>
        </div>
      </div>
      {downloadFilename ? (
        <div className="flex gap-16">
          <div className="w-80">
            <h1 className="text-lg">{t("workflows.downloadFilename")}</h1>
          </div>
          <Input value={downloadFilename} readOnly />
        </div>
      ) : null}
      {saveResponseAsFile ? (
        <div className="flex gap-16">
          <div className="w-80">
            <h1 className="text-lg">{t("workflows.saveResponseAsFile")}</h1>
          </div>
          <div className="flex w-full items-center gap-3">
            <Switch checked={true} disabled />
            <span className="text-sm" style={{ color: "var(--finrpa-text-muted)" }}>{t("common.enabled")}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { HttpRequestBlockParameters };
