# Day 15 — Enterprise Frontend Integration

## 今日改动

将 Day 1-14 积累的后端能力（认证、权限、审批、审计、LLM 容错等）全部接入前端，形成完整可用的企业版应用。涵盖四个核心方向：

### 1. 企业认证系统
- 实现完整的登录页面（LoginPage），支持机构下拉选择（动态 API 加载）
- AuthGuard 路由守卫 + AuthStore (Zustand) 状态管理
- 企业 JWT 到 Skyvern 原生认证的桥接（bridge.py），解决 PromptBox 等原生功能的 403 问题
- EnterpriseCredentialProvider 将 JWT 注入 AxiosClient 的 CredentialGetterContext

### 2. 全站国际化
- 为 190+ 个前端组件接入 i18n（useI18n + t() 调用）
- locales.ts 扩展至 300+ 翻译键，覆盖中文/英文
- 企业专属翻译：审批、审计、权限、LLM 监控等 66 个新键

### 3. 企业功能页面
- LLM 监控面板（LLMMonitorPage）：弹性统计、成本分析、模型路由、缓存性能、人工接管队列，ECharts 可视化
- 运营大屏（DashboardPage）、审批中心（ApprovalsPage）、审计日志（AuditLogsPage）、权限管理（PermissionsPage）数据接入与 UI 优化
- 企业侧边栏导航（EnterpriseSideNav）新增 LLM 监控入口

### 4. 容器化与测试
- Docker 自定义入口脚本（entrypoint-skyvern.sh）：自动安装企业依赖、执行 schema 迁移
- ensure_enterprise_schema.py：企业表结构自动管理（非 Alembic）
- docker-compose.yml 卷挂载优化：api_app.py、enterprise/、LLM 配置文件
- Vite 代理配置对接 Docker 后端（端口 18000）
- SIT 测试套件：47 个用例覆盖全部 23 个企业端点
- LLM 配置：OpenAI 兼容模式（GitCode GLM-5）

## 设计决策

| 决策 | 理由 |
|------|------|
| 企业 JWT 桥接而非 API Key 方案 | 保持 Skyvern 原生代码不侵入，通过 `app.authentication_function` 插件点桥接 |
| EnterpriseCredentialProvider 包装 | getClient(null) 会主动移除 Authorization header，必须提供非 null 的 CredentialGetter |
| 登录机构改为下拉 | 用户无法记住 organization_id 字符串，动态 API 加载 + fallback 兜底 |
| 全量 i18n 而非按需 | 一次性完成避免后续逐文件补翻译的维护负担 |
| SIT 测试独立文件 | 不依赖 pytest fixtures，可直接 `python tests/sit_test.py` 快速验证部署 |

## 踩坑记录

1. **curl 中文编码**：Windows Git Bash 下 curl 发送中文 JSON 会乱码，必须用 `\uXXXX` 转义
2. **Docker restart vs recreate**：`docker compose restart` 不重新读取 `.env`，必须用 `docker compose up -d` 触发 recreate
3. **GLM-5 响应速度**：GitCode 免费 API 单次调用 100-200 秒，前端需要有耐心等待提示
4. **CredentialGetterContext 从未提供**：Skyvern 原版在某些部署模式下依赖 Clerk 等外部认证服务提供此 Context，开源版本中它始终为 null
