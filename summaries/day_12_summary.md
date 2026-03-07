# Day 12 — 前端全面改造：毛玻璃风格 + SVG 图标

## 今日改动

按照 UI 设计规范完成前端全面改造，涵盖全局样式体系、SVG 图标组件、企业侧边栏导航、通用组件库和四个全新企业页面：

1. **全局样式体系**：`src/styles/variables.css` 定义了完整的设计 Token——深海蓝（#1A3A5C）主色、金色（#C9A84C）高亮、状态颜色（running 蓝 / completed 绿 / failed 红 / pending_approval 金 / needs_human 橙）、风险等级颜色、图表配色、间距和圆角变量。`src/styles/glass.css` 实现了毛玻璃效果的 CSS 工具类——`.glass-card`（白色半透明 72% + blur 12px + 轻阴影，hover 上浮 -2px）、`.glass-sidebar`（固定侧边栏毛玻璃）、`.glass-nav-item`（导航项 hover/active 态，active 左侧金色边框）、`.glass-btn-primary/secondary`、`.glass-input`、`.glass-table`、`.glass-badge`

2. **SVG 图标组件系统**：`src/components/Icon/` 实现了 21 个手工 SVG 线描图标——task / workflow / approval / audit / department / user / settings / risk / bell / check-circle / x-circle / clock / user-check / refresh / download / filter / search / chevron-down / chevron-up / dashboard / permissions。统一 stroke-only 风格（strokeWidth 1.5，fill="none"），通过 `<Icon name="..." size={16|20|24} color="..." />` 调用，支持三种标准尺寸

3. **企业侧边栏导航**：`EnterpriseSideNav` 组件替换原 `SideNav`，将菜单分为三组——Build（Discover/Tasks/Workflows/Runs）、Enterprise（Dashboard/Approvals/Audit Logs/Permissions）、General（Settings）。每个菜单项带对应的 SVG 图标，当前选中项深海蓝高亮 + 金色左边框。侧边栏支持折叠模式（仅图标）

4. **通用组件库**（`src/components/enterprise/`）：
   - `GlassCard`：毛玻璃卡片容器，支持 hoverable / padding / onClick 参数
   - `StatusBadge`：11 种任务状态的颜色标签（running/completed/failed/pending_approval/needs_human/paused/queued/timeout/created/terminated/canceled）
   - `RiskBadge`：4 种风险等级标签（low/medium/high/critical）
   - `Timeline`：时间线组件，支持图标、状态圆点、时间戳、可展开内容
   - `ScreenshotDiff`：操作前后截图对比查看器，支持点击放大

5. **四个企业新页面**：
   - Dashboard（运营大屏）：4 个概览卡片（总任务数/今日成功率/待审批/需人工） + 任务趋势折线图（ECharts） + 错误分布饼图 + 业务线成功率横向对比柱状图。接入 Day 11 后端 API，API 不可用时展示 demo 数据
   - Approvals（审批中心）：待审批列表，每条记录展示截图区域、风险等级徽章、操作描述、部门/业务线信息、审批备注输入框、通过/拒绝按钮。通过/拒绝操作调用后端 POST 接口
   - Audit Logs（审计日志）：按任务分组的时间线视图，支持按操作类型筛选。每条日志可展开查看操作前后截图对比（使用 ScreenshotDiff 组件），失败日志展示红色错误信息
   - Permissions（权限管理）：左侧部门树形结构（支持展开/折叠/选中过滤），右侧用户列表（姓名/部门/角色标签/业务线标签），角色用颜色区分（super_admin 紫色 / org_admin 蓝色 / operator 绿色 / approver 金色 / viewer 灰色），全业务线访问权限（ALL）用金色标签高亮

6. **主题切换**：默认主题从 dark 切换为 light，CSS 变量调整为毛玻璃风格适配的浅色配色方案。`RootLayout` 添加 `.glass-page` 背景类

7. **ECharts 集成**：安装 `echarts` + `echarts-for-react`，Dashboard 页面三个图表统一透明背景，轴线颜色 #E5E7EB，数据线使用深海蓝/红/金/紫配色

新增前端测试 37 个（Icon 7 / GlassCard 5 / StatusBadge 10 / RiskBadge 6 / Timeline 5 / ScreenshotDiff 4），后端测试 526 个不变。`npm run build` 无报错。

## 设计决策

### CSS 变量 vs Tailwind 内联

