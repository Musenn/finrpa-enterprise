import { DownloadIcon, EyeOpenIcon, FileIcon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { getClient } from "@/api/AxiosClient";
import { useCredentialGetter } from "@/hooks/useCredentialGetter";
import { type BrowserSession } from "@/routes/workflows/types/browserSessionTypes";
import { useI18n } from "@/i18n/useI18n";

const PREVIEWABLE_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
  "bmp",
  "ico",
  "txt",
  "csv",
  "json",
  "xml",
  "html",
  "htm",
  "mp4",
  "webm",
  "mp3",
  "wav",
  "ogg",
]);

function isPreviewable(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return PREVIEWABLE_EXTENSIONS.has(ext);
}

function downloadFile(url: string, filename: string) {
  fetch(url)
    .then((response) => response.blob())
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    })
    .catch(console.error);
}

function BrowserSessionDownloads() {
  const { t } = useI18n();
  const { browserSessionId } = useParams();
  const credentialGetter = useCredentialGetter();

  const {
    data: browserSession,
    isLoading,
    error,
  } = useQuery<BrowserSession>({
    queryKey: ["browserSession", browserSessionId],
    queryFn: async () => {
      const client = await getClient(credentialGetter, "sans-api-v1");
      const response = await client.get(
        `/browser_sessions/${browserSessionId}`,
      );
      return response.data;
    },
    enabled: !!browserSessionId,
  });

  const downloadedFiles = browserSession?.downloaded_files ?? [];

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-lg">{t("browserSessions.loadingDownloads")}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-lg text-red-500">
          {t("browserSessions.errorLoadingDownloads")}: {error.message}
        </div>
      </div>
    );
  }

  if (downloadedFiles.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-lg text-gray-500">{t("browserSessions.noDownloadedFiles")}</div>
          <div className="text-sm text-gray-400">
            {t("browserSessions.downloadedFilesHint")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto p-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{t("browserSessions.downloadedFiles")}</h2>
        <p className="text-sm text-gray-500">
          {t("browserSessions.downloadedFilesHint")}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 lg:grid-cols-4 xl:grid-cols-5">
        {downloadedFiles.map((file, index) => {
          const urlPath = file.url.split("?")[0] ?? file.url;
          const filename =
            file.filename || urlPath.split("/").pop() || `${t("browserSessions.file")} ${index + 1}`;
          const previewable = file.url && isPreviewable(filename);

          return (
            <div
              key={file.url || file.checksum || index}
              className="flex flex-col items-center gap-2 rounded-lg border p-3"
            >
              <FileIcon className="size-7" />
              <div className="w-full min-w-0 text-center">
                <span className="block truncate text-xs" title={filename}>
                  {filename}
                </span>
                {file.modified_at && (
                  <div className="mt-0.5 text-xs text-gray-500">
                    {new Date(file.modified_at).toLocaleString()}
                  </div>
                )}
              </div>
              {file.url && (
                <div className="flex w-full gap-1.5">
                  {previewable ? (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted"
                      title={`${t("browserSessions.preview")} ${filename}`}
                    >
                      <EyeOpenIcon className="size-3" />
                      {t("browserSessions.preview")}
                    </a>
                  ) : (
                    <button
                      disabled
                      className="flex flex-1 cursor-not-allowed items-center justify-center gap-1 rounded border px-2 py-1 text-xs opacity-40"
                      title={t("browserSessions.previewNotAvailable")}
                    >
                      <EyeOpenIcon className="size-3" />
                      {t("browserSessions.preview")}
                    </button>
                  )}
                  <button
                    onClick={() => downloadFile(file.url, filename)}
                    className="flex flex-1 items-center justify-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted"
                    title={`${t("common.download")} ${filename}`}
                  >
                    <DownloadIcon className="size-3" />
                    {t("common.download")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { BrowserSessionDownloads };
