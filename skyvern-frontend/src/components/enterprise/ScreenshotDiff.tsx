/**
 * Side-by-side screenshot comparison viewer for audit logs.
 * Shows before/after screenshots with zoom capability.
 */

import { useState } from "react";
import { cn } from "@/util/utils";
import { useI18n } from "@/i18n/useI18n";

type ScreenshotDiffProps = {
  beforeUrl?: string;
  afterUrl?: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
};

export function ScreenshotDiff({
  beforeUrl,
  afterUrl,
  beforeLabel,
  afterLabel,
  className,
}: ScreenshotDiffProps) {
  const { t } = useI18n();
  const resolvedBeforeLabel = beforeLabel ?? t("common.before");
  const resolvedAfterLabel = afterLabel ?? t("common.after");
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  return (
    <>
      <div className={cn("grid grid-cols-2 gap-4", className)}>
        {/* Before */}
        <div>
          <div
            className="mb-2 text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--finrpa-text-muted)" }}
          >
            {resolvedBeforeLabel}
          </div>
          {beforeUrl ? (
            <div
              className="cursor-pointer overflow-hidden rounded-lg border border-gray-200 transition-shadow hover:shadow-md"
              onClick={() => setZoomedImage(beforeUrl)}
            >
              <img
                src={beforeUrl}
                alt={resolvedBeforeLabel}
                className="h-auto w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
              <span className="text-sm text-gray-400">No screenshot</span>
            </div>
          )}
        </div>

        {/* After */}
        <div>
          <div
            className="mb-2 text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--finrpa-text-muted)" }}
          >
            {resolvedAfterLabel}
          </div>
          {afterUrl ? (
            <div
              className="cursor-pointer overflow-hidden rounded-lg border border-gray-200 transition-shadow hover:shadow-md"
              onClick={() => setZoomedImage(afterUrl)}
            >
              <img
                src={afterUrl}
                alt={resolvedAfterLabel}
                className="h-auto w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
              <span className="text-sm text-gray-400">No screenshot</span>
            </div>
          )}
        </div>
      </div>

      {/* Zoom overlay */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setZoomedImage(null)}
        >
          <img
            src={zoomedImage}
            alt="Zoomed screenshot"
            className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
