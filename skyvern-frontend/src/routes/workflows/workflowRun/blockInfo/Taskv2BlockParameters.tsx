import { AutoResizingTextarea } from "@/components/AutoResizingTextarea/AutoResizingTextarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/useI18n";

type Props = {
  prompt: string;
  url: string | null;
  maxSteps: number | null;
  totpVerificationUrl: string | null;
  totpIdentifier: string | null;
  disableCache: boolean;
};

function Taskv2BlockParameters({
  prompt,
  url,
  maxSteps,
  totpVerificationUrl,
  totpIdentifier,
  disableCache,
}: Props) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="flex gap-16">
        <div className="w-80">
          <h1 className="text-lg">{t("tasks.prompt")}</h1>
          <h2 className="text-base" style={{ color: "var(--finrpa-text-muted)" }}>
            {t("tasks.theInstructionsForTask")}
          </h2>
        </div>
        <AutoResizingTextarea value={prompt} readOnly />
      </div>
      {url ? (
        <div className="flex gap-16">
          <div className="w-80">
            <h1 className="text-lg">{t("tasks.url")}</h1>
          </div>
          <Input value={url} readOnly />
        </div>
      ) : null}
      {typeof maxSteps === "number" ? (
        <div className="flex gap-16">
          <div className="w-80">
            <h1 className="text-lg">{t("tasks.maxSteps")}</h1>
          </div>
          <Input value={maxSteps.toString()} readOnly />
        </div>
      ) : null}
      {totpVerificationUrl ? (
        <div className="flex gap-16">
          <div className="w-80">
            <h1 className="text-lg">{t("tasks.totpVerificationUrl")}</h1>
          </div>
          <Input value={totpVerificationUrl} readOnly />
        </div>
      ) : null}
      {totpIdentifier ? (
        <div className="flex gap-16">
          <div className="w-80">
            <h1 className="text-lg">{t("tasks.totpIdentifier")}</h1>
          </div>
          <Input value={totpIdentifier} readOnly />
        </div>
      ) : null}
      {disableCache ? (
        <div className="flex gap-16">
          <div className="w-80">
            <h1 className="text-lg">{t("tasks.cacheDisabled")}</h1>
          </div>
          <div className="flex w-full items-center gap-3">
            <Switch checked={true} disabled />
            <span className="text-sm" style={{ color: "var(--finrpa-text-muted)" }}>
              {t("tasks.cacheDisabledDesc")}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { Taskv2BlockParameters };
