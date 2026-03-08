import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/useI18n";

type Props = {
  format: string;
  landscape: boolean;
  printBackground: boolean;
  includeTimestamp: boolean;
  customFilename: string | null;
};

function PrintPageBlockParameters({
  format,
  landscape,
  printBackground,
  includeTimestamp,
  customFilename,
}: Props) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="flex gap-16">
        <div className="w-80">
          <h1 className="text-lg">{t("workflows.format")}</h1>
        </div>
        <Input value={format} readOnly />
      </div>
      <div className="flex gap-16">
        <div className="w-80">
          <h1 className="text-lg">{t("workflows.landscape")}</h1>
        </div>
        <div className="flex w-full items-center gap-3">
          <Switch checked={landscape} disabled />
          <span className="text-sm" style={{ color: "var(--finrpa-text-muted)" }}>
            {landscape ? t("common.enabled") : t("common.disabled")}
          </span>
        </div>
      </div>
      <div className="flex gap-16">
        <div className="w-80">
          <h1 className="text-lg">{t("workflows.printBackground")}</h1>
        </div>
        <div className="flex w-full items-center gap-3">
          <Switch checked={printBackground} disabled />
          <span className="text-sm" style={{ color: "var(--finrpa-text-muted)" }}>
            {printBackground ? t("common.enabled") : t("common.disabled")}
          </span>
        </div>
      </div>
      <div className="flex gap-16">
        <div className="w-80">
          <h1 className="text-lg">{t("workflows.includeTimestamp")}</h1>
        </div>
        <div className="flex w-full items-center gap-3">
          <Switch checked={includeTimestamp} disabled />
          <span className="text-sm" style={{ color: "var(--finrpa-text-muted)" }}>
            {includeTimestamp ? t("common.enabled") : t("common.disabled")}
          </span>
        </div>
      </div>
      {customFilename ? (
        <div className="flex gap-16">
          <div className="w-80">
            <h1 className="text-lg">{t("workflows.customFilename")}</h1>
          </div>
          <Input value={customFilename} readOnly />
        </div>
      ) : null}
    </div>
  );
}

export { PrintPageBlockParameters };