毛玻璃效果需要 `backdrop-filter: blur()` + 半透明背景 + border + shadow 的组合，如果全部写成 Tailwind 内联类会非常冗长且不利于一致性维护。选择的方案是将复合效果封装为 CSS 工具类（`.glass-card`、`.glass-sidebar` 等），单属性调整仍用 Tailwind（如 `p-6`、`text-sm`）。设计 Token 全部通过 CSS 变量定义，颜色值只在 `variables.css` 中出现一次，组件通过 `var(--finrpa-blue)` 引用，方便后续主题定制。

### 手写 SVG 而非图标库

Skyvern 原版使用 Radix Icons（`@radix-ui/react-icons`），我们改为手写 SVG 有两个原因：一是设计规范要求统一的 stroke-only 线描风格（strokeWidth 1.5），Radix Icons 部分图标使用 fill 而非 stroke，风格不一致；二是金融企业场景需要专属图标（approval / audit / risk / department / permissions），这些在通用图标库中不存在。所有 21 个图标通过单一 `<Icon>` 组件暴露，name prop 驱动，添加新图标只需在 `icons.tsx` 中增加一个条目。

### Demo 数据降级策略

四个企业页面都采用了相同的降级模式：`useEffect` 中先尝试 `fetch` 后端 API，如果返回非 200 或网络错误，则使用硬编码的 demo 数据渲染。这确保了前端在没有启动后端服务的情况下仍然可以正常展示和开发调试。demo 数据覆盖了所有组件的渲染路径（包括空状态、错误状态），避免了开发时的空白页面。

### ECharts 配色一致性

图表背景设为透明（不设 backgroundColor），与毛玻璃卡片容器的半透明背景融合。轴线使用 `--chart-axis`（#E5E7EB）浅灰色，不干扰数据可读性。数据系列配色从设计 Token 中取值：蓝（趋势主线）、红（失败/错误）、金（审批相关）、紫和青（辅助系列），确保图表与整体 UI 配色协调。

## 金融企业场景下的工程意义

**运营可视化一站式体验**：CoE（卓越中心）管理者打开 Dashboard 就能看到今日成功率、待审批数、需人工介入数三个关键指标，下方趋势图反映近一周的运行健康度。不需要切换多个系统，一个页面覆盖运营决策所需的核心数据。

**审批效率提升**：审批中心将风险等级、操作描述、截图、审批按钮集中在一张卡片内，审批人无需在多个页面间跳转就能完成审批决策。风险等级徽章用颜色区分优先级，critical 红色最醒目，帮助审批人优先处理高风险请求。

**合规审计可追溯**：审计日志页面按任务分组展示操作时间线，配合截图对比查看器，合规审计人员可以直观回溯每一步 RPA 操作的执行轨迹——点击了什么、输入了什么（脱敏后）、操作前后页面变化。这种可视化的审计证据链在银保监检查中比纯文本日志更具说服力。

**权限可视化管理**：部门树 + 用户列表 + 业务线标签的三栏布局，让 IT 管理员一眼看清每个用户的权限组合。角色颜色区分（operator 绿 vs approver 金）直观体现了职责分离原则。ALL 业务线标签的金色高亮提醒管理员注意全组织访问权限的风控意义。

## 踩坑记录

1. **jsdom ESM 兼容性问题**：项目的 `node_modules` 中 `html-encoding-sniffer` 使用 `require()` 加载 ESM 模块 `@exodus/bytes/encoding-lite.js`，导致 jsdom 环境下所有测试报 `ERR_REQUIRE_ESM` 错误。解决方案是切换到 `happy-dom` 作为 Vitest 的 DOM 环境，happy-dom 不依赖 jsdom 的编码嗅探链路，且性能更好

2. **noUncheckedIndexedAccess 严格模式**：tsconfig 开启了 `noUncheckedIndexedAccess`，导致 `Record<string, T>` 的索引访问返回 `T | undefined`。在 PermissionsPage 中 `roleColors[user.role]` 需要显式提供 fallback 值（`?? { bg: "...", text: "..." }`），不能依赖 `??` 链式调用后续属性

3. **Tailwind CSS 与 CSS 变量的交互**：`backdrop-filter: blur(var(--glass-blur))` 无法直接通过 Tailwind 的 `backdrop-blur-*` 工具类实现（因为值来自 CSS 变量而非预设值），需要在独立的 CSS 文件中定义。同理，`box-shadow` 使用 `rgba()` 透明度值时，Tailwind 的 shadow 工具类表达能力不足，写在 glass.css 中更直观
