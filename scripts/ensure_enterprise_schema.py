"""Ensure enterprise tables exist and seed default admin user.

Runs at container startup. Safe to call repeatedly (idempotent).
"""

import asyncio
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_STRING = os.environ.get(
    "DATABASE_STRING",
    "postgresql+psycopg://skyvern:skyvern@postgres:5432/skyvern",
)

DDL = """
-- Enterprise tables
CREATE TABLE IF NOT EXISTS departments (
    department_id VARCHAR PRIMARY KEY,
    organization_id VARCHAR NOT NULL REFERENCES organizations(organization_id),
    parent_id VARCHAR REFERENCES departments(department_id),
    department_name VARCHAR NOT NULL,
    department_code VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    modified_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT uq_org_dept_code UNIQUE(organization_id, department_code)
);
CREATE INDEX IF NOT EXISTS ix_departments_organization_id ON departments(organization_id);
CREATE INDEX IF NOT EXISTS ix_departments_parent_id ON departments(parent_id);
CREATE INDEX IF NOT EXISTS ix_departments_created_at ON departments(created_at);

CREATE TABLE IF NOT EXISTS business_lines (
    business_line_id VARCHAR PRIMARY KEY,
    organization_id VARCHAR NOT NULL REFERENCES organizations(organization_id),
    line_name VARCHAR NOT NULL,
    line_code VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    modified_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT uq_org_line_code UNIQUE(organization_id, line_code)
);
CREATE INDEX IF NOT EXISTS ix_business_lines_organization_id ON business_lines(organization_id);
CREATE INDEX IF NOT EXISTS ix_business_lines_created_at ON business_lines(created_at);

CREATE TABLE IF NOT EXISTS enterprise_users (
    user_id VARCHAR PRIMARY KEY,
    organization_id VARCHAR NOT NULL REFERENCES organizations(organization_id),
    username VARCHAR NOT NULL,
    password_hash VARCHAR NOT NULL,
    display_name VARCHAR NOT NULL,
    email VARCHAR,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    modified_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT uq_org_username UNIQUE(organization_id, username)
);
CREATE INDEX IF NOT EXISTS ix_enterprise_users_organization_id ON enterprise_users(organization_id);
CREATE INDEX IF NOT EXISTS ix_enterprise_users_created_at ON enterprise_users(created_at);

CREATE TABLE IF NOT EXISTS user_department_roles (
    user_id VARCHAR NOT NULL REFERENCES enterprise_users(user_id),
    department_id VARCHAR NOT NULL REFERENCES departments(department_id),
    role VARCHAR NOT NULL CHECK(role IN ('super_admin','org_admin','operator','approver','viewer')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY(user_id, department_id)
);

CREATE TABLE IF NOT EXISTS user_business_lines (
    user_id VARCHAR NOT NULL REFERENCES enterprise_users(user_id),
    business_line_id VARCHAR NOT NULL REFERENCES business_lines(business_line_id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY(user_id, business_line_id)
);

CREATE TABLE IF NOT EXISTS special_permissions (
    permission_id VARCHAR PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES enterprise_users(user_id),
    organization_id VARCHAR NOT NULL REFERENCES organizations(organization_id),
    permission_type VARCHAR NOT NULL CHECK(permission_type IN ('cross_org_read','cross_org_approve')),
    granted_by VARCHAR,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_permission_type UNIQUE(user_id, permission_type)
);
CREATE INDEX IF NOT EXISTS ix_special_permissions_user_id ON special_permissions(user_id);

CREATE TABLE IF NOT EXISTS task_extensions (
    extension_id VARCHAR PRIMARY KEY,
    task_id VARCHAR NOT NULL UNIQUE,
    organization_id VARCHAR NOT NULL REFERENCES organizations(organization_id),
    department_id VARCHAR NOT NULL REFERENCES departments(department_id),
    business_line_id VARCHAR REFERENCES business_lines(business_line_id),
    risk_level VARCHAR NOT NULL DEFAULT 'low' CHECK(risk_level IN ('low','medium','high','critical')),
    created_by VARCHAR NOT NULL REFERENCES enterprise_users(user_id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    modified_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_task_extensions_task_id ON task_extensions(task_id);
CREATE INDEX IF NOT EXISTS ix_task_extensions_organization_id ON task_extensions(organization_id);
CREATE INDEX IF NOT EXISTS ix_task_extensions_department_id ON task_extensions(department_id);
CREATE INDEX IF NOT EXISTS ix_task_extensions_business_line_id ON task_extensions(business_line_id);
CREATE INDEX IF NOT EXISTS ix_task_extensions_created_at ON task_extensions(created_at);
"""

# bcrypt hash of "admin" (rounds=12)
ADMIN_PASSWORD_HASH = "$2b$12$IE8wfujIVdrCZcYQmxz8Legoq2SIr4ZqnRdTXErRCB8zK2UTomBHG"

SEED_SQL = f"""
INSERT INTO organizations (organization_id, organization_name, created_at, modified_at)
VALUES ('锐智金融', '锐智金融科技', NOW(), NOW())
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO departments (department_id, organization_id, department_name, department_code)
VALUES ('dept_admin', '锐智金融', '管理部', 'ADMIN')
ON CONFLICT (department_id) DO NOTHING;

INSERT INTO enterprise_users (user_id, organization_id, username, password_hash, display_name, email, is_active)
VALUES ('eu_admin', '锐智金融', 'admin', '{ADMIN_PASSWORD_HASH}', '系统管理员', 'admin@finrpa.local', TRUE)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_department_roles (user_id, department_id, role)
VALUES ('eu_admin', 'dept_admin', 'org_admin')
ON CONFLICT (user_id, department_id) DO NOTHING;
"""


async def main() -> None:
    engine = create_async_engine(DATABASE_STRING)
    async with engine.begin() as conn:
        # Create tables
        for stmt in DDL.split(";"):
            stmt = stmt.strip()
            if stmt:
                await conn.execute(text(stmt))

        # Seed default admin
        for stmt in SEED_SQL.split(";"):
            stmt = stmt.strip()
            if stmt:
                await conn.execute(text(stmt))

    await engine.dispose()
    print("Enterprise schema and seed data OK.")


if __name__ == "__main__":
    asyncio.run(main())
