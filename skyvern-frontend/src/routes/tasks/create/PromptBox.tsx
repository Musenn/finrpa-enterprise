import { getClient } from "@/api/AxiosClient";
import { Createv2TaskRequest, ProxyLocation } from "@/api/types";
import img from "@/assets/promptBoxBg.png";
import { AutoResizingTextarea } from "@/components/AutoResizingTextarea/AutoResizingTextarea";
import { CartIcon } from "@/components/icons/CartIcon";
import { GraphIcon } from "@/components/icons/GraphIcon";
import { InboxIcon } from "@/components/icons/InboxIcon";
import { MessageIcon } from "@/components/icons/MessageIcon";
import { TrophyIcon } from "@/components/icons/TrophyIcon";
import { ProxySelector } from "@/components/ProxySelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyValueInput } from "@/components/KeyValueInput";
import {
  CustomSelectItem,
  Select,
  SelectContent,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { useCredentialGetter } from "@/hooks/useCredentialGetter";
import { WorkflowApiResponse } from "@/routes/workflows/types/workflowTypes";
import { CodeEditor } from "@/routes/workflows/components/CodeEditor";
import {
  FileTextIcon,
  GearIcon,
  PaperPlaneIcon,
  Pencil1Icon,
  ReloadIcon,
  LightningBoltIcon,
} from "@radix-ui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  generatePhoneNumber,
  generateUniqueEmail,
} from "../data/sampleTaskData";
import { ExampleCasePill } from "./ExampleCasePill";
import {
  MAX_SCREENSHOT_SCROLLS_DEFAULT,
  MAX_STEPS_DEFAULT,
} from "@/routes/workflows/editor/nodes/Taskv2Node/types";
import { useAutoplayStore } from "@/store/useAutoplayStore";
import { TestWebhookDialog } from "@/components/TestWebhookDialog";
import { ImprovePrompt } from "@/components/ImprovePrompt";
import { cn } from "@/util/utils";
import { useI18n } from "@/i18n/useI18n";

