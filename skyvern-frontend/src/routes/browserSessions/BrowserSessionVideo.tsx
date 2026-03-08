import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { getClient } from "@/api/AxiosClient";
import { useCredentialGetter } from "@/hooks/useCredentialGetter";
import { type Recording } from "@/routes/workflows/types/browserSessionTypes";
import { artifactApiBaseUrl } from "@/util/env";
import { useI18n } from "@/i18n/useI18n";

function getRecordingUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  if (url.startsWith("file://")) {
    return `${artifactApiBaseUrl}/artifact/recording?path=${url.slice(7)}`;
  }
  return url;
}

function BrowserSessionVideo() {
  const { t } = useI18n();
  const { browserSessionId } = useParams();
  const credentialGetter = useCredentialGetter();

  const {
    data: browserSession,
    isLoading,
    error,
  } = useQuery({
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

  const isSessionRunning = browserSession?.status === "running";
  // Don't show recordings while session is running - they're incomplete
  const recordings = isSessionRunning ? [] : browserSession?.recordings || [];

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-lg">{t("browserSessions.loadingVideos")}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-lg text-red-500">
          {t("browserSessions.errorLoadingVideos")}: {error.message}
        </div>
      </div>
    );
  }

  if (!recordings || recordings.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-lg text-gray-500">
            {t("browserSessions.noRecordings")}
          </div>
          <div className="text-sm text-gray-400">
            {isSessionRunning
              ? t("browserSessions.recordingsAfterComplete")
              : t("browserSessions.noRecordingsCreated")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full p-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{t("browserSessions.sessionVideos")}</h2>
        <p className="text-sm text-gray-500">
          {t("browserSessions.recordedVideos")}
        </p>
      </div>

      <div className="grid gap-4">
        {recordings.map((recording: Recording, index: number) => (
          <div
            key={recording.checksum || index}
            className="rounded-lg border p-4"
          >
            <div className="mb-2">
              <h3 className="font-medium">
                {recording.filename || `${t("browserSessions.recording")} ${index + 1}`}
                {recording.modified_at && (
                  <span className="ml-2 text-sm text-gray-500">
                    ({new Date(recording.modified_at).toLocaleString()})
                  </span>
                )}
              </h3>
            </div>

            {getRecordingUrl(recording.url) ? (
              <div className="w-full">
                <video
                  controls
                  className="w-full max-w-4xl rounded-lg"
                  src={getRecordingUrl(recording.url)!}
                  preload="metadata"
                >
                  {t("browserSessions.browserNotSupported")}
                </video>
                <div className="mt-2 text-xs text-gray-500">
                  <a
                    href={getRecordingUrl(recording.url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {t("browserSessions.downloadVideo")}
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">
                {t("browserSessions.videoNotAvailable")}
              </div>
            )}

            {recording.checksum && (
              <div className="mt-2 text-sm text-gray-600">
                {t("browserSessions.checksum")}: {recording.checksum}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export { BrowserSessionVideo };
