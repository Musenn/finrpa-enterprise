import { ChevronDownIcon } from "@radix-ui/react-icons";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Checkbox } from "./ui/checkbox";
import { Status } from "@/api/types";
import { useI18n } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/locales";

const statusLabelKeys: Record<string, MessageKey> = {
  [Status.Completed]: "status.completed",
  [Status.Failed]: "status.failed",
  [Status.Running]: "status.running",
  [Status.Queued]: "status.queued",
  [Status.Terminated]: "status.terminated",
  [Status.Canceled]: "status.canceled",
  [Status.TimedOut]: "status.timedOut",
  [Status.Created]: "status.created",
};

const statusValues: Array<Status> = [
  Status.Completed,
  Status.Failed,
  Status.Running,
  Status.Queued,
  Status.Terminated,
  Status.Canceled,
  Status.TimedOut,
  Status.Created,
];

type Props = {
  values: Array<Status>;
  onChange: (values: Array<Status>) => void;
  options?: Array<Status>;
};

function StatusFilterDropdown({ options, values, onChange }: Props) {
  const { t } = useI18n();
  const dropdownOptions = options ?? statusValues;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          {t("status.filterByStatus")} <ChevronDownIcon className="ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {dropdownOptions.map((status) => {
          return (
            <div
              key={status}
              className="flex items-center gap-2 p-2 text-sm"
            >
              <Checkbox
                id={status}
                checked={values.includes(status)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange([...values, status]);
                  } else {
                    onChange(values.filter((v) => v !== status));
                  }
                }}
              />
              <label htmlFor={status}>{t(statusLabelKeys[status]!)}</label>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { StatusFilterDropdown };
