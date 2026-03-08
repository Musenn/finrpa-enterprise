import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/util/utils";
import { EyeNoneIcon, EyeOpenIcon, Pencil1Icon } from "@radix-ui/react-icons";
import { useState } from "react";
import { useI18n } from "@/i18n/useI18n";

type Props = {
  values: {
    name: string;
    secretLabel: string;
    secretValue: string;
  };
  onChange: (values: {
    name: string;
    secretLabel: string;
    secretValue: string;
  }) => void;
  editMode?: boolean;
  editingGroups?: { name: boolean; values: boolean };
  onEnableEditName?: () => void;
  onEnableEditValues?: () => void;
};

function SecretCredentialContent({
  values,
  onChange,
  editMode,
  editingGroups,
  onEnableEditName,
  onEnableEditValues,
}: Props) {
  const { t } = useI18n();
  const { name, secretLabel, secretValue } = values;
  const nameReadOnly = editMode && !editingGroups?.name;
  const valuesReadOnly = editMode && !editingGroups?.values;
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex">
        <div className="w-72 shrink-0 space-y-1">
          <Label>{t("credentials.name")}</Label>
          <div className="text-sm text-slate-400">
            {t("credentials.nameDescription")}
          </div>
        </div>
        <div className="relative w-full">
          <Input
            value={name}
            onChange={(e) => onChange({ ...values, name: e.target.value })}
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
      <Separator />
      <div className="space-y-2">
        <Label>{t("credentials.secretLabelOptional")}</Label>
        <div className="relative w-full">
          <Input
            placeholder={t("credentials.secretLabelPlaceholder")}
            value={secretLabel}
            onChange={(e) =>
              onChange({ ...values, secretLabel: e.target.value })
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
      <div className="space-y-2">
        <Label>{t("credentials.secretValue")}</Label>
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
              type={showSecret ? "text" : "password"}
              value={secretValue}
              onChange={(e) =>
                onChange({ ...values, secretValue: e.target.value })
              }
              placeholder={editMode ? "••••••••" : undefined}
            />
            <div
              className="absolute right-0 top-0 flex size-9 cursor-pointer items-center justify-center"
              onClick={() => {
                setShowSecret((value) => !value);
              }}
              aria-label="Toggle secret value visibility"
            >
              {showSecret ? (
                <EyeOpenIcon className="size-4" />
              ) : (
                <EyeNoneIcon className="size-4" />
              )}
            </div>
          </div>
        )}
        <p className="text-sm text-slate-400">
          {t("credentials.secretUsageHint")}
        </p>
      </div>
    </div>
  );
}

export { SecretCredentialContent };
