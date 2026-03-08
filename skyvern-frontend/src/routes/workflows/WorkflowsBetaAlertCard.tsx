import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/useI18n";

function WorkflowsBetaAlertCard() {
  const { t } = useI18n();
  return (
    <div className="glass-card-static flex flex-col items-center rounded-lg p-4 shadow">
      <header>
        <h1 className="py-4 text-3xl">{t("workflows.beta")}</h1>
      </header>
      <div>{t("workflows.betaDesc")}</div>
      <div>{t("workflows.betaApiHint")}</div>
      <div className="flex gap-4 py-4">
        <Button variant="secondary" asChild>
          <a
            href="https://github.com/Musenn/finrpa-enterprise"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("workflows.viewOnGithub")}
          </a>
        </Button>
      </div>
    </div>
  );
}

export { WorkflowsBetaAlertCard };
