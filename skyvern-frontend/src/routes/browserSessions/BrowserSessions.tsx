import { GlobeIcon, PlusIcon, ReloadIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ProxyLocation } from "@/api/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { HelpTooltip } from "@/components/HelpTooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ProxySelector } from "@/components/ProxySelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBrowserSessionsQuery } from "@/routes/browserSessions/hooks/useBrowserSessionsQuery";
import { useCreateBrowserSessionMutation } from "@/routes/browserSessions/hooks/useCreateBrowserSessionMutation";
import {
  type BrowserSession,
  type BrowserSessionExtension,
  type BrowserSessionType,
} from "@/routes/workflows/types/browserSessionTypes";
import { CopyText } from "@/routes/workflows/editor/Workspace";
import { basicTimeFormat } from "@/util/timeFormat";
import { cn, formatMs, toDate } from "@/util/utils";
import { useI18n } from "@/i18n/useI18n";

function sessionIsOpen(browserSession: BrowserSession): boolean {
  return (
    browserSession.completed_at === null && browserSession.started_at !== null
  );
}

const No = ({ label }: { label: string }) => (
  <Badge className="flex h-7 w-12 justify-center bg-gray-800 text-orange-50 hover:bg-gray-900">
    {label}
  </Badge>
);

const Yes = ({ label }: { label: string }) => (
  <Badge className="flex h-7 w-12 justify-center bg-green-900 text-green-50 hover:bg-green-900/80">
    {label}
  </Badge>
);

const BROWSER_TYPE_OPTIONS: Array<{
  value: BrowserSessionType;
  label: string;
}> = [
  { value: "msedge", label: "Microsoft Edge" },
  { value: "chrome", label: "Google Chrome" },
];

const EXTENSION_OPTIONS: Array<{
  value: BrowserSessionExtension;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: "ad-blocker",
    labelKey: "browserSessions.adBlocker",
    descriptionKey: "browserSessions.adBlockerDesc",
  },
  {
    value: "captcha-solver",
    labelKey: "browserSessions.captchaSolver",
    descriptionKey: "browserSessions.captchaSolverDesc",
  },
];