const exampleCases = [
  {
    key: "finditparts",
    labelKey: "prompt.addProductToCart" as const,
    prompt:
      'Go to https://www.finditparts.com first. Search for the product "W01-377-8537", add it to cart and then navigate to the cart page. Your goal is COMPLETE when you\'re on the cart page and the specified product is in the cart. Extract all product quantity information from the cart page. Do not attempt to checkout.',
    icon: <CartIcon className="size-6" />,
  },
  {
    key: "job_application",
    labelKey: "prompt.applyForJob" as const,
    prompt: `Go to https://jobs.lever.co/leverdemo-8/45d39614-464a-4b62-a5cd-8683ce4fb80a/apply, fill out the job application form and apply to the job. Fill out any public burden questions if they appear in the form. Your goal is complete when the page says you've successfully applied to the job. Terminate if you are unable to apply successfully. Here's the user information: {"name":"John Doe","email":"${generateUniqueEmail()}","phone":"${generatePhoneNumber()}","resume_url":"https://writing.colostate.edu/guides/documents/resume/functionalSample.pdf","cover_letter":"Generate a compelling cover letter for me"}`,
    icon: <InboxIcon className="size-6" />,
  },
  {
    key: "geico",
    labelKey: "prompt.getInsuranceQuote" as const,
    prompt: `Go to https://www.geico.com first. Navigate through the website until you generate an auto insurance quote. Do not generate a home insurance quote. If you're on a page showing an auto insurance quote (with premium amounts), your goal is COMPLETE. Extract all quote information in JSON format including the premium amount, the timeframe for the quote. Here's the user information: {"licensed_at_age":19,"education_level":"HIGH_SCHOOL","phone_number":"8042221111","full_name":"Chris P. Bacon","past_claim":[],"has_claims":false,"spouse_occupation":"Florist","auto_current_carrier":"None","home_commercial_uses":null,"spouse_full_name":"Amy Stake","auto_commercial_uses":null,"requires_sr22":false,"previous_address_move_date":null,"line_of_work":null,"spouse_age":"1987-12-12","auto_insurance_deadline":null,"email":"chris.p.bacon@abc.com","net_worth_numeric":1000000,"spouse_gender":"F","marital_status":"married","spouse_licensed_at_age":20,"license_number":"AAAAAAA090AA","spouse_license_number":"AAAAAAA080AA","how_much_can_you_lose":25000,"vehicles":[{"annual_mileage":10000,"commute_mileage":4000,"existing_coverages":null,"ideal_coverages":{"bodily_injury_per_incident_limit":50000,"bodily_injury_per_person_limit":25000,"collision_deductible":1000,"comprehensive_deductible":1000,"personal_injury_protection":null,"property_damage_per_incident_limit":null,"property_damage_per_person_limit":25000,"rental_reimbursement_per_incident_limit":null,"rental_reimbursement_per_person_limit":null,"roadside_assistance_limit":null,"underinsured_motorist_bodily_injury_per_incident_limit":50000,"underinsured_motorist_bodily_injury_per_person_limit":25000,"underinsured_motorist_property_limit":null},"ownership":"Owned","parked":"Garage","purpose":"commute","vehicle":{"style":"AWD 3.0 quattro TDI 4dr Sedan","model":"A8 L","price_estimate":29084,"year":2015,"make":"Audi"},"vehicle_id":null,"vin":null}],"additional_drivers":[],"home":[{"home_ownership":"owned"}],"spouse_line_of_work":"Agriculture, Forestry and Fishing","occupation":"Customer Service Representative","id":null,"gender":"M","credit_check_authorized":false,"age":"1987-11-11","license_state":"Washington","cash_on_hand":"$10000–14999","address":{"city":"HOUSTON","country":"US","state":"TX","street":"9625 GARFIELD AVE.","zip":"77082"},"spouse_education_level":"MASTERS","spouse_email":"amy.stake@abc.com","spouse_added_to_auto_policy":true}`,
    icon: <FileTextIcon className="size-6" />,
  },
  {
    key: "california_edd",
    labelKey: "prompt.fillOutEDD" as const,
    prompt: `Go to https://eddservices.edd.ca.gov/acctservices/AccountManagement/AccountServlet?Command=NEW_SIGN_UP. Navigate through the employer services online enrollment form. Terminate when the form is completed. Here's the needed information: {"username":"isthisreal1","password":"Password123!","first_name":"John","last_name":"Doe","pin":"1234","email":"${generateUniqueEmail()}","phone_number":"${generatePhoneNumber()}"}`,
    icon: <Pencil1Icon className="size-6" />,
  },
  {
    key: "contact_us_forms",
    labelKey: "prompt.fillContactForm" as const,
    prompt: `Go to https://canadahvac.com/contact-hvac-canada. Fill out the contact us form and submit it. Your goal is complete when the page says your message has been sent. Here's the user information: {"name":"John Doe","email":"john.doe@gmail.com","phone":"123-456-7890","message":"Hello, I have a question about your services."}`,
    icon: <FileTextIcon className="size-6" />,
  },
  {
    key: "hackernews",
    labelKey: "prompt.topPostHN" as const,
    prompt: "Navigate to the Hacker News homepage and get the top 3 posts.",
    icon: <MessageIcon className="size-6" />,
  },
  {
    key: "AAPLStockPrice",
    labelKey: "prompt.searchAAPL" as const,
    prompt:
      'Go to google finance and find the "AAPL" stock price. COMPLETE when the search results for "AAPL" are displayed and the stock price is extracted.',
    icon: <GraphIcon className="size-6" />,
  },
  {
    key: "topRankedFootballTeam",
    labelKey: "prompt.topFootballTeam" as const,
    prompt:
      "Navigate to the FIFA World Ranking page and identify the top ranked football team. Extract the name of the top ranked football team from the FIFA World Ranking page.",
    icon: <TrophyIcon className="size-6" />,
  },
  {
    key: "extractIntegrationsFromGong",
    labelKey: "prompt.extractIntegrations" as const,
    prompt:
      "Go to https://www.gong.io first. Navigate to the 'Integrations' page on the Gong website. Extract the names and descriptions of all integrations listed on the Gong integrations page. Ensure not to click on any external links or advertisements.",
    icon: <GearIcon className="size-6" />,
  },
];

