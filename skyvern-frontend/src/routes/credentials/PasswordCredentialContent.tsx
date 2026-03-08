import { QRCodeIcon } from "@/components/icons/QRCodeIcon";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/util/utils";
import {
  EnvelopeClosedIcon,
  EyeNoneIcon,
  EyeOpenIcon,
  MobileIcon,
  Pencil1Icon,
} from "@radix-ui/react-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/useI18n";

type Props = {
  values: {
    name: string;
    username: string;
    password: string;
    totp: string;
    totp_type: "authenticator" | "email" | "text" | "none";
    totp_identifier: string;
  };
  onChange: (values: {
    name: string;
    username: string;
    password: string;
    totp: string;
    totp_type: "authenticator" | "email" | "text" | "none";
    totp_identifier: string;
  }) => void;
  /** Login page URL value — when onUrlChange is provided, a URL field is rendered after Name */
  url?: string;
  onUrlChange?: (url: string) => void;
  /** Show a required asterisk on the URL label */
  urlRequired?: boolean;
  /** Disable the URL input (e.g. during test) */
  urlDisabled?: boolean;
  /** Slot rendered between URL and the separator before Username (e.g. browser profile checkbox) */
  afterUrl?: React.ReactNode;
  editMode?: boolean;
  editingGroups?: { name: boolean; values: boolean };
  onEnableEditName?: () => void;
  onEnableEditValues?: () => void;
};

