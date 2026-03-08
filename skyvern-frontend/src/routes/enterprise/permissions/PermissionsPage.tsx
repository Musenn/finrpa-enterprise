/**
 * Enterprise Permissions — department tree + user list + business line tags.
 * Supports visual configuration of user department/business-line/role combos.
 */

import { useState } from "react";
import { GlassCard } from "@/components/enterprise/GlassCard";
import { Icon } from "@/components/Icon";
import { cn } from "@/util/utils";
import { useI18n } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/locales";

type Department = {
  id: string;
  name: string;
  children?: Department[];
};

type User = {
  user_id: string;
  name: string;
  department: string;
  role: string;
  business_lines: string[];
};

const demoDepartments: Department[] = [
  {
    id: "dept_1",
    name: "Corporate Lending",
    children: [
      { id: "dept_1a", name: "Syndicated Loans" },
      { id: "dept_1b", name: "Trade Finance" },
    ],
  },
  {
    id: "dept_2",
    name: "Retail Banking",
    children: [
      { id: "dept_2a", name: "Personal Loans" },
      { id: "dept_2b", name: "Credit Cards" },
    ],
  },
  { id: "dept_3", name: "Asset Management" },
  { id: "dept_4", name: "Risk Management" },
  { id: "dept_5", name: "Compliance & Audit" },
  { id: "dept_6", name: "IT Department" },
];

const demoUsers: User[] = [
  { user_id: "eu_01", name: "张伟", department: "Corporate Lending", role: "operator", business_lines: ["Corporate Loans", "Intl Settlement"] },
  { user_id: "eu_02", name: "李明", department: "Corporate Lending", role: "approver", business_lines: ["Corporate Loans"] },
  { user_id: "eu_03", name: "王芳", department: "Retail Banking", role: "operator", business_lines: ["Retail Credit"] },
  { user_id: "eu_04", name: "陈军", department: "Risk Management", role: "viewer", business_lines: ["ALL"] },
  { user_id: "eu_05", name: "赵颖", department: "Compliance & Audit", role: "approver", business_lines: ["ALL"] },
  { user_id: "eu_06", name: "刘洋", department: "IT Department", role: "org_admin", business_lines: ["ALL"] },
  { user_id: "eu_07", name: "黄磊", department: "Retail Banking", role: "approver", business_lines: ["Retail Credit", "Wealth Management"] },
  { user_id: "eu_08", name: "孙娜", department: "Asset Management", role: "operator", business_lines: ["Wealth Management"] },
];

const roleColors: Record<string, { bg: string; text: string }> = {
  super_admin: { bg: "bg-purple-100", text: "text-purple-800" },
  org_admin:   { bg: "bg-blue-100",   text: "text-blue-800" },
  operator:    { bg: "bg-green-100",   text: "text-green-800" },
  approver:    { bg: "bg-amber-100",   text: "text-amber-800" },
  viewer:      { bg: "bg-gray-100",    text: "text-gray-700" },
};

const deptNameKeys: Record<string, MessageKey> = {
  "Corporate Lending": "permissions.blCorporateLending",
  "Syndicated Loans": "permissions.blSyndicatedLoans",
  "Trade Finance": "permissions.blTradeFinance",
  "Retail Banking": "permissions.blRetailBanking",
  "Personal Loans": "permissions.blPersonalLoans",
  "Credit Cards": "permissions.blCreditCards",
  "Asset Management": "permissions.blAssetManagement",
  "Risk Management": "permissions.blRiskManagement",
  "Compliance & Audit": "permissions.blComplianceAudit",
  "IT Department": "permissions.blITDepartment",
};

const roleNameKeys: Record<string, MessageKey> = {
  "super_admin": "permissions.roleSuperAdmin",
  "org_admin": "permissions.roleOrgAdmin",
  "operator": "permissions.roleOperator",
  "approver": "permissions.roleApprover",
  "viewer": "permissions.roleViewer",
};

const blNameKeys: Record<string, MessageKey> = {
  "Corporate Loans": "permissions.blCorporateLoans",
  "Intl Settlement": "permissions.blIntlSettlement",
  "Retail Credit": "permissions.blRetailCredit",
  "Wealth Management": "permissions.blWealthManagement",
  "Insurance": "permissions.blInsurance",
  "ALL": "permissions.blAll",
};

