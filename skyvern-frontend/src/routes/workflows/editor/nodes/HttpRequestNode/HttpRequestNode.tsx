import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Handle, NodeProps, Position, useEdges, useNodes } from "@xyflow/react";
import { useCallback } from "react";
import { NodeHeader } from "../components/NodeHeader";
import { NodeTabs } from "../components/NodeTabs";
import type { WorkflowBlockType } from "@/routes/workflows/types/workflowTypes";
import type { HttpRequestNode as HttpRequestNodeType } from "./types";
import { HelpTooltip } from "@/components/HelpTooltip";
import { Switch } from "@/components/ui/switch";
import { placeholders, helpTooltips } from "../../helpContent";
import { WorkflowBlockInputTextarea } from "@/components/WorkflowBlockInputTextarea";
import { AppNode } from "..";
import { getAvailableOutputParameterKeys } from "../../workflowEditorUtils";
import { ParametersMultiSelect } from "../TaskNode/ParametersMultiSelect";
import { useIsFirstBlockInWorkflow } from "../../hooks/useIsFirstNodeInWorkflow";
import { CodeEditor } from "@/routes/workflows/components/CodeEditor";
import { useUpdate } from "@/routes/workflows/editor/useUpdate";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CodeIcon, PlusIcon, MagicWandIcon } from "@radix-ui/react-icons";
import { WorkflowBlockParameterSelect } from "../WorkflowBlockParameterSelect";
import { CurlImportDialog } from "./CurlImportDialog";
import { QuickHeadersDialog } from "./QuickHeadersDialog";
import {
  MethodBadge,
  UrlValidator,
  RequestPreview,
  JsonValidator,
} from "./HttpUtils";
import { useRerender } from "@/hooks/useRerender";
import { useRecordingStore } from "@/store/useRecordingStore";
import { cn } from "@/util/utils";
import { useI18n } from "@/i18n/useI18n";

const httpMethods = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
];

