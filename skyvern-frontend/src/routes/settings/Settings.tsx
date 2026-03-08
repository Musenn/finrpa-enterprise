import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore } from "@/store/SettingsStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getRuntimeApiKey } from "@/util/env";
import { HiddenCopyableInput } from "@/components/ui/hidden-copyable-input";
import { OnePasswordTokenForm } from "@/components/OnePasswordTokenForm";
import { AzureClientSecretCredentialTokenForm } from "@/components/AzureClientSecretCredentialTokenForm";
import { CustomCredentialServiceConfigForm } from "@/components/CustomCredentialServiceConfigForm";
import { useVersionQuery } from "@/hooks/useVersionQuery";
import { formatVersion } from "@/util/version";
import { useI18n } from "@/i18n/useI18n";
import { useToast } from "@/components/ui/use-toast";
import { useLLMConfigStore } from "@/store/LLMConfigStore";
import { EyeOpenIcon, EyeClosedIcon } from "@radix-ui/react-icons";

function LLMConfigCard() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { apiKey, baseUrl, modelName, forceStream, setConfig, loadConfig } =
    useLLMConfigStore();

  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localBaseUrl, setLocalBaseUrl] = useState(baseUrl);
  const [localModelName, setLocalModelName] = useState(modelName);
  const [localForceStream, setLocalForceStream] = useState(forceStream);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Sync local state when store loads from localStorage
  useEffect(() => {
    setLocalApiKey(apiKey);
    setLocalBaseUrl(baseUrl);
    setLocalModelName(modelName);
    setLocalForceStream(forceStream);
  }, [apiKey, baseUrl, modelName, forceStream]);

  const handleSave = () => {
    setConfig({
      apiKey: localApiKey,
      baseUrl: localBaseUrl,
      modelName: localModelName,
      forceStream: localForceStream,
    });
    toast({
      variant: "success",
      title: t("settings.llmSaved"),
      description: t("settings.llmSavedDesc"),
    });
  };

  const handleTestConnection = async () => {
    if (!localBaseUrl || !localApiKey || !localModelName) {
      toast({
        variant: "destructive",
        title: t("settings.llmTestFailed"),
        description: "Please fill in all fields before testing.",
      });
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch(`${localBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: localModelName,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
          stream: true,
        }),
      });

      if (response.ok) {
        toast({
          variant: "success",
          title: t("settings.llmTestSuccess"),
        });
      } else {
        const errorText = await response.text();
        toast({
          variant: "destructive",
          title: t("settings.llmTestFailed"),
          description: `${response.status} ${errorText.slice(0, 200)}`,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("settings.llmTestFailed"),
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="border-b-2">
        <CardTitle className="text-lg">{t("settings.llmConfig")}</CardTitle>
        <CardDescription>{t("settings.llmConfigDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="p-8">
        <div className="flex flex-col gap-6">
          {/* API Key */}
          <div className="flex flex-col gap-2">
            <Label>{t("settings.llmApiKey")}</Label>
            <div className="relative">
              <Input
                type={showApiKey ? "text" : "password"}
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
                placeholder={t("settings.llmApiKeyPlaceholder")}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeClosedIcon className="h-4 w-4" />
                ) : (
                  <EyeOpenIcon className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Base URL */}
          <div className="flex flex-col gap-2">
            <Label>{t("settings.llmBaseUrl")}</Label>
            <Input
              type="text"
              value={localBaseUrl}
              onChange={(e) => setLocalBaseUrl(e.target.value)}
              placeholder={t("settings.llmBaseUrlPlaceholder")}
            />
          </div>

          {/* Model Name */}
          <div className="flex flex-col gap-2">
            <Label>{t("settings.llmModelName")}</Label>
            <Input
              type="text"
              value={localModelName}
              onChange={(e) => setLocalModelName(e.target.value)}
              placeholder={t("settings.llmModelNamePlaceholder")}
            />
          </div>

          {/* Force Streaming */}
          <div className="flex items-center justify-between rounded-md border p-4">
            <div className="flex flex-col gap-1">
              <Label>{t("settings.llmForceStream")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.llmForceStreamDesc")}
              </p>
            </div>
            <Switch
              checked={localForceStream}
              onCheckedChange={setLocalForceStream}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting}
            >
              {isTesting
                ? t("settings.llmTesting")
                : t("settings.llmTestConnection")}
            </Button>
            <Button onClick={handleSave}>{t("settings.llmSave")}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Settings() {
  const { t } = useI18n();
  const { environment, organization, setEnvironment, setOrganization } =
    useSettingsStore();
  const apiKey = getRuntimeApiKey();
  const { data: versionData } = useVersionQuery();

  return (
    <div className="flex flex-col gap-8">
      <LLMConfigCard />
      <Card>
        <CardHeader className="border-b-2">
          <CardTitle className="text-lg">{t("settings.title")}</CardTitle>
          <CardDescription>
            {t("settings.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <Label className="w-36 whitespace-nowrap">{t("settings.environment")}</Label>
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger>
                  <SelectValue placeholder={t("settings.environment")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">{t("settings.local")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4">
              <Label className="w-36 whitespace-nowrap">{t("settings.organization")}</Label>
              <Select value={organization} onValueChange={setOrganization}>
                <SelectTrigger>
                  <SelectValue placeholder={t("settings.organization")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skyvern">FinRPA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="border-b-2">
          <CardTitle className="text-lg">{t("settings.apiKeyTitle")}</CardTitle>
          <CardDescription>{t("settings.apiKeyDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <HiddenCopyableInput value={apiKey ?? t("settings.apiKeyNotFound")} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="border-b-2">
          <CardTitle className="text-lg">{t("settings.onePassword")}</CardTitle>
          <CardDescription>
            {t("settings.onePasswordDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <OnePasswordTokenForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="border-b-2">
          <CardTitle className="text-lg">{t("settings.azure")}</CardTitle>
          <CardDescription>{t("settings.azureDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <AzureClientSecretCredentialTokenForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="border-b-2">
          <CardTitle className="text-lg">{t("settings.customCredential")}</CardTitle>
          <CardDescription>
            {t("settings.customCredentialDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <CustomCredentialServiceConfigForm />
        </CardContent>
      </Card>
      {versionData?.version && (
        <p className="text-center text-xs text-muted-foreground/50">
          v{formatVersion(versionData.version)}
        </p>
      )}
    </div>
  );
}

export { Settings };
