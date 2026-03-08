import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/useI18n";

type Props = {
  url: string;
  continueOnFailure: boolean;
};

function GotoUrlBlockParameters({ url, continueOnFailure }: Props) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="flex gap-16">
        <div className="w-80">
          <h1 className="text-lg">{t("workflows.urlLabel")}</h1>
          <h2 className="text-base" style={{ color: "var(--finrpa-text-muted)" }}>
            {t("workflows.urlDestination")}
          </h2>
        </div>
        <Input value={url} readOnly />
      </div>
      <div className="flex gap-16">
        <div className="w-80">
          <h1 className="text-lg">{t("workflows.continueOnFailure")}</h1>
          <h2 className="text-base" style={{ color: "var(--finrpa-text-muted)" }}>
            {t("workflows.continueOnFailureDesc")}
          </h2>
        </div>
        <div className="flex w-full items-center gap-3">
          <Switch checked={continueOnFailure} disabled />
          <span className="text-sm" style={{ color: "var(--finrpa-text-muted)" }}>
            {continueOnFailure ? t("common.enabled") : t("common.disabled")}
          </span>
        </div>
      </div>
    </div>
  );
}

export { GotoUrlBlockParameters };