function BrowserSessions() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [sessionOptions, setSessionOptions] = useState<{
    proxyLocation: ProxyLocation;
    timeoutMinutes: number | null;
    browserType: BrowserSessionType | null;
    extensions: BrowserSessionExtension[];
  }>({
    proxyLocation: ProxyLocation.Residential,
    timeoutMinutes: 60,
    browserType: null,
    extensions: [],
  });

  const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;
  const itemsPerPage = searchParams.get("page_size")
    ? Number(searchParams.get("page_size"))
    : 10;

  function setParamPatch(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => params.set(k, v));
    setSearchParams(params, { replace: true });
  }

  function handlePreviousPage() {
    if (page === 1) return;
    setParamPatch({ page: String(page - 1) });
  }

  function handleNextPage() {
    if (isNextDisabled) return;
    setParamPatch({ page: String(page + 1) });
  }

  const createBrowserSessionMutation = useCreateBrowserSessionMutation();

  const { data: browserSessions = [], isLoading } = useBrowserSessionsQuery(
    page,
    itemsPerPage,
  );

  const { data: nextPageBrowserSessions } = useBrowserSessionsQuery(
    page + 1,
    itemsPerPage,
  );

  const isNextDisabled =
    isLoading ||
    !nextPageBrowserSessions ||
    nextPageBrowserSessions.length === 0;

  function handleRowClick(
    e: React.MouseEvent<HTMLTableRowElement>,
    browserSessionId: string,
  ) {
    if (e.ctrlKey || e.metaKey) {
      window.open(
        window.location.origin + `/browser-session/${browserSessionId}`,
        "_blank",
        "noopener,noreferrer",
      );
    } else {
      navigate(`/browser-session/${browserSessionId}`);
    }
  }

  function toggleExtension(extension: BrowserSessionExtension) {
    setSessionOptions((prev) => {
      const exists = prev.extensions.includes(extension);
      return {
        ...prev,
        extensions: exists
          ? prev.extensions.filter((item) => item !== extension)
          : [...prev.extensions, extension],
      };
    });
  }

  return (
    <div className="px-8">
      {/* header */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <GlobeIcon className="size-6" />
          <h1 className="text-2xl">{t("browserSessions.browsers")}</h1>
        </div>
        <p className="text-slate-300">
          {t("browserSessions.browsersDescription")}
        </p>
      </div>

      {/* browsers */}
      <div className="mt-6 space-y-4">
        <div className="flex justify-end">
          <div className="flex gap-4">
            <Button
              disabled={createBrowserSessionMutation.isPending}
              onClick={() => {
                setIsDrawerOpen(true);
              }}
            >
              {createBrowserSessionMutation.isPending ? (
                <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlusIcon className="mr-2 h-4 w-4" />
              )}
              {t("common.create")}
            </Button>
          </div>
        </div>
        <div className="rounded-lg border">
          <Table className="w-full table-fixed">
            <TableHeader className="rounded-t-lg bg-slate-elevation2">
              <TableRow>
                <TableHead className="w-1/4 truncate rounded-tl-lg text-slate-400">
                  ID
                </TableHead>
                <TableHead className="w-1/12 truncate text-slate-400">
                  {t("browserSessions.open")}
                </TableHead>
                <TableHead className="w-1/6 truncate text-slate-400">
                  <span className="mr-2">{t("browserSessions.occupied")}</span>
                  <HelpTooltip
                    className="inline"
                    content={t("browserSessions.occupiedTooltip")}
                  />
                </TableHead>
                <TableHead className="w-1/6 truncate text-slate-400">
                  {t("browserSessions.started")}
                </TableHead>
                <TableHead className="w-1/6 truncate text-slate-400">
                  {t("browserSessions.timeout")}
                </TableHead>
                <TableHead className="w-1/2 truncate text-slate-400">
                  {t("browserSessions.cdpUrl")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6}>{t("common.loading")}</TableCell>
                </TableRow>
              ) : browserSessions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>{t("browserSessions.noSessions")}</TableCell>
                </TableRow>
              ) : (
                browserSessions?.map((browserSession) => {
                  const isOpen = sessionIsOpen(browserSession);
                  const startedAtDate = toDate(
                    browserSession.started_at ?? "",
                    null,
                  );
                  const ago = startedAtDate ? (
                    formatMs(Date.now() - startedAtDate.getTime()).ago
                  ) : (
                    <span className="opacity-50">{t("browserSessions.never")}</span>
                  );
                  const cdpUrl = browserSession.browser_address ?? "-";

                  return (
                    <TableRow
                      key={browserSession.browser_session_id}
                      className="cursor-pointer hover:bg-slate-elevation2"
                      onClick={(e) => {
                        handleRowClick(e, browserSession.browser_session_id);
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center font-mono text-sm">
                          <div className="truncate opacity-75">
                            {browserSession.browser_session_id}
                          </div>
                          <CopyText
                            className="opacity-75 hover:opacity-100"
                            text={browserSession.browser_session_id}
                          />
                        </div>
                      </TableCell>
                      <TableCell>{isOpen ? <Yes label={t("common.yes")} /> : <No label={t("common.no")} />}</TableCell>
                      <TableCell>
                        {browserSession.runnable_id ? <Yes label={t("common.yes")} /> : <No label={t("common.no")} />}
                      </TableCell>
                      <TableCell
                        title={
                          browserSession.started_at
                            ? basicTimeFormat(browserSession.started_at)
                            : t("browserSessions.notStarted")
                        }
                      >
                        {ago}
                      </TableCell>
                      <TableCell>
                        {browserSession.timeout
                          ? `${browserSession.timeout}m`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center font-mono text-sm">
                          <div className="truncate opacity-75">{cdpUrl}</div>
                          {cdpUrl !== "-" ? (
                            <CopyText
                              className="opacity-75 hover:opacity-100"
                              text={cdpUrl}
                            />
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <div className="relative px-3 py-3">
            <div className="absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-2 text-sm">
              <span className="text-slate-400">{t("browserSessions.itemsPerPage")}</span>
              <select
                className="h-9 rounded-md border border-slate-300 bg-background"
                value={itemsPerPage}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  const params = new URLSearchParams(searchParams);
                  params.set("page_size", String(next));
                  params.set("page", "1");
                  setSearchParams(params, { replace: true });
                }}
              >
                <option className="px-3" value={5}>
                  5
                </option>
                <option className="px-3" value={10}>
                  10
                </option>
                <option className="px-3" value={20}>
                  20
                </option>
                <option className="px-3" value={50}>
                  50
                </option>
              </select>
            </div>
            <Pagination className="pt-0">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    className={cn({
                      "cursor-not-allowed opacity-50": page === 1,
                    })}
                    onClick={handlePreviousPage}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink>{page}</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    className={cn({
                      "cursor-not-allowed opacity-50": isNextDisabled,
                    })}
                    onClick={handleNextPage}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>

      {/* create new session options */}
      <Drawer
        direction="right"
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      >
        <DrawerContent className="bottom-2 right-0 top-2 mt-0 h-full w-96 rounded border-0 p-6">
          <DrawerHeader>
            <DrawerTitle>{t("browserSessions.createBrowserSession")}</DrawerTitle>
            <DrawerDescription>
              {t("browserSessions.createDescription")}
              <div className="mt-8 flex flex-col gap-4">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Label>{t("browserSessions.proxyLocation")}</Label>
                    <HelpTooltip content={t("browserSessions.proxyHelper")} />
                  </div>
                  <ProxySelector
                    value={sessionOptions.proxyLocation}
                    allowGranularSearch={false}
                    modalPopover
                    onChange={(value) => {
                      setSessionOptions((prev) => ({
                        ...prev,
                        proxyLocation: value,
                      }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t("browserSessions.timeoutMinutes")}</Label>
                    <HelpTooltip content={t("browserSessions.timeoutTooltip")} />
                  </div>
                  <Input
                    type="number"
                    min={5}
                    max={1440}
                    value={sessionOptions.timeoutMinutes ?? ""}
                    placeholder={t("browserSessions.timeoutPlaceholder")}
                    onChange={(event) => {
                      const value =
                        event.target.value === ""
                          ? null
                          : parseInt(event.target.value, 10);
                      setSessionOptions({
                        ...sessionOptions,
                        timeoutMinutes: value,
                      });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t("browserSessions.browserType")}</Label>
                    <HelpTooltip content={t("browserSessions.browserTypeTooltip")} />
                  </div>
                  <Select
                    value={sessionOptions.browserType ?? "default"}
                    onValueChange={(value) => {
                      setSessionOptions((prev) => ({
                        ...prev,
                        browserType:
                          value === "default"
                            ? null
                            : (value as BrowserSessionType),
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">
                        {t("browserSessions.defaultBrowser")}
                      </SelectItem>
                      {BROWSER_TYPE_OPTIONS.map((browserType) => (
                        <SelectItem
                          key={browserType.value}
                          value={browserType.value}
                        >
                          {browserType.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t("browserSessions.extensions")}</Label>
                    <HelpTooltip content={t("browserSessions.extensionsTooltip")} />
                  </div>
                  <div className="space-y-2 rounded-md border p-3">
                    {EXTENSION_OPTIONS.map((extension) => (
                      <div
                        key={extension.value}
                        className="flex items-start space-x-2"
                      >
                        <Checkbox
                          id={`extension-${extension.value}`}
                          checked={sessionOptions.extensions.includes(
                            extension.value,
                          )}
                          onCheckedChange={() => {
                            toggleExtension(extension.value);
                          }}
                        />
                        <div className="grid gap-1">
                          <Label
                            htmlFor={`extension-${extension.value}`}
                            className="font-medium"
                          >
                            {t(extension.labelKey as any)}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {t(extension.descriptionKey as any)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  disabled={
                    createBrowserSessionMutation.isPending ||
                    sessionOptions.timeoutMinutes === null ||
                    Number.isNaN(sessionOptions.timeoutMinutes) ||
                    sessionOptions.timeoutMinutes < 5 ||
                    sessionOptions.timeoutMinutes > 1440
                  }
                  className="mt-6 w-full"
                  onClick={() => {
                    createBrowserSessionMutation.mutate({
                      proxyLocation: sessionOptions.proxyLocation,
                      timeout: sessionOptions.timeoutMinutes,
                      browserType: sessionOptions.browserType,
                      extensions: sessionOptions.extensions,
                    });
                  }}
                >
                  {createBrowserSessionMutation.isPending ? (
                    <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlusIcon className="mr-2 h-4 w-4" />
                  )}
                  {t("common.create")}
                </Button>
              </div>
            </DrawerDescription>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export { BrowserSessions };
