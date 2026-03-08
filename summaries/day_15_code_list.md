# Day 15 — Enterprise Frontend Integration 代码清单

## 新增文件

| 文件路径 | 功能说明 |
|---------|---------|
| `enterprise/auth/bridge.py` | 企业 JWT 到 Skyvern 原生认证的桥接函数 |
| `entrypoint-skyvern.sh` | Docker 自定义入口脚本，安装企业依赖并执行 schema 迁移 |
| `scripts/ensure_enterprise_schema.py` | 企业表结构自动创建与种子数据管理 |
| `tests/sit_test.py` | SIT 集成测试套件（47 用例覆盖 23 个企业端点） |
| `assets/main.png` | 主界面截图 |
| `assets/dashboard.png` | 运营大屏截图 |
| `assets/workflow.png` | 工作流编辑器截图 |
| `assets/Audit_Logs.png` | 审计日志截图 |
| `skyvern-frontend/src/routes/auth/LoginPage.tsx` | 企业登录页（机构下拉选择 + JWT 认证） |
| `skyvern-frontend/src/components/AuthGuard.tsx` | 路由守卫，未认证自动跳转登录 |
| `skyvern-frontend/src/store/AuthStore.ts` | Zustand 认证状态管理（token/userId/logout） |
| `skyvern-frontend/src/util/authFetch.ts` | 带 Bearer token 的 fetch 封装 |
| `skyvern-frontend/src/components/EnterpriseCredentialProvider.tsx` | 将企业 JWT 注入 Skyvern CredentialGetterContext |
| `skyvern-frontend/src/routes/enterprise/llm/LLMMonitorPage.tsx` | LLM 监控面板（弹性统计/成本/缓存/人工接管） |
| `skyvern-frontend/src/store/LLMConfigStore.ts` | LLM 配置状态管理 |

## 修改文件 — 后端

| 文件路径 | 修改说明 |
|---------|---------|
| `enterprise/auth/routes.py` | 新增 `GET /organizations` 公开端点，返回机构列表 |
| `enterprise/dashboard/routes.py` | 完善 cost/export 等端点的响应格式 |
| `enterprise/tenant/routes.py` | 调整路由前缀和数据库会话获取方式 |
| `skyvern/forge/api_app.py` | 注册企业认证桥接函数到 `authentication_function` |
| `skyvern/config.py` | 新增 `ACCESS_TOKEN_EXPIRE_MINUTES`、`SIGNATURE_ALGORITHM` 配置 |
| `skyvern/forge/sdk/api/llm/api_handler_factory.py` | OpenAI 兼容模式支持与流式响应修复 |
| `skyvern/forge/sdk/api/llm/config_registry.py` | 注册 `OPENAI_COMPATIBLE` LLM 配置 |
| `skyvern/forge/sdk/api/llm/models.py` | 新增 `OPENAI_COMPATIBLE` 模型枚举 |
| `docker-compose.yml` | 添加企业代码卷挂载和 LLM 配置文件映射 |
| `tests/fixtures/seed_demo_data.sql` | 扩展种子数据：16 个 demo 用户、8 个部门 |

## 修改文件 — 前端基础设施

| 文件路径 | 修改说明 |
|---------|---------|
| `skyvern-frontend/.env.example` | 新增 `VITE_API_BASE_URL` 等环境变量模板 |
| `skyvern-frontend/vite.config.ts` | 配置 `/api` 代理到 Docker 后端（18000 端口） |
| `skyvern-frontend/src/router.tsx` | 添加登录/企业页面路由，包裹 EnterpriseCredentialProvider |
| `skyvern-frontend/src/App.tsx` | AuthStore 初始化集成 |
| `skyvern-frontend/src/i18n/locales.ts` | 扩展至 300+ 翻译键（含 66 个企业新键） |
| `skyvern-frontend/src/i18n/useI18n.ts` | i18n hook 优化 |
| `skyvern-frontend/src/index.css` | 毛玻璃样式全局引入 |
| `skyvern-frontend/src/styles/glass.css` | 毛玻璃组件样式细化 |
| `skyvern-frontend/src/styles/variables.css` | CSS 设计 token 调整 |
| `README.md` | 更新开发进度表和测试指标 |

