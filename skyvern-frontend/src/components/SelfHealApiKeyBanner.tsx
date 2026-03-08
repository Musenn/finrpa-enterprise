import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { getClient, setApiKeyHeader } from "@/api/AxiosClient";
import {
  AuthStatusValue,
  useAuthDiagnostics,
} from "@/hooks/useAuthDiagnostics";
import { useI18n } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/locales";

type BannerStatus = Exclude<AuthStatusValue, "ok"> | "error";

const statusTitleKey: Record<BannerStatus, MessageKey> = {
  missing_env: "banner.apiKeyMissing",
  invalid_format: "banner.apiKeyInvalid",
  invalid: "banner.apiKeyNotRecognized",
  expired: "banner.apiKeyExpired",
  not_found: "banner.localOrgMissing",
  error: "banner.unableVerify",
};

const statusDescKey: Record<BannerStatus, MessageKey> = {
  missing_env: "banner.apiKeyMissingDesc",
  invalid_format: "banner.apiKeyInvalidDesc",
  invalid: "banner.apiKeyNotRecognizedDesc",
  expired: "banner.apiKeyExpiredDesc",
  not_found: "banner.localOrgMissingDesc",
  error: "banner.unableVerifyDesc",
};

function SelfHealApiKeyBanner() {
  const { t } = useI18n();
  const diagnosticsQuery = useAuthDiagnostics();
  const { toast } = useToast();
  const [isRepairing, setIsRepairing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isProductionBuild = !import.meta.env.DEV;

  const { data, error, isLoading, refetch } = diagnosticsQuery;

  const rawStatus = data?.status;
  const bannerStatus: BannerStatus | null = error
    ? "error"
    : rawStatus && rawStatus !== "ok"
      ? rawStatus
      : null;

  if (!bannerStatus && !errorMessage) {
    if (isLoading) {
      return null;
    }
    return null;
  }

  const titleKey = statusTitleKey[bannerStatus ?? "missing_env"];
  const descKey = statusDescKey[bannerStatus ?? "missing_env"];
  const queryErrorMessage = error?.message ?? null;

  const handleRepair = async () => {
    setIsRepairing(true);
    setErrorMessage(null);
    try {
      const client = await getClient(null);
      const response = await client.post<{
        fingerprint?: string;
        api_key?: string;
        backend_env_path?: string;
        frontend_env_path?: string;
      }>("/internal/auth/repair");

      const {
        fingerprint,
        api_key: apiKey,
        backend_env_path: backendEnvPath,
        frontend_env_path: frontendEnvPath,
      } = response.data;

      if (!apiKey) {
        throw new Error("Repair succeeded but no API key was returned.");
      }

      setApiKeyHeader(apiKey);

      const fingerprintSuffix = fingerprint
        ? ` (fingerprint ${fingerprint})`
        : "";

      const pathsElements = [];
      if (backendEnvPath) {
        pathsElements.push(<div key="backend">Backend: {backendEnvPath}</div>);
      }
      if (frontendEnvPath) {
        pathsElements.push(
          <div key="frontend">Frontend: {frontendEnvPath}</div>,
        );
      }

      toast({
        title: t("banner.regenerated"),
        description: (
          <div>
            <div>
              {t("banner.regeneratedDesc")}{fingerprintSuffix}
            </div>
            {pathsElements.length > 0 && (
              <div className="mt-2 space-y-2">{pathsElements}</div>
            )}
            {isProductionBuild && (
              <div className="mt-3">
                {t("banner.prodWarning")}
              </div>
            )}
          </div>
        ),
      });

      await refetch({ throwOnError: false });
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : t("banner.unableVerify");
      setErrorMessage(message);
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <div className="px-4 pt-4">
      <Alert className="flex flex-col items-center gap-2" style={{ borderColor: "var(--glass-border)", background: "var(--glass-bg)", color: "var(--finrpa-text-primary)" }}>
        <AlertTitle className="text-center text-base font-semibold tracking-wide">
          {t(titleKey)}
        </AlertTitle>
        <AlertDescription className="space-y-3 text-center text-sm leading-6">
          {bannerStatus !== "error" ? (
            <>
              <p>{t(descKey)}</p>
              {isProductionBuild && (
                <p className="text-yellow-300">
                  {t("banner.prodWarning")}
                </p>
              )}
              <div className="flex justify-center">
                <Button
                  onClick={handleRepair}
                  disabled={isRepairing}
                  variant="secondary"
                >
                  {isRepairing ? t("banner.regenerating") : t("banner.regenerate")}
                </Button>
              </div>
            </>
          ) : (
            <p>{t(descKey)}</p>
          )}
          {errorMessage ? (
            <p className="text-xs text-rose-200">{errorMessage}</p>
          ) : null}
          {queryErrorMessage && !errorMessage ? (
            <p className="text-xs text-rose-200">{queryErrorMessage}</p>
          ) : null}
        </AlertDescription>
      </Alert>
    </div>
  );
}

export { SelfHealApiKeyBanner };