function DeptTree({
  departments,
  selectedId,
  onSelect,
  depth = 0,
}: {
  departments: Department[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth?: number;
}) {
  const { t } = useI18n();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(departments.map((d) => d.id)));

  return (
    <div>
      {departments.map((dept) => {
        const hasChildren = dept.children && dept.children.length > 0;
        const isExpanded = expandedIds.has(dept.id);
        const isSelected = selectedId === dept.id;

        return (
          <div key={dept.id}>
            <div
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                isSelected
                  ? "bg-blue-50 font-semibold"
                  : "hover:bg-gray-50",
              )}
              style={{
                paddingLeft: `${depth * 16 + 8}px`,
                color: isSelected ? "var(--finrpa-blue)" : "var(--finrpa-text-primary)",
              }}
              onClick={() => onSelect(dept.id)}
            >
              {hasChildren ? (
                <span
                  className="flex h-4 w-4 items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(dept.id)) next.delete(dept.id);
                      else next.add(dept.id);
                      return next;
                    });
                  }}
                >
                  <Icon name={isExpanded ? "chevron-down" : "chevron-up"} size={16} />
                </span>
              ) : (
                <span className="w-4" />
              )}
              <Icon name="department" size={16} />
              {deptNameKeys[dept.name] ? t(deptNameKeys[dept.name]!) : dept.name}
            </div>
            {hasChildren && isExpanded && (
              <DeptTree
                departments={dept.children!}
                selectedId={selectedId}
                onSelect={onSelect}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PermissionsPage() {
  const { t } = useI18n();
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  const filteredUsers = selectedDept
    ? demoUsers.filter((u) => {
        const dept = [...demoDepartments, ...demoDepartments.flatMap((d) => d.children ?? [])].find(
          (d) => d.id === selectedDept,
        );
        return dept ? u.department === dept.name : false;
      })
    : demoUsers;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Icon name="permissions" size={24} color="var(--finrpa-blue)" />
        <h1 className="text-xl font-bold" style={{ color: "var(--finrpa-blue)" }}>
          {t("permissions.title")}
        </h1>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Department Tree */}
        <div className="col-span-3">
          <GlassCard hoverable={false} padding="md">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
              <Icon name="department" size={16} color="var(--finrpa-blue)" />
              {t("permissions.departments")}
            </h3>
            <div
              className="mb-3 cursor-pointer rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
              style={{
                color: !selectedDept ? "var(--finrpa-blue)" : "var(--finrpa-text-secondary)",
                fontWeight: !selectedDept ? 600 : 400,
                background: !selectedDept ? "rgba(26,58,92,0.04)" : undefined,
              }}
              onClick={() => setSelectedDept(null)}
            >
              {t("permissions.allDepartments")}
            </div>
            <DeptTree
              departments={demoDepartments}
              selectedId={selectedDept}
              onSelect={setSelectedDept}
            />
          </GlassCard>
        </div>

        {/* User List */}
        <div className="col-span-9">
          <GlassCard hoverable={false} padding="md">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--finrpa-text-primary)" }}>
                <Icon name="user" size={16} color="var(--finrpa-blue)" />
                {t("permissions.users")} ({filteredUsers.length})
              </h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Icon name="search" size={16} color="var(--finrpa-text-muted)" className="absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className="glass-input pl-9 text-sm"
                    placeholder={t("permissions.searchUsers")}
                    style={{ width: 220 }}
                  />
                </div>
              </div>
            </div>

            <table className="glass-table">
              <thead>
                <tr>
                  <th>{t("permissions.name")}</th>
                  <th>{t("permissions.department")}</th>
                  <th>{t("permissions.role")}</th>
                  <th>{t("permissions.businessLines")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const rc = roleColors[user.role] ?? { bg: "bg-gray-100", text: "text-gray-700" };
                  return (
                    <tr key={user.user_id}>
                      <td className="font-medium">{user.name}</td>
                      <td>{deptNameKeys[user.department] ? t(deptNameKeys[user.department]!) : user.department}</td>
                      <td>
                        <span className={cn("glass-badge", rc.bg, rc.text)}>
                          {roleNameKeys[user.role] ? t(roleNameKeys[user.role]!) : user.role}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {user.business_lines.map((bl) => (
                            <span
                              key={bl}
                              className="rounded-md px-2 py-0.5 text-xs"
                              style={{
                                background: bl === "ALL" ? "var(--finrpa-gold)" : "rgba(26,58,92,0.06)",
                                color: bl === "ALL" ? "white" : "var(--finrpa-text-secondary)",
                                fontWeight: bl === "ALL" ? 600 : 400,
                              }}
                            >
                              {blNameKeys[bl] ? t(blNameKeys[bl]!) : bl}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
