export type Locale = "en" | "zh";

const en = {
  // Sidebar
  "nav.build": "Build",
  "nav.enterprise": "Enterprise",
  "nav.general": "General",
  "nav.discover": "Discover",
  "nav.tasks": "Tasks",
  "nav.workflows": "Workflows",
  "nav.runs": "Runs",
  "nav.dashboard": "Dashboard",
  "nav.approvals": "Approvals",
  "nav.auditLogs": "Audit Logs",
  "nav.permissions": "Permissions",
  "nav.settings": "Settings",
  // Dashboard
  "dashboard.title": "Operations Dashboard",
  "dashboard.totalTasks": "Total Tasks",
  "dashboard.successRate": "Today's Success Rate",
  "dashboard.pendingApproval": "Pending Approval",
  "dashboard.needsHuman": "Needs Human",
  "dashboard.taskTrend": "Task Trend (7 Days)",
  "dashboard.errorDistribution": "Error Distribution",
  "dashboard.businessLineComparison": "Business Line Comparison",
  // Approvals
  "approvals.title": "Approval Center",
  "approvals.approve": "Approve",
  "approvals.reject": "Reject",
  "approvals.remark": "Remark",
  "approvals.noPending": "No pending approvals",
  // Audit
  "audit.title": "Audit Logs",
  "audit.filterByType": "Filter by type",
  "audit.allTypes": "All types",
  "audit.before": "Before",
  "audit.after": "After",
  // Permissions
  "permissions.title": "Permission Management",
  "permissions.departments": "Departments",
  "permissions.users": "Users",
  "permissions.allDepartments": "All Departments",
  // Common
  "common.loading": "Loading...",
  "common.noData": "No data",
  "common.success": "Success",
  "common.failed": "Failed",
} as const;

const zh: Record<keyof typeof en, string> = {
  // Sidebar
  "nav.build": "构建",
  "nav.enterprise": "企业管理",
  "nav.general": "通用",
  "nav.discover": "发现",
  "nav.tasks": "任务",
  "nav.workflows": "工作流",
  "nav.runs": "运行记录",
  "nav.dashboard": "运营大屏",
  "nav.approvals": "审批中心",
  "nav.auditLogs": "审计日志",
  "nav.permissions": "权限管理",
  "nav.settings": "设置",
  // Dashboard
  "dashboard.title": "运营大屏",
  "dashboard.totalTasks": "总任务数",
  "dashboard.successRate": "今日成功率",
  "dashboard.pendingApproval": "待审批",
  "dashboard.needsHuman": "需人工处理",
  "dashboard.taskTrend": "任务趋势（近 7 天）",
  "dashboard.errorDistribution": "错误分布",
  "dashboard.businessLineComparison": "业务线对比",
  // Approvals
  "approvals.title": "审批中心",
  "approvals.approve": "通过",
  "approvals.reject": "拒绝",
  "approvals.remark": "备注",
  "approvals.noPending": "暂无待审批项",
  // Audit
  "audit.title": "审计日志",
  "audit.filterByType": "按类型筛选",
  "audit.allTypes": "全部类型",
  "audit.before": "操作前",
  "audit.after": "操作后",
  // Permissions
  "permissions.title": "权限管理",
  "permissions.departments": "部门",
  "permissions.users": "用户",
  "permissions.allDepartments": "全部部门",
  // Common
  "common.loading": "加载中...",
  "common.noData": "暂无数据",
  "common.success": "成功",
  "common.failed": "失败",
};

export const locales = { en, zh } as const;
export type MessageKey = keyof typeof en;
