# Day 12 — UI Redesign 代码清单

## 新增文件

| 文件路径 | 功能说明 |
|---------|---------|
| `skyvern-frontend/src/styles/variables.css` | CSS 设计 Token（深海蓝主色/金色高亮/状态颜色/风险颜色/图表配色/间距/圆角） |
| `skyvern-frontend/src/styles/glass.css` | 毛玻璃效果 CSS 工具类（glass-card/glass-sidebar/glass-nav-item/glass-btn/glass-input/glass-table） |
| `skyvern-frontend/src/components/Icon/index.tsx` | 统一 SVG 图标组件（name/size/color 参数驱动） |
| `skyvern-frontend/src/components/Icon/icons.tsx` | 21 个手工 SVG 线描图标定义（task/workflow/approval/audit/risk 等） |
| `skyvern-frontend/src/components/enterprise/EnterpriseSideNav.tsx` | 企业侧边栏导航（Build/Enterprise/General 三组菜单 + SVG 图标 + 折叠模式） |
| `skyvern-frontend/src/components/enterprise/GlassCard.tsx` | 毛玻璃卡片容器组件（hoverable/padding/onClick） |
| `skyvern-frontend/src/components/enterprise/StatusBadge.tsx` | 任务状态标签组件（11 种状态颜色映射） |
| `skyvern-frontend/src/components/enterprise/RiskBadge.tsx` | 风险等级标签组件（low/medium/high/critical） |
| `skyvern-frontend/src/components/enterprise/Timeline.tsx` | 时间线组件（图标/状态圆点/时间戳/可展开内容） |
| `skyvern-frontend/src/components/enterprise/ScreenshotDiff.tsx` | 操作前后截图对比查看器（点击放大） |
| `skyvern-frontend/src/routes/enterprise/dashboard/DashboardPage.tsx` | 运营大屏（概览卡片 + ECharts 趋势图/错误饼图/业务线柱状图） |
| `skyvern-frontend/src/routes/enterprise/approvals/ApprovalsPage.tsx` | 审批中心（待审批列表/截图/风险徽章/通过&拒绝按钮） |
| `skyvern-frontend/src/routes/enterprise/audit/AuditLogsPage.tsx` | 审计日志（按任务分组时间线 + ScreenshotDiff 截图对比） |
| `skyvern-frontend/src/routes/enterprise/permissions/PermissionsPage.tsx` | 权限管理（部门树 + 用户列表 + 角色/业务线标签） |
| `skyvern-frontend/src/__tests__/GlassCard.test.tsx` | GlassCard 组件测试（5 用例） |
| `skyvern-frontend/src/__tests__/Icon.test.tsx` | Icon 组件测试（7 用例） |
| `skyvern-frontend/src/__tests__/StatusBadge.test.tsx` | StatusBadge 组件测试（10 用例） |
| `skyvern-frontend/src/__tests__/RiskBadge.test.tsx` | RiskBadge 组件测试（6 用例） |
| `skyvern-frontend/src/__tests__/Timeline.test.tsx` | Timeline 组件测试（5 用例） |
| `skyvern-frontend/src/__tests__/ScreenshotDiff.test.tsx` | ScreenshotDiff 组件测试（4 用例） |

## 修改文件

| 文件路径 | 修改说明 |
|---------|---------|
| `skyvern-frontend/src/App.tsx` | 主题切换为 light，集成毛玻璃背景 |
| `skyvern-frontend/src/index.css` | 引入全局毛玻璃样式 |
| `skyvern-frontend/src/router.tsx` | 添加 4 个企业页面路由（dashboard/approvals/audit/permissions） |
| `skyvern-frontend/src/routes/root/RootLayout.tsx` | 添加 `.glass-page` 背景类 |
| `skyvern-frontend/src/routes/root/Sidebar.tsx` | 集成 EnterpriseSideNav 替换原导航 |
| `skyvern-frontend/src/routes/root/SidebarContent.tsx` | 企业菜单项配置 |
| `skyvern-frontend/package.json` | 新增 echarts/echarts-for-react 依赖 |
| `skyvern-frontend/package-lock.json` | 锁文件更新 |
| `skyvern-frontend/tailwind.config.js` | 扩展 Tailwind 配置（企业色彩/毛玻璃工具类） |
| `skyvern-frontend/vitest.config.ts` | 切换 DOM 环境为 happy-dom |