function PasswordCredentialContent({
  values,
  onChange,
  url,
  onUrlChange,
  urlRequired,
  urlDisabled,
  afterUrl,
  editMode,
  editingGroups,
  onEnableEditName,
  onEnableEditValues,
}: Props) {
  const { t } = useI18n();
  const { name, username, password, totp, totp_type, totp_identifier } = values;
  const nameReadOnly = editMode && !editingGroups?.name;
  const valuesReadOnly = editMode && !editingGroups?.values;

  const [totpMethod, setTotpMethod] = useState<
    "authenticator" | "email" | "text"
  >(
    totp_type === "email" || totp_type === "text" ? totp_type : "authenticator",
  );
  const [showPassword, setShowPassword] = useState(false);
  const prevUsernameRef = useRef(username);
  const prevTotpMethodRef = useRef<typeof totpMethod>(totpMethod);
  const totpIdentifierLabel =
    totpMethod === "text"
      ? t("credentials.totpIdentifierPhone")
      : t("credentials.totpIdentifierEmail");
  const totpIdentifierHelper =
    totpMethod === "text"
      ? t("credentials.totpPhoneHelper")
      : t("credentials.totpEmailHelper");

  const updateValues = useCallback(
    (updates: Partial<Props["values"]>): void => {
      onChange({
        name,
        username,
        password,
        totp,
        totp_type,
        totp_identifier,
        ...updates,
      });
    },
    [name, onChange, password, totp, totp_identifier, totp_type, username],
  );

  useEffect(() => {
    const prevUsername = prevUsernameRef.current;
    const prevMethod = prevTotpMethodRef.current;

    if (totpMethod === "email") {
      const usernameChanged = username !== prevUsername;
      const identifierBlank = totp_identifier.trim() === "";
      const identifierMatchedPrevUsername = totp_identifier === prevUsername;
      const methodChanged = prevMethod !== "email";

      if (
        identifierBlank ||
        methodChanged ||
        (usernameChanged && identifierMatchedPrevUsername)
      ) {
        updateValues({ totp_identifier: username });
      }
    }

    if (totpMethod === "text" && prevMethod !== "text") {
      const wasAutoFilled = totp_identifier === prevUsername;
      if (wasAutoFilled || totp_identifier.trim() === "") {
        updateValues({ totp_identifier: "" });
      }
    }

    prevUsernameRef.current = username;
    prevTotpMethodRef.current = totpMethod;
  }, [totpMethod, totp_identifier, updateValues, username]);

  // Update totp_type when totpMethod changes
  const handleTotpMethodChange = (
    method: "authenticator" | "email" | "text",
  ) => {
    setTotpMethod(method);
    updateValues({
      totp: method === "authenticator" ? totp : "",
      totp_type: method,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-12">
        <div className="w-40 shrink-0">
          <Label>{t("credentials.name")}</Label>
        </div>
        <div className="relative w-full">
          <Input
            value={name}
            onChange={(e) => updateValues({ name: e.target.value })}
            readOnly={nameReadOnly}
            className={cn({ "pr-9 opacity-70": nameReadOnly })}
          />
          {nameReadOnly && (
            <button
              type="button"
              className="absolute right-0 top-0 flex size-9 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
              onClick={onEnableEditName}
              aria-label="Edit name"
            >
              <Pencil1Icon className="size-4" />
            </button>
          )}
        </div>
      </div>

      {onUrlChange !== undefined && (
        <>
          <Separator />
          <div className="flex items-center gap-12">
            <div className="w-40 shrink-0">
              <Label>
                {t("credentials.loginPageUrl")}
                {urlRequired && <span className="text-destructive"> *</span>}
              </Label>
            </div>
            <Input
              value={url ?? ""}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://example.com/login"
              disabled={urlDisabled}
            />
          </div>
        </>
      )}
      {afterUrl}
      <Separator />
      <div className="flex items-center gap-12">
        <div className="w-40 shrink-0">
          <Label>{t("credentials.username")}</Label>
        </div>
        <div className="relative w-full">
          <Input
            value={username}
            onChange={(e) => updateValues({ username: e.target.value })}
            readOnly={valuesReadOnly}
            className={cn({ "pr-9 opacity-70": valuesReadOnly })}
          />
          {valuesReadOnly && (
            <button
              type="button"
              className="absolute right-0 top-0 flex size-9 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
              onClick={onEnableEditValues}
              aria-label="Edit credential values"
            >
              <Pencil1Icon className="size-4" />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-12">
        <div className="w-40 shrink-0">
          <Label>{t("credentials.password")}</Label>
        </div>
        {valuesReadOnly ? (
          <div className="relative w-full">
            <Input value="••••••••" readOnly className="pr-9 opacity-70" />
            <button
              type="button"
              className="absolute right-0 top-0 flex size-9 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
              onClick={onEnableEditValues}
              aria-label="Edit credential values"
            >
              <Pencil1Icon className="size-4" />
            </button>
          </div>
        ) : (
          <div className="relative w-full">
            <Input
              className="pr-9"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => updateValues({ password: e.target.value })}
              placeholder={editMode ? "••••••••" : undefined}
            />
            <div
              className="absolute right-0 top-0 flex size-9 cursor-pointer items-center justify-center"
              onClick={() => {
                setShowPassword((value) => !value);
              }}
              aria-label="Toggle password visibility"
            >
              {showPassword ? (
                <EyeOpenIcon className="size-4" />
              ) : (
                <EyeNoneIcon className="size-4" />
              )}
            </div>
          </div>
        )}
      </div>
      <Separator />
      <Accordion type="single" collapsible>
        <AccordionItem value="two-factor-authentication" className="border-b-0">
          <AccordionTrigger className="py-2">
            {t("credentials.twoFactor")}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                {t("credentials.twoFactorDesc")}
              </p>
              <div
                className={cn("grid h-36 grid-cols-3 gap-4", {
                  "pointer-events-none opacity-70": valuesReadOnly,
                })}
              >
                <div
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-elevation1 hover:bg-slate-elevation3",
                    {
                      "bg-slate-elevation3": totpMethod === "authenticator",
                    },
                  )}
                  onClick={() => handleTotpMethodChange("authenticator")}
                >
                  <QRCodeIcon className="h-6 w-6" />
                  <Label>{t("credentials.authenticatorApp")}</Label>
                </div>
                <div
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-elevation1 hover:bg-slate-elevation3",
                    {
                      "bg-slate-elevation3": totpMethod === "email",
                    },
                  )}
                  onClick={() => handleTotpMethodChange("email")}
                >
                  <EnvelopeClosedIcon className="h-6 w-6" />
                  <Label>{t("credentials.email")}</Label>
                </div>
                <div
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-elevation1 hover:bg-slate-elevation3",
                    {
                      "bg-slate-elevation3": totpMethod === "text",
                    },
                  )}
                  onClick={() => handleTotpMethodChange("text")}
                >
                  <MobileIcon className="h-6 w-6" />
                  <Label>{t("credentials.textMessage")}</Label>
                </div>
              </div>
              {(totpMethod === "text" || totpMethod === "email") && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-12">
                      <div className="w-40 shrink-0">
                        <Label>{totpIdentifierLabel}</Label>
                      </div>
                      <div className="relative w-full">
                        <Input
                          value={totp_identifier}
                          onChange={(e) =>
                            updateValues({ totp_identifier: e.target.value })
                          }
                          readOnly={valuesReadOnly}
                          className={cn({ "pr-9 opacity-70": valuesReadOnly })}
                        />
                        {valuesReadOnly && (
                          <button
                            type="button"
                            className="absolute right-0 top-0 flex size-9 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
                            onClick={onEnableEditValues}
                            aria-label="Edit credential values"
                          >
                            <Pencil1Icon className="size-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                      {totpIdentifierHelper}
                    </p>
                  </div>
                  <p className="text-sm text-slate-400">
                    <Link
                      to="https://github.com/Musenn/finrpa-enterprise"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      {t("credentials.contactUs")}
                    </Link>{" "}
                    {t("common.or")}{" "}
                    <Link
                      to="https://github.com/Musenn/finrpa-enterprise"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      {t("credentials.seeDocumentation")}
                    </Link>
                  </p>
                </>
              )}
              {totpMethod === "authenticator" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-12">
                    <div className="w-40 shrink-0">
                      <Label className="whitespace-nowrap">
                        {t("credentials.authenticatorKey")}
                      </Label>
                    </div>
                    {valuesReadOnly ? (
                      <div className="relative w-full">
                        <Input
                          value="••••••••"
                          readOnly
                          className="pr-9 opacity-70"
                        />
                        <button
                          type="button"
                          className="absolute right-0 top-0 flex size-9 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
                          onClick={onEnableEditValues}
                          aria-label="Edit credential values"
                        >
                          <Pencil1Icon className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <Input
                        value={totp}
                        onChange={(e) => updateValues({ totp: e.target.value })}
                        placeholder={editMode ? "••••••••" : undefined}
                      />
                    )}
                  </div>
                  <p className="text-sm text-slate-400">
                    {t("credentials.authenticatorGuide")}{"  "}
                    <Link
                      to="https://bitwarden.com/help/integrated-authenticator/#manually-enter-a-secret"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      Bitwarden
                    </Link>
                    {", "}
                    <Link
                      to="https://support.1password.com/one-time-passwords#on-1passwordcom"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      1Password
                    </Link>
                    {", "}
                    <Link
                      to="https://support.lastpass.com/s/document-item?language=en_US&bundleId=lastpass&topicId=LastPass/create-totp-vault.html&_LANG=enus"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      LastPass
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export { PasswordCredentialContent };