function PromptBox() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState<string>("");
  const [selectValue, setSelectValue] = useState<"v1" | "v2" | "v2-code">(
    "v2-code",
  ); // v2-code is the default
  const credentialGetter = useCredentialGetter();
  const queryClient = useQueryClient();
  const [webhookCallbackUrl, setWebhookCallbackUrl] = useState<string | null>(
    null,
  );
  const [proxyLocation, setProxyLocation] = useState<ProxyLocation>(
    ProxyLocation.Residential,
  );
  const [browserSessionId, setBrowserSessionId] = useState<string | null>(null);
  const [cdpAddress, setCdpAddress] = useState<string | null>(null);
  const [generateScript, setGenerateScript] = useState(false);
  const [publishWorkflow, setPublishWorkflow] = useState(false);
  const [totpIdentifier, setTotpIdentifier] = useState("");
  const [maxStepsOverride, setMaxStepsOverride] = useState<string | null>(null);
  const [maxScreenshotScrolls, setMaxScreenshotScrolls] = useState<
    string | null
  >(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [dataSchema, setDataSchema] = useState<string | null>(null);
  const [extraHttpHeaders, setExtraHttpHeaders] = useState<string | null>(null);
  const { setAutoplay } = useAutoplayStore();
  const [promptImprovalIsPending, setPromptImprovalIsPending] = useState(false);

  const generateWorkflowMutation = useMutation({
    mutationFn: async ({
      prompt,
      version,
    }: {
      prompt: string;
      version: string;
    }) => {
      const client = await getClient(credentialGetter, "sans-api-v1");
      const v = version === "v1" ? "v1" : "v2";

      const request: Record<string, unknown> = {
        user_prompt: prompt,
        webhook_callback_url: webhookCallbackUrl,
        proxy_location: proxyLocation,
        totp_identifier: totpIdentifier,
        max_screenshot_scrolls: maxScreenshotScrolls,
        publish_workflow: publishWorkflow,
        run_with: "code",
        ai_fallback: true,
        extracted_information_schema: dataSchema
          ? (() => {
              try {
                return JSON.parse(dataSchema);
              } catch (e) {
                return dataSchema;
              }
            })()
          : null,
        extra_http_headers: extraHttpHeaders
          ? (() => {
              try {
                return JSON.parse(extraHttpHeaders);
              } catch (e) {
                return extraHttpHeaders;
              }
            })()
          : null,
      };

      if (v === "v1") {
        request.url = "https://google.com"; // a stand-in value; real url is generated via prompt
      }

      const result = await client.post<
        Createv2TaskRequest,
        { data: WorkflowApiResponse }
      >(
        "/workflows/create-from-prompt",
        {
          task_version: v,
          request,
        },
        {
          headers: {
            "x-max-steps-override": maxStepsOverride,
          },
        },
      );

      return result;
    },
    onSuccess: ({ data: workflow }) => {
      toast({
        variant: "success",
        title: t("workflows.workflowCreated"),
        description: t("workflows.workflowCreatedDesc"),
      });

      queryClient.invalidateQueries({
        queryKey: ["workflows"],
      });

      const firstBlock = workflow.workflow_definition.blocks[0];

      if (firstBlock) {
        setAutoplay(workflow.workflow_permanent_id, firstBlock.label);
      }

      navigate(`/workflows/${workflow.workflow_permanent_id}/build`);
    },
    onError: (error: AxiosError) => {
      toast({
        variant: "destructive",
        title: t("workflows.errorCreating"),
        description: error.message,
      });
    },
  });

  return (
    <div style={{ borderRadius: "var(--radius-lg)", boxShadow: "var(--glass-shadow)", overflow: "hidden" }}>
      <div
        className="py-[4.25rem]"
        style={{
          background: `url(${img}) 50% / cover no-repeat`,
        }}
      >
        <div className="mx-auto flex min-w-44 flex-col items-center gap-7 px-8">
          <span className="text-2xl" style={{ color: "var(--finrpa-text-primary)" }}>
            {t("tasks.whatTaskAccomplish")}
          </span>
          <div className="flex w-full max-w-xl flex-col">
            <div
              className={cn(
                "flex w-full items-center gap-2 rounded-xl py-2 pr-4",
                {
                  "pointer-events-none opacity-50": promptImprovalIsPending,
                },
              )}
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
            >
              <AutoResizingTextarea
                className="min-h-0 resize-none rounded-xl border-transparent px-4 hover:border-transparent focus-visible:ring-0"
                style={{ color: "var(--finrpa-text-primary)", background: "transparent" }}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t("tasks.enterPrompt")}
              />
              <Select
                value={selectValue}
                onValueChange={(value: "v1" | "v2" | "v2-code") => {
                  setSelectValue(value);
                }}
              >
                <SelectTrigger className="w-48 focus:ring-0">
                  {selectValue === "v2-code" ? (
                    <div className="relative z-10 flex w-full flex-col items-center">
                      <div className="flex items-center gap-1">
                        <LightningBoltIcon className="size-4 shrink-0 text-yellow-400" />
                        <div className="font-normal" style={{ color: "var(--finrpa-text-primary)" }}>
                          FinRPA 2.0
                        </div>
                      </div>
                      <div className="self-start pl-7 text-xs font-semibold text-yellow-400">
                        {t("prompt.withCode")}
                      </div>
                    </div>
                  ) : (
                    <SelectValue className="relative z-10" />
                  )}
                </SelectTrigger>
                <SelectContent style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                  <CustomSelectItem value="v1" className="hover:bg-slate-100">
                    <div className="space-y-2">
                      <div>
                        <SelectItemText><span style={{ color: "var(--finrpa-text-primary)" }}>FinRPA 1.0</span></SelectItemText>
                      </div>
                      <div className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                        {t("prompt.bestForSimple")}
                      </div>
                    </div>
                  </CustomSelectItem>
                  <CustomSelectItem value="v2" className="hover:bg-slate-100">
                    <div className="space-y-2">
                      <div>
                        <SelectItemText><span style={{ color: "var(--finrpa-text-primary)" }}>FinRPA 2.0</span></SelectItemText>
                      </div>
                      <div className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                        {t("prompt.bestForComplex")}
                      </div>
                    </div>
                  </CustomSelectItem>
                  <CustomSelectItem
                    value="v2-code"
                    className="relative overflow-hidden border-2 border-yellow-500/50 bg-gradient-to-r from-yellow-500/10 via-yellow-400/10 to-amber-400/10 hover:bg-yellow-50"
                  >
                    <div className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/20 to-transparent" />
                    <div className="relative flex items-center gap-2 space-y-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <SelectItemText className="animate-pulse bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-400 bg-clip-text font-bold text-transparent">
                            FinRPA 2.0
                          </SelectItemText>
                          <LightningBoltIcon className="size-4 animate-bounce text-yellow-400" />
                        </div>
                        <div className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-400 bg-clip-text text-xs font-semibold text-transparent">
                          {t("prompt.withCode")}
                        </div>
                      </div>
                    </div>
                  </CustomSelectItem>
                </SelectContent>
              </Select>
              <ImprovePrompt
                isVisible={Boolean(prompt.trim())}
                onBegin={() => {
                  setPromptImprovalIsPending(true);
                }}
                onEnd={() => {
                  setPromptImprovalIsPending(false);
                }}
                onImprove={(prompt) => setPrompt(prompt)}
                prompt={prompt}
                size="large"
                useCase="new_workflow"
              />
              <div className="flex items-center">
                <GearIcon
                  className="size-6 cursor-pointer"
                  style={{ color: "var(--finrpa-text-secondary)" }}
                  onClick={() => {
                    setShowAdvancedSettings((value) => !value);
                  }}
                />
              </div>
              <div
                className={cn("flex items-center", {
                  "pointer-events-none opacity-20": !prompt.trim(),
                })}
              >
                {generateWorkflowMutation.isPending ? (
                  <ReloadIcon className="size-6 animate-spin" style={{ color: "var(--finrpa-text-secondary)" }} />
                ) : (
                  <PaperPlaneIcon
                    className="size-6 cursor-pointer"
                    style={{ color: "var(--finrpa-text-secondary)" }}
                    onClick={async () => {
                      generateWorkflowMutation.mutate({
                        prompt,
                        version: selectValue,
                      });
                    }}
                  />
                )}
              </div>
            </div>
            {showAdvancedSettings ? (
              <div className="rounded-b-lg px-2">
                <div className="space-y-4 rounded-b-xl p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                  <header style={{ color: "var(--finrpa-text-primary)" }}>{t("tasks.advanced")}</header>
                  <div className="flex gap-16">
                    <div className="w-48 shrink-0">
                      <div className="text-sm" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.webhookUrl")}</div>
                      <div className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                        {t("tasks.webhookUrlDesc")}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Input
                        className="w-full"
                        value={webhookCallbackUrl ?? ""}
                        onChange={(event) => {
                          setWebhookCallbackUrl(event.target.value);
                        }}
                      />
                      <TestWebhookDialog
                        runType="task"
                        runId={null}
                        initialWebhookUrl={webhookCallbackUrl ?? undefined}
                        trigger={
                          <Button
                            type="button"
                            variant="secondary"
                            className="self-start"
                            disabled={!webhookCallbackUrl}
                          >
                            {t("tasks.testWebhook")}
                          </Button>
                        }
                      />
                    </div>
                  </div>
                  <div className="flex gap-16">
                    <div className="w-48 shrink-0">
                      <div className="text-sm" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.proxyLocation")}</div>
                      <div className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                        {t("tasks.proxyHelper")}
                      </div>
                    </div>
                    <ProxySelector
                      value={proxyLocation}
                      onChange={setProxyLocation}
                    />
                  </div>
                  <div className="flex gap-16">
                    <div className="w-48 shrink-0">
                      <div className="text-sm" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.browserSessionId")}</div>
                      <div className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                        {t("tasks.browserSessionIdDesc")}
                      </div>
                    </div>
                    <Input
                      value={browserSessionId ?? ""}
                      placeholder="pbs_xxx"
                      onChange={(event) => {
                        setBrowserSessionId(event.target.value);
                      }}
                    />
                  </div>
                  <div className="flex gap-16">
                    <div className="w-48 shrink-0">
                      <div className="text-sm" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.browserAddress")}</div>
                      <div className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                        {t("tasks.browserAddressDesc")}
                      </div>
                    </div>
                    <Input
                      value={cdpAddress ?? ""}
                      placeholder="http://127.0.0.1:9222"
                      onChange={(event) => {
                        setCdpAddress(event.target.value);
                      }}
                    />
                  </div>
                  <div className="flex gap-16">
                    <div className="w-48 shrink-0">
                      <div className="text-sm" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.twoFAIdentifier")}</div>
                      <div className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                        {t("tasks.twoFAIdentifierDesc")}
                      </div>
                    </div>
                    <Input
                      value={totpIdentifier}
                      onChange={(event) => {
                        setTotpIdentifier(event.target.value);
                      }}
                    />
                  </div>
                  <div className="flex gap-16">
                    <div className="w-48 shrink-0">
                      <div className="text-sm" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.extraHttpHeaders")}</div>
                      <div className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                        {t("tasks.extraHttpHeadersDesc")}
                      </div>
                    </div>
                    <div className="flex-1">
                      <KeyValueInput
                        value={extraHttpHeaders ?? ""}
                        onChange={(val) =>
                          setExtraHttpHeaders(
                            val === null
                              ? null
                              : typeof val === "string"
                                ? val || null
                                : JSON.stringify(val),
                          )
                        }
                        addButtonText={t("tasks.addHeader")}
                      />
                    </div>
                  </div>

                  <div className="flex gap-16">
                    <div className="w-48 shrink-0">
                      <div className="text-sm" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.generateScript")}</div>
                      <div className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                        {t("tasks.generateScriptDesc")}
                      </div>
                    </div>
                    <Switch
                      checked={generateScript}
                      onCheckedChange={(checked) => {
                        setGenerateScript(Boolean(checked));
                      }}
                    />
                  </div>
                  <div className="flex gap-16">
                    <div className="w-48 shrink-0">
                      <div className="text-sm" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.publishWorkflow")}</div>
                      <div className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                        {t("tasks.publishWorkflowDesc")}
                      </div>
                    </div>
                    <Switch
                      checked={publishWorkflow}
                      onCheckedChange={(checked) => {
                        setPublishWorkflow(Boolean(checked));
                      }}
                    />
                  </div>
                  <div className="flex gap-16">
                    <div className="w-48 shrink-0">
                      <div className="text-sm" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.maxSteps")}</div>
                      <div className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                        {t("tasks.maxStepsDesc")}
                      </div>
                    </div>
                    <Input
                      value={maxStepsOverride ?? ""}
                      placeholder={`Default: ${MAX_STEPS_DEFAULT}`}
                      onChange={(event) => {
                        setMaxStepsOverride(event.target.value);
                      }}
                    />
                  </div>
                  <div className="flex gap-16">
                    <div className="w-48 shrink-0">
                      <div className="text-sm" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.dataSchema")}</div>
                      <div className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                        {t("tasks.dataSchemaDesc")}
                      </div>
                    </div>
                    <div className="flex-1">
                      <CodeEditor
                        value={dataSchema ?? ""}
                        onChange={(value) => setDataSchema(value || null)}
                        language="json"
                        minHeight="100px"
                        maxHeight="500px"
                        fontSize={8}
                      />
                    </div>
                  </div>
                  <div className="flex gap-16">
                    <div className="w-48 shrink-0">
                      <div className="text-sm" style={{ color: "var(--finrpa-text-secondary)" }}>{t("tasks.maxScreenshotScrolls")}</div>
                      <div className="text-xs" style={{ color: "var(--finrpa-text-muted)" }}>
                        {t("tasks.maxScreenshotScrollsDesc")}
                      </div>
                    </div>
                    <Input
                      value={maxScreenshotScrolls ?? ""}
                      placeholder={`Default: ${MAX_SCREENSHOT_SCROLLS_DEFAULT}`}
                      onChange={(event) => {
                        setMaxScreenshotScrolls(event.target.value);
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-4 p-4" style={{ background: "var(--glass-bg)", borderTop: "1px solid var(--glass-border)" }}>
        {exampleCases.map((example) => {
          return (
            <ExampleCasePill
              key={example.key}
              icon={example.icon}
              label={t(example.labelKey)}
              onClick={() => {
                generateWorkflowMutation.mutate({
                  prompt: example.prompt,
                  version: "v2",
                });
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export { PromptBox };