function HttpRequestNode({ id, data, type }: NodeProps<HttpRequestNodeType>) {
  const { t } = useI18n();
  const { editable, label } = data;
  const rerender = useRerender({ prefix: "accordian" });
  const nodes = useNodes<AppNode>();
  const edges = useEdges();
  const outputParameterKeys = getAvailableOutputParameterKeys(nodes, edges, id);
  const update = useUpdate<HttpRequestNodeType["data"]>({ id, editable });

  const handleCurlImport = useCallback(
    (importedData: {
      method: string;
      url: string;
      headers: string;
      body: string;
      timeout: number;
      followRedirects: boolean;
    }) => {
      update({
        method: importedData.method,
        url: importedData.url,
        headers: importedData.headers,
        body: importedData.body,
        timeout: importedData.timeout,
        followRedirects: importedData.followRedirects,
      });
    },
    [update],
  );

  const handleQuickHeaders = useCallback(
    (headers: Record<string, string>) => {
      try {
        const existingHeaders = JSON.parse(data.headers || "{}");
        const mergedHeaders = { ...existingHeaders, ...headers };
        const newHeadersString = JSON.stringify(mergedHeaders, null, 2);
        update({ headers: newHeadersString });
      } catch (error) {
        // If existing headers are invalid, just use the new ones
        const newHeadersString = JSON.stringify(headers, null, 2);
        update({ headers: newHeadersString });
      }
    },
    [data.headers, update],
  );

  const isFirstWorkflowBlock = useIsFirstBlockInWorkflow({ id });
  const recordingStore = useRecordingStore();

  const showBodyEditor =
    data.method !== "GET" && data.method !== "HEAD" && data.method !== "DELETE";

  const handleAddParameterToBody = useCallback(
    (parameterKey: string) => {
      const parameterSyntax = `{{ ${parameterKey} }}`;
      const currentBody = data.body || "{}";
      try {
        const parsed = JSON.parse(currentBody);
        // Add as a new field with unique key
        const existingKeys = Object.keys(parsed);
        let keyIndex = existingKeys.length + 1;
        let newKey = `param_${keyIndex}`;
        while (existingKeys.includes(newKey)) {
          keyIndex++;
          newKey = `param_${keyIndex}`;
        }
        parsed[newKey] = parameterSyntax;
        update({ body: JSON.stringify(parsed, null, 2) });
      } catch {
        // If invalid JSON, reset to valid JSON with the parameter
        update({ body: JSON.stringify({ param_1: parameterSyntax }, null, 2) });
      }
    },
    [data.body, update],
  );

  return (
    <div
      className={cn({
        "pointer-events-none opacity-50": recordingStore.isRecording,
      })}
    >
      <Handle
        type="source"
        position={Position.Bottom}
        id="a"
        className="opacity-0"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="b"
        className="opacity-0"
      />
      <div className="transform-origin-center w-[30rem] space-y-4 rounded-lg bg-slate-elevation3 px-6 py-4 transition-all">
        <NodeHeader
          blockLabel={label}
          editable={editable}
          nodeId={id}
          totpIdentifier={null}
          totpUrl={null}
          type={type as WorkflowBlockType}
          extraActions={
            <CurlImportDialog onImport={handleCurlImport}>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={!editable}
              >
                <CodeIcon className="mr-1 h-3 w-3" />
                {t("editor.importCurl")}
              </Button>
            </CurlImportDialog>
          }
        />

        <div className="space-y-4">
          {/* Method and URL Section */}
          <div className="flex gap-4">
            <div className="w-32 space-y-2">
              <div className="flex gap-2">
                <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("editor.method")}</Label>
                <HelpTooltip content={helpTooltips["httpRequest"]["method"]} />
              </div>
              <Select
                value={data.method}
                onValueChange={(value) => update({ method: value })}
                disabled={!editable}
              >
                <SelectTrigger className="nopan text-xs">
                  <div className="flex items-center gap-2">
                    <MethodBadge method={data.method} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {httpMethods.map((method) => (
                    <SelectItem key={method} value={method}>
                      <div className="flex items-center gap-2">
                        <MethodBadge method={method} />
                        {method}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex justify-between">
                <div className="flex gap-2">
                  <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.url")}</Label>
                  <HelpTooltip content={helpTooltips["httpRequest"]["url"]} />
                </div>
                {isFirstWorkflowBlock ? (
                  <div className="flex justify-end text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                    {t("editor.tipAddParameters")}
                  </div>
                ) : null}
              </div>
              <WorkflowBlockInputTextarea
                nodeId={id}
                onChange={(value) => {
                  update({ url: value });
                }}
                value={data.url}
                placeholder={placeholders["httpRequest"]["url"]}
                className="nopan text-xs"
              />
              <UrlValidator url={data.url} />
            </div>
          </div>

          {/* Headers Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("editor.headers")}</Label>
                <HelpTooltip content={helpTooltips["httpRequest"]["headers"]} />
              </div>
              <QuickHeadersDialog onAdd={handleQuickHeaders}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!editable}
                >
                  <PlusIcon className="mr-1 h-3 w-3" />
                  {t("editor.quickHeaders")}
                </Button>
              </QuickHeadersDialog>
            </div>
            <CodeEditor
              className="w-full"
              language="json"
              value={data.headers}
              onChange={(value) => {
                update({ headers: value || "{}" });
              }}
              readOnly={!editable}
              minHeight="80px"
              maxHeight="160px"
            />
            <JsonValidator value={data.headers} />
          </div>

          {/* Body Section */}
          {showBodyEditor && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("editor.body")}</Label>
                  <HelpTooltip content={helpTooltips["httpRequest"]["body"]} />
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={!editable}
                    >
                      <PlusIcon className="mr-1 h-3 w-3" />
                      {t("editor.addParameter")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[22rem]">
                    <WorkflowBlockParameterSelect
                      nodeId={id}
                      onAdd={handleAddParameterToBody}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <CodeEditor
                className="w-full"
                language="json"
                value={data.body}
                onChange={(value) => {
                  update({ body: value || "{}" });
                }}
                readOnly={!editable}
                minHeight="100px"
                maxHeight="200px"
              />
              <JsonValidator value={data.body} />
            </div>
          )}

          {/* Files Section */}
          {showBodyEditor && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("editor.files")}</Label>
                <HelpTooltip content={helpTooltips["httpRequest"]["files"]} />
              </div>
              <CodeEditor
                className="w-full"
                language="json"
                value={data.files}
                onChange={(value) => {
                  update({ files: value || "{}" });
                }}
                readOnly={!editable}
                minHeight="80px"
                maxHeight="160px"
              />
              <JsonValidator value={data.files} />
            </div>
          )}

          {/* Request Preview */}
          <RequestPreview
            method={data.method}
            url={data.url}
            headers={data.headers}
            body={data.body}
            files={data.files}
          />
        </div>

        <Separator />

        <Accordion
          type="single"
          collapsible
          onValueChange={() => rerender.bump()}
        >
          <AccordionItem value="advanced" className="border-b-0">
            <AccordionTrigger className="py-0">
              {t("editor.advancedSettings")}
            </AccordionTrigger>
            <AccordionContent key={rerender.key} className="pl-6 pr-1 pt-1">
              <div className="space-y-4">
                <ParametersMultiSelect
                  availableOutputParameters={outputParameterKeys}
                  parameters={data.parameterKeys}
                  onParametersChange={(parameterKeys) => {
                    update({ parameterKeys });
                  }}
                />
                <div className="flex gap-4">
                  <div className="w-32 space-y-2">
                    <div className="flex gap-2">
                      <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>{t("editor.timeout")}</Label>
                      <HelpTooltip content={helpTooltips["httpRequest"]["timeout"]} />
                    </div>
                    <Input
                      type="number"
                      min="1"
                      max="300"
                      value={data.timeout}
                      onChange={(e) =>
                        update({
                          timeout: parseInt(e.target.value) || 30,
                        })
                      }
                      className="nopan text-xs"
                      disabled={!editable}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>
                        {t("editor.followRedirects")}
                      </Label>
                      <HelpTooltip content={helpTooltips["httpRequest"]["followRedirects"]} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                        {t("editor.autoFollowRedirects")}
                      </span>
                      <Switch
                        checked={data.followRedirects}
                        onCheckedChange={(checked) =>
                          update({ followRedirects: checked })
                        }
                        disabled={!editable}
                      />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>
                        {t("editor.continueOnFailure")}
                      </Label>
                      <HelpTooltip
                        content={
                          helpTooltips["httpRequest"]["continueOnFailure"]
                        }
                      />
                    </div>
                    <div className="flex items-center justify-end">
                      <Switch
                        checked={data.continueOnFailure}
                        onCheckedChange={(checked) =>
                          update({ continueOnFailure: checked })
                        }
                        disabled={!editable}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>
                        {t("editor.saveResponseAsFile")}
                      </Label>
                      <HelpTooltip content={t("editor.saveResponseAsFileHelp")} />
                    </div>
                    <Switch
                      checked={data.saveResponseAsFile}
                      onCheckedChange={(checked) => {
                        update({ saveResponseAsFile: checked });
                      }}
                      disabled={!editable}
                    />
                  </div>
                  {data.saveResponseAsFile && (
                    <div className="space-y-2 border-l-2 pl-4" style={{ borderColor: "var(--glass-border)" }}>
                      <div className="flex gap-2">
                        <Label className="text-xs" style={{ color: "var(--finrpa-text-secondary)" }}>
                          {t("editor.downloadFilename")}
                        </Label>
                        <HelpTooltip content={helpTooltips["httpRequest"]["downloadFilename"]} />
                      </div>
                      <Input
                        type="text"
                        value={data.downloadFilename}
                        onChange={(e) => {
                          update({ downloadFilename: e.target.value });
                        }}
                        placeholder={t("editor.autoGeneratedFromUrl")}
                        className="nopan text-xs"
                        disabled={!editable}
                      />
                    </div>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Tips Section */}
        <div className="rounded-md p-3" style={{ background: "var(--glass-bg)" }}>
          <div className="space-y-2 text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
            <div className="flex items-center gap-2">
              <MagicWandIcon className="h-3 w-3" />
              <span className="font-medium">{t("editor.quickTips")}</span>
            </div>
            <ul className="ml-5 list-disc space-y-1">
              <li>{t("editor.tipImportCurl")}</li>
              <li>{t("editor.tipQuickHeaders")}</li>
              <li>
                {t("editor.tipPasswordCredential")}: {"{{ my_credential.username }}"} /{" "}
                {"{{ my_credential.password }}"}
              </li>
              <li>{t("editor.tipSecretCredential")}: {"{{ my_secret.secret_value }}"}</li>
              <li>{t("editor.tipResponseData")}</li>
              <li>{t("editor.tipReferenceResponse")}</li>
            </ul>
          </div>
        </div>

        <NodeTabs blockLabel={label} />
      </div>
    </div>
  );
}

export { HttpRequestNode };
