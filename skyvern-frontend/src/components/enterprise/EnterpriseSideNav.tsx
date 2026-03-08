/**
 * Enterprise sidebar navigation with frosted-glass style and i18n support.
 */

import { NavLink, useNavigate } from "react-router-dom";
import { Icon, type IconName } from "@/components/Icon";
import { cn } from "@/util/utils";
import { useSidebarStore } from "@/store/SidebarStore";
import { useI18n } from "@/i18n/useI18n";
import { useAuthStore } from "@/store/AuthStore";
import type { MessageKey } from "@/i18n/locales";

type NavItem = {
  labelKey: MessageKey;
  to: string;
  icon: IconName;
};

const buildSection: NavItem[] = [
  { labelKey: "nav.discover",   to: "/discover",  icon: "search" },
  { labelKey: "nav.tasks",      to: "/tasks",     icon: "task" },
  { labelKey: "nav.workflows",  to: "/workflows", icon: "workflow" },
  { labelKey: "nav.runs",       to: "/runs",      icon: "refresh" },
];

const enterpriseSection: NavItem[] = [
  { labelKey: "nav.dashboard",   to: "/enterprise/dashboard",    icon: "dashboard" },
  { labelKey: "nav.approvals",   to: "/enterprise/approvals",    icon: "approval" },
  { labelKey: "nav.auditLogs",   to: "/enterprise/audit",        icon: "audit" },
  { labelKey: "nav.permissions", to: "/enterprise/permissions",  icon: "permissions" },
  { labelKey: "nav.llmMonitor",  to: "/enterprise/llm",          icon: "workflow" },
];

const generalSection: NavItem[] = [
  { labelKey: "nav.settings",    to: "/settings",     icon: "settings" },
];

function NavSection({
  titleKey,
  items,
  collapsed,
}: {
  titleKey: MessageKey;
  items: NavItem[];
  collapsed: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="mb-6">
      {!collapsed && (
        <div
          className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--finrpa-text-muted)" }}
        >
          {t(titleKey)}
        </div>
      )}
      <div className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn("glass-nav-item", {
                active: isActive,
                "justify-center px-2": collapsed,
              })
            }
            title={collapsed ? t(item.labelKey) : undefined}
          >
            <Icon
              name={item.icon}
              size={20}
            />
            {!collapsed && <span>{t(item.labelKey)}</span>}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export function EnterpriseSideNav() {
  const { collapsed } = useSidebarStore();
  const { t } = useI18n();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <nav className="flex-1 overflow-y-auto py-2">
      <NavSection titleKey="nav.build"      items={buildSection}      collapsed={collapsed} />
      <NavSection titleKey="nav.enterprise" items={enterpriseSection} collapsed={collapsed} />
      <NavSection titleKey="nav.general"    items={generalSection}    collapsed={collapsed} />

      {/* Logout */}
      <div className="mt-2 border-t" style={{ borderColor: "var(--glass-border)" }}>
        <button
          type="button"
          onClick={handleLogout}
          className={cn("glass-nav-item w-full", {
            "justify-center px-2": collapsed,
          })}
          title={collapsed ? t("auth.logout") : undefined}
          style={{ cursor: "pointer", background: "none", border: "none" }}
        >
          <Icon name="logout" size={20} />
          {!collapsed && <span>{t("auth.logout")}</span>}
        </button>
      </div>
    </nav>
  );
}
