-- ============================================================================
-- FinRPA Enterprise - Demo Seed Data
-- Target: 1 bank org, 5 departments, 4 business lines, 15+ users
-- Password: demo123 (bcrypt hash below, generated with rounds=12)
-- ============================================================================

-- bcrypt hash for "demo123"
-- $2b$12$LJ3m4ys3Lk0TSwMBQEBMxOZ8rFGnBNAqd1A4z8eUwIDBPIGX5mMCa

BEGIN;

-- ============================================================================
-- Organization
-- ============================================================================
INSERT INTO organizations (organization_id, organization_name, created_at, modified_at)
VALUES ('o_demo_cmb', 'China Merchants Bank (Demo)', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Departments (5 + IT = 6)
-- ============================================================================
INSERT INTO departments (department_id, organization_id, department_name, department_code, created_at, modified_at) VALUES
    ('dept_corp_credit',  'o_demo_cmb', '对公信贷部', 'CORP_CREDIT',  NOW(), NOW()),
    ('dept_personal_fin', 'o_demo_cmb', '个人金融部', 'PERSONAL_FIN', NOW(), NOW()),
    ('dept_asset_mgmt',   'o_demo_cmb', '资产管理部', 'ASSET_MGMT',   NOW(), NOW()),
    ('dept_risk_mgmt',    'o_demo_cmb', '风险管理部', 'RISK_MGMT',    NOW(), NOW()),
    ('dept_compliance',   'o_demo_cmb', '合规审计部', 'COMPLIANCE',   NOW(), NOW()),
    ('dept_it',           'o_demo_cmb', '信息技术部', 'IT',           NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Business Lines (4)
-- ============================================================================
INSERT INTO business_lines (business_line_id, organization_id, line_name, line_code, created_at, modified_at) VALUES
    ('bl_corp_loan',    'o_demo_cmb', '对公贷款',   'CORP_LOAN',    NOW(), NOW()),
    ('bl_retail_credit', 'o_demo_cmb', '零售信贷',   'RETAIL_CREDIT', NOW(), NOW()),
    ('bl_wealth_mgmt',  'o_demo_cmb', '财富管理',   'WEALTH_MGMT',  NOW(), NOW()),
    ('bl_intl_settle',  'o_demo_cmb', '国际结算',   'INTL_SETTLE',  NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Enterprise Users (16 users)
-- Password hash for "demo123" with bcrypt
-- ============================================================================
INSERT INTO enterprise_users (user_id, organization_id, username, password_hash, display_name, email, is_active, created_at, modified_at) VALUES
    -- IT Department
    ('eu_admin',           'o_demo_cmb', 'banking_admin',       '$2b$12$LJ3m4ys3Lk0TSwMBQEBMxOZ8rFGnBNAqd1A4z8eUwIDBPIGX5mMCa', '系统管理员',   'admin@demo.bank',       true, NOW(), NOW()),
    -- Corporate Credit Department
    ('eu_cc_op1',          'o_demo_cmb', 'credit_operator',     '$2b$12$LJ3m4ys3Lk0TSwMBQEBMxOZ8rFGnBNAqd1A4z8eUwIDBPIGX5mMCa', '张明（对公操作员）',    'zhang.ming@demo.bank',    true, NOW(), NOW()),
    ('eu_cc_op2',          'o_demo_cmb', 'credit_operator2',    '$2b$12$LJ3m4ys3Lk0TSwMBQEBMxOZ8rFGnBNAqd1A4z8eUwIDBPIGX5mMCa', '刘洋（对公操作员2）',   'liu.yang@demo.bank',      true, NOW(), NOW()),
    ('eu_cc_approver',     'o_demo_cmb', 'credit_approver',     '$2b$12$LJ3m4ys3Lk0TSwMBQEBMxOZ8rFGnBNAqd1A4z8eUwIDBPIGX5mMCa', '王芳（对公审批员）',    'wang.fang@demo.bank',     true, NOW(), NOW()),
    ('eu_cc_viewer',       'o_demo_cmb', 'credit_viewer',       '$2b$12$LJ3m4ys3Lk0TSwMBQEBMxOZ8rFGnBNAqd1A4z8eUwIDBPIGX5mMCa', '陈静（对公只读）',     'chen.jing@demo.bank',     true, NOW(), NOW()),
    -- Cross business line operator (corp credit + intl settlement)
    ('eu_cc_cross',        'o_demo_cmb', 'credit_cross_op',     '$2b$12$LJ3m4ys3Lk0TSwMBQEBMxOZ8rFGnBNAqd1A4z8eUwIDBPIGX5mMCa', '赵磊（跨业务线操作员）',  'zhao.lei@demo.bank',      true, NOW(), NOW()),
    -- Personal Finance Department
    ('eu_pf_op',           'o_demo_cmb', 'personal_operator',   '$2b$12$LJ3m4ys3Lk0TSwMBQEBMxOZ8rFGnBNAqd1A4z8eUwIDBPIGX5mMCa', '李娜（个金操作员）',    'li.na@demo.bank',         true, NOW(), NOW()),
    ('eu_pf_approver',     'o_demo_cmb', 'personal_approver',   '$2b$12$LJ3m4ys3Lk0TSwMBQEBMxOZ8rFGnBNAqd1A4z8eUwIDBPIGX5mMCa', '周强（个金审批员）',    'zhou.qiang@demo.bank',    true, NOW(), NOW()),
    -- Asset Management Department
    ('eu_am_op',           'o_demo_cmb', 'asset_operator',      '$2b$12$LJ3m4ys3Lk0TSwMBQEBMxOZ8rFGnBNAqd1A4z8eUwIDBPIGX5mMCa', '孙伟（资管操作员）',    'sun.wei@demo.bank',       true, NOW(), NOW()),
    ('eu_am_approver',     'o_demo_cmb', 'asset_approver',      '$2b$12$LJ3m4ys3Lk0TSwMBQEBMxOZ8rFGnBNAqd1A4z8eUwIDBPIGX5mMCa', '吴敏（资管审批员）',    'wu.min@demo.bank',        true, NOW(), NOW()),
    -- Risk Management Department
    ('eu_risk_viewer1',    'o_demo_cmb', 'risk_viewer',         '$2b$12$LJ3m4ys3Lk0TSwMBQEBMxOZ8rFGnBNAqd1A4z8eUwIDBPIGX5mMCa', '黄涛（风控查看员）',    'huang.tao@demo.bank',     true, NOW(), NOW()),
    ('eu_risk_viewer2',    'o_demo_cmb', 'risk_viewer2',        '$2b$12$LJ3m4ys3Lk0TSwMBQEBMxOZ8rFGnBNAqd1A4z8eUwIDBPIGX5mMCa', '马丽（风控查看员2）',   'ma.li@demo.bank',         true, NOW(), NOW()),
    -- Compliance & Audit Department
    ('eu_comp_approver',   'o_demo_cmb', 'compliance_approver', '$2b$12$LJ3m4ys3Lk0TSwMBQEBMxOZ8rFGnBNAqd1A4z8eUwIDBPIGX5mMCa', '杨超（合规审批员）',    'yang.chao@demo.bank',     true, NOW(), NOW()),
    ('eu_comp_viewer',     'o_demo_cmb', 'compliance_viewer',   '$2b$12$LJ3m4ys3Lk0TSwMBQEBMxOZ8rFGnBNAqd1A4z8eUwIDBPIGX5mMCa', '林燕（合规查看员）',    'lin.yan@demo.bank',       true, NOW(), NOW()),
    -- IT Department additional
    ('eu_it_op',           'o_demo_cmb', 'it_operator',         '$2b$12$LJ3m4ys3Lk0TSwMBQEBMxOZ8rFGnBNAqd1A4z8eUwIDBPIGX5mMCa', '徐鹏（IT操作员）',     'xu.peng@demo.bank',       true, NOW(), NOW()),
    -- Inactive user (for testing)
    ('eu_inactive',        'o_demo_cmb', 'inactive_user',       '$2b$12$LJ3m4ys3Lk0TSwMBQEBMxOZ8rFGnBNAqd1A4z8eUwIDBPIGX5mMCa', '已离职用户',          'inactive@demo.bank',      false, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- User-Department-Role Assignments
-- ============================================================================
INSERT INTO user_department_roles (user_id, department_id, role, created_at) VALUES
    -- IT admin (super_admin in IT dept)
    ('eu_admin',         'dept_it',           'super_admin', NOW()),
    -- Corporate Credit operators and approver
    ('eu_cc_op1',        'dept_corp_credit',  'operator',    NOW()),
    ('eu_cc_op2',        'dept_corp_credit',  'operator',    NOW()),
    ('eu_cc_approver',   'dept_corp_credit',  'approver',    NOW()),
    ('eu_cc_viewer',     'dept_corp_credit',  'viewer',      NOW()),
    ('eu_cc_cross',      'dept_corp_credit',  'operator',    NOW()),
    -- Personal Finance
    ('eu_pf_op',         'dept_personal_fin', 'operator',    NOW()),
    ('eu_pf_approver',   'dept_personal_fin', 'approver',    NOW()),
    -- Asset Management
    ('eu_am_op',         'dept_asset_mgmt',   'operator',    NOW()),
    ('eu_am_approver',   'dept_asset_mgmt',   'approver',    NOW()),
    -- Risk Management (viewer role - cross-org read via special_permissions)
    ('eu_risk_viewer1',  'dept_risk_mgmt',    'viewer',      NOW()),
    ('eu_risk_viewer2',  'dept_risk_mgmt',    'viewer',      NOW()),
    -- Compliance (approver role - cross-org approve via special_permissions)
    ('eu_comp_approver', 'dept_compliance',   'approver',    NOW()),
    ('eu_comp_viewer',   'dept_compliance',   'viewer',      NOW()),
    -- IT operator
    ('eu_it_op',         'dept_it',           'operator',    NOW()),
    -- Inactive user was in personal finance
    ('eu_inactive',      'dept_personal_fin', 'operator',    NOW())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- User-Business Line Assignments
-- ============================================================================
INSERT INTO user_business_lines (user_id, business_line_id, created_at) VALUES
    -- Corp Credit users -> Corp Loan
    ('eu_cc_op1',        'bl_corp_loan',     NOW()),
    ('eu_cc_op2',        'bl_corp_loan',     NOW()),
    ('eu_cc_approver',   'bl_corp_loan',     NOW()),
    ('eu_cc_viewer',     'bl_corp_loan',     NOW()),
    -- Cross business line operator: Corp Loan + Intl Settlement
    ('eu_cc_cross',      'bl_corp_loan',     NOW()),
    ('eu_cc_cross',      'bl_intl_settle',   NOW()),
    -- Personal Finance -> Retail Credit
    ('eu_pf_op',         'bl_retail_credit', NOW()),
    ('eu_pf_approver',   'bl_retail_credit', NOW()),
    -- Asset Management -> Wealth Management
    ('eu_am_op',         'bl_wealth_mgmt',   NOW()),
    ('eu_am_approver',   'bl_wealth_mgmt',   NOW()),
    -- IT operator -> Corp Loan (for testing)
    ('eu_it_op',         'bl_corp_loan',     NOW())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Special Permissions (cross-department visibility)
-- ============================================================================
INSERT INTO special_permissions (permission_id, user_id, organization_id, permission_type, granted_by, created_at) VALUES
    -- Risk Management: cross-org read
    ('sp_risk_v1_read',  'eu_risk_viewer1',  'o_demo_cmb', 'cross_org_read',    'eu_admin', NOW()),
    ('sp_risk_v2_read',  'eu_risk_viewer2',  'o_demo_cmb', 'cross_org_read',    'eu_admin', NOW()),
    -- Compliance: cross-org read + approve
    ('sp_comp_ap_read',  'eu_comp_approver', 'o_demo_cmb', 'cross_org_read',    'eu_admin', NOW()),
    ('sp_comp_ap_appr',  'eu_comp_approver', 'o_demo_cmb', 'cross_org_approve', 'eu_admin', NOW()),
    ('sp_comp_vw_read',  'eu_comp_viewer',   'o_demo_cmb', 'cross_org_read',    'eu_admin', NOW())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Sample Task Extensions (for permission testing)
-- ============================================================================
INSERT INTO task_extensions (extension_id, task_id, organization_id, department_id, business_line_id, risk_level, created_by, created_at, modified_at) VALUES
    -- Corp Credit tasks
    ('te_cc_task1', 'tsk_demo_001', 'o_demo_cmb', 'dept_corp_credit',  'bl_corp_loan',     'low',      'eu_cc_op1',  NOW(), NOW()),
    ('te_cc_task2', 'tsk_demo_002', 'o_demo_cmb', 'dept_corp_credit',  'bl_corp_loan',     'high',     'eu_cc_op1',  NOW(), NOW()),
    ('te_cc_task3', 'tsk_demo_003', 'o_demo_cmb', 'dept_corp_credit',  'bl_intl_settle',   'critical', 'eu_cc_cross', NOW(), NOW()),
    -- Personal Finance tasks
    ('te_pf_task1', 'tsk_demo_004', 'o_demo_cmb', 'dept_personal_fin', 'bl_retail_credit', 'low',      'eu_pf_op',   NOW(), NOW()),
    ('te_pf_task2', 'tsk_demo_005', 'o_demo_cmb', 'dept_personal_fin', 'bl_retail_credit', 'medium',   'eu_pf_op',   NOW(), NOW()),
    -- Asset Management tasks
    ('te_am_task1', 'tsk_demo_006', 'o_demo_cmb', 'dept_asset_mgmt',   'bl_wealth_mgmt',   'low',      'eu_am_op',   NOW(), NOW())
ON CONFLICT DO NOTHING;

COMMIT;