## 修改文件 — 企业组件

| 文件路径 | 修改说明 |
|---------|---------|
| `skyvern-frontend/src/components/enterprise/EnterpriseSideNav.tsx` | 新增 LLM 监控导航项 |
| `skyvern-frontend/src/components/enterprise/LanguageSwitcher.tsx` | 语言切换器样式适配 |
| `skyvern-frontend/src/components/enterprise/RiskBadge.tsx` | 风险等级徽章 i18n |
| `skyvern-frontend/src/components/enterprise/ScreenshotDiff.tsx` | 截图对比组件 i18n |
| `skyvern-frontend/src/components/enterprise/StatusBadge.tsx` | 状态徽章 i18n |
| `skyvern-frontend/src/routes/enterprise/dashboard/DashboardPage.tsx` | 运营大屏数据接入 |
| `skyvern-frontend/src/routes/enterprise/approvals/ApprovalsPage.tsx` | 审批中心数据接入 |
| `skyvern-frontend/src/routes/enterprise/audit/AuditLogsPage.tsx` | 审计日志数据接入 |
| `skyvern-frontend/src/routes/enterprise/permissions/PermissionsPage.tsx` | 权限管理数据接入 |

## 修改文件 — 全站 i18n（190+ 组件）

以下组件均添加了 `useI18n()` + `t()` 国际化调用，替换硬编码英文文本：

**布局与通用组件（36 个）：** Logo, LogoMinimized, SelfHealApiKeyBanner, NavigationHamburgerMenu, RootLayout, SideNav, Sidebar, Settings, NavLinkGroup, SwitchBar, SwitchBarNavigation, StatusFilterDropdown, TableSearchInput, Splitter, FloatingWindow, Orgwalled, EngineSelector, ModelSelector, DeleteConfirmationDialog, VerificationCodeBanner, FileUpload, WorkflowBlockInputSet, ApiWebhookActionsMenu, CopyApiCommandDropdown, TestWebhookDialog, WebhookReplayDialog, ImprovePrompt, PushTotpCodeForm, OnePasswordTokenForm, AzureClientSecretCredentialTokenForm, CustomCredentialServiceConfigForm, BrowserStream, Icon/icons, ui/alert, ui/pagination, ui/table

**任务页面（15 个）：** PromptBox, CreateNewTaskForm, SavedTaskForm, SavedTasks, SavedTaskCard, TaskFormSection, TaskTemplateCard, ExampleCasePill, TasksPage, TaskHistory, TaskActions(list), TaskDetails, TaskActions(detail), TaskParameters, TaskRecording, ScrollableActionList, StepArtifacts, LatestScreenshot, QueuedTasks, descriptionHelperContent

**工作流页面（70+ 个）：** Workflows, WorkflowPage, WorkflowRun, WorkflowRunParameters, RunWorkflowForm, WorkflowActions, ImportWorkflowButton, WorkflowsTable, WorkflowsBetaAlertCard, WorkflowsPageBanner, WorkflowBlockCollapsibleContent, 全部 editor nodes（25 个节点类型）, 全部 workflowRun 组件（15 个）, 全部 blockInfo 组件（10 个）, editor panels（5 个）, copilot 组件（2 个）, debugger 组件（4 个）

**凭证页面（8 个）：** CredentialsPage, CredentialsModal, CredentialItem, CredentialsTotpTab, DeleteCredentialButton, PasswordCredentialContent, SecretCredentialContent, CreditCardCredentialContent

**其他页面（8 个）：** DiscoverPage, WorkflowTemplateCard, WorkflowTemplates, HistoryPage, RunHistory, RunRouter, BrowserSession, BrowserSessions, BrowserSessionDownloads, BrowserSessionVideo
