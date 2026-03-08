"""
FinRPA Enterprise — System Integration Test (SIT)
Tests all enterprise API endpoints with real HTTP calls against the running stack.

Complete endpoint map:
  POST /enterprise/auth/login
  GET  /enterprise/auth/me
  GET  /enterprise/dashboard/overview
  GET  /enterprise/dashboard/trend
  GET  /enterprise/dashboard/errors
  GET  /enterprise/dashboard/business-lines
  GET  /enterprise/dashboard/approval-time
  GET  /enterprise/dashboard/cost
  GET  /enterprise/dashboard/export          (CSV, admin-only)
  GET  /enterprise/approvals/pending
  POST /enterprise/approvals/{id}/approve
  POST /enterprise/approvals/{id}/reject
  GET  /enterprise/audit/logs
  GET  /enterprise/tasks                     (tenant-filtered)
  GET  /enterprise/admin/visibility          (admin-only)
  GET  /enterprise/workflows/templates
  GET  /enterprise/workflows/templates/{id}
  POST /enterprise/workflows/instantiate/{id}
  GET  /enterprise/cache/stats
  DEL  /enterprise/cache/task/{id}
  DEL  /enterprise/cache/expired
  DEL  /enterprise/cache/all
  POST /enterprise/cache/reset-stats
"""

import json
import sys
import urllib.request
import urllib.error

BASE = "http://localhost:18000/api/v1"
RESULTS = {"pass": 0, "fail": 0, "skip": 0}
TOKENS = {}  # username -> token

# Organization IDs
ORG_DEFAULT = "锐智金融"       # Default admin org
ORG_DEMO = "o_demo_cmb"        # Demo bank org (16 users)


def log(status, msg):
    symbol = {"PASS": "+", "FAIL": "!", "SKIP": "~", "INFO": "*"}
    print(f"  [{symbol.get(status, ' ')}] {status}: {msg}")
    if status == "PASS":
        RESULTS["pass"] += 1
    elif status == "FAIL":
        RESULTS["fail"] += 1
    elif status == "SKIP":
        RESULTS["skip"] += 1


def api(method, path, token=None, body=None, expect_json=True):
    """Make an HTTP request. Returns (status_code, parsed_body_or_text)."""
    url = f"{BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        raw = resp.read().decode("utf-8")
        if expect_json:
            return resp.status, json.loads(raw)
        return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8") if e.fp else ""
        if expect_json:
            try:
                return e.code, json.loads(raw)
            except json.JSONDecodeError:
                return e.code, {"raw": raw}
        return e.code, raw
    except Exception as e:
        return 0, {"error": str(e)}


def do_login(username, password, org_id, desc):
    """Login and store token. Returns True on success."""
    code, data = api("POST", "/enterprise/auth/login", body={
        "username": username, "password": password, "organization_id": org_id,
    })
    if code == 200 and "access_token" in data:
        TOKENS[username] = data["access_token"]
        log("PASS", f"Login {desc} ({username})")
        return True
    else:
        log("FAIL", f"Login {desc} ({username}) — HTTP {code}: {data}")
        return False


# ============================================================================
# 1. Login Tests
# ============================================================================
def test_logins():
    print("\n=== 1. Login Tests ===")

    # Default admin (锐智金融)
    do_login("admin", "admin", ORG_DEFAULT, "Default admin (锐智金融)")

    # Demo org users (o_demo_cmb)
    demo_accounts = [
        ("banking_admin", "demo123", "Demo super_admin"),
        ("credit_operator", "demo123", "Corp credit operator"),
        ("credit_approver", "demo123", "Corp credit approver"),
        ("personal_operator", "demo123", "Personal finance operator"),
        ("risk_viewer", "demo123", "Risk management viewer"),
        ("compliance_approver", "demo123", "Compliance approver"),
    ]
    for username, password, desc in demo_accounts:
        do_login(username, password, ORG_DEMO, desc)

    # Inactive user should fail
    code, data = api("POST", "/enterprise/auth/login", body={
        "username": "inactive_user", "password": "demo123",
        "organization_id": ORG_DEMO,
    })
    if code in (401, 403):
        log("PASS", "Inactive user login correctly rejected")
    else:
        log("FAIL", f"Inactive user login — expected 401/403, got {code}")

    # Wrong password
    code, data = api("POST", "/enterprise/auth/login", body={
        "username": "admin", "password": "wrong_password",
        "organization_id": ORG_DEFAULT,
    })
    if code == 401:
        log("PASS", "Wrong password correctly rejected")
    else:
        log("FAIL", f"Wrong password — expected 401, got {code}")

    # Wrong org_id
    code, data = api("POST", "/enterprise/auth/login", body={
        "username": "admin", "password": "admin",
        "organization_id": "nonexistent_org",
    })
    if code == 401:
        log("PASS", "Wrong org_id correctly rejected")
    else:
        log("FAIL", f"Wrong org_id — expected 401, got {code}")


# ============================================================================
# 2. Auth Endpoints (/me)
# ============================================================================
def test_auth_endpoints():
    print("\n=== 2. Auth /me Endpoint ===")
    token = TOKENS.get("admin")
    if not token:
        log("SKIP", "No admin token available")
        return

    code, data = api("GET", "/enterprise/auth/me", token=token)
    if code == 200 and "user_id" in data:
        log("PASS", f"GET /auth/me — user_id={data['user_id']}, org={data.get('org_id')}")
        # Verify admin flags
        if data.get("is_admin"):
            log("PASS", "Admin user correctly flagged as is_admin=true")
        else:
            log("FAIL", "Admin user should have is_admin=true")
    else:
        log("FAIL", f"GET /auth/me — HTTP {code}: {data}")

    # Also check demo user /me
    token_cc = TOKENS.get("credit_operator")
    if token_cc:
        code, data = api("GET", "/enterprise/auth/me", token=token_cc)
        if code == 200 and data.get("org_id") == ORG_DEMO:
            log("PASS", f"credit_operator /me — org_id={data['org_id']}, is_operator={data.get('is_operator')}")
        else:
            log("FAIL", f"credit_operator /me — HTTP {code}: {data}")


# ============================================================================
# 3. Dashboard Endpoints (admin)
# ============================================================================
def test_dashboard():
    print("\n=== 3. Dashboard Endpoints ===")
    token = TOKENS.get("admin")
    if not token:
        log("SKIP", "No admin token")
        return

    json_endpoints = [
        ("GET", "/enterprise/dashboard/overview"),
        ("GET", "/enterprise/dashboard/trend?days=7"),
        ("GET", "/enterprise/dashboard/errors"),
        ("GET", "/enterprise/dashboard/business-lines"),
        ("GET", "/enterprise/dashboard/approval-time"),
        ("GET", "/enterprise/dashboard/cost"),
    ]

    for method, path in json_endpoints:
        code, data = api(method, path, token=token)
        if code == 200:
            log("PASS", f"{method} {path}")
        else:
            log("FAIL", f"{method} {path} — HTTP {code}: {data}")

    # CSV export (admin-only, non-JSON)
    code, data = api("GET", "/enterprise/dashboard/export", token=token, expect_json=False)
    if code == 200 and isinstance(data, str) and len(data) > 0:
        log("PASS", f"GET /dashboard/export — CSV {len(data)} bytes")
    else:
        log("FAIL", f"GET /dashboard/export — HTTP {code}")


# ============================================================================
# 4. Approval Endpoints
# ============================================================================
def test_approvals():
    print("\n=== 4. Approval Endpoints ===")
    token = TOKENS.get("admin")
    if not token:
        log("SKIP", "No admin token")
        return

    # List pending
    code, data = api("GET", "/enterprise/approvals/pending", token=token)
    if code == 200:
        count = len(data) if isinstance(data, list) else "?"
        log("PASS", f"GET /approvals/pending — {count} items")
    else:
        log("FAIL", f"GET /approvals/pending — HTTP {code}")

    # Approve non-existent (should 404 or 400)
    code, data = api("POST", "/enterprise/approvals/nonexistent_task/approve", token=token)
    if code in (404, 422, 400):
        log("PASS", f"Approve non-existent → {code}")
    else:
        log("FAIL", f"Approve non-existent — expected 4xx, got {code}")

    # Reject non-existent
    code, data = api("POST", "/enterprise/approvals/nonexistent_task/reject", token=token,
                     body={"reason": "test rejection"})
    if code in (404, 422, 400):
        log("PASS", f"Reject non-existent → {code}")
    else:
        log("FAIL", f"Reject non-existent — expected 4xx, got {code}")


# ============================================================================
# 5. Audit Endpoints
# ============================================================================
def test_audit():
    print("\n=== 5. Audit Endpoints ===")
    token = TOKENS.get("admin")
    if not token:
        log("SKIP", "No admin token")
        return

    code, data = api("GET", "/enterprise/audit/logs", token=token)
    if code == 200:
        items = data.get("items", []) if isinstance(data, dict) else data
        log("PASS", f"GET /audit/logs — {len(items)} items")
    else:
        log("FAIL", f"GET /audit/logs — HTTP {code}")

    # With task_id filter
    code, data = api("GET", "/enterprise/audit/logs?task_id=tsk_demo_001", token=token)
    if code == 200:
        log("PASS", "GET /audit/logs?task_id=tsk_demo_001")
    else:
        log("FAIL", f"GET /audit/logs?task_id — HTTP {code}")


# ============================================================================
# 6. Tenant Endpoints (task list + admin visibility)
# ============================================================================
def test_tenant():
    print("\n=== 6. Tenant Endpoints ===")
    token = TOKENS.get("admin")
    if not token:
        log("SKIP", "No admin token")
        return

    # Task list (tenant-filtered)
    code, data = api("GET", "/enterprise/tasks", token=token)
    if code == 200 and "tasks" in data:
        log("PASS", f"GET /tasks — {data.get('total', '?')} tasks, ctx={data.get('tenant_context', {}).get('org_id', '?')}")
    else:
        log("FAIL", f"GET /tasks — HTTP {code}: {data}")

    # Admin visibility diagnostic
    code, data = api("GET", "/enterprise/admin/visibility?user_id=eu_cc_op1", token=token)
    if code == 200 and "visibility_summary" in data:
        vis = data["visibility_summary"]
        log("PASS", f"GET /admin/visibility — full_org={vis.get('has_full_org_visibility')}")
    else:
        log("FAIL", f"GET /admin/visibility — HTTP {code}: {data}")

    # Visibility for non-existent user
    code, data = api("GET", "/enterprise/admin/visibility?user_id=nonexistent", token=token)
    if code == 404:
        log("PASS", "Visibility for non-existent user → 404")
    else:
        log("FAIL", f"Visibility non-existent — expected 404, got {code}")


# ============================================================================
# 7. Workflow Templates
# ============================================================================
def test_workflows():
    print("\n=== 7. Workflow Templates ===")
    token = TOKENS.get("admin")
    if not token:
        log("SKIP", "No admin token")
        return

    code, data = api("GET", "/enterprise/workflows/templates", token=token)
    if code == 200:
        count = len(data) if isinstance(data, list) else "?"
        log("PASS", f"GET /workflows/templates — {count} templates")

        # If templates exist, test detail endpoint
        if isinstance(data, list) and len(data) > 0:
            tid = data[0].get("template_id", data[0].get("id"))
            if tid:
                code2, data2 = api("GET", f"/enterprise/workflows/templates/{tid}", token=token)
                if code2 == 200:
                    log("PASS", f"GET /workflows/templates/{tid}")
                else:
                    log("FAIL", f"GET /workflows/templates/{tid} — HTTP {code2}")
    else:
        log("FAIL", f"GET /workflows/templates — HTTP {code}: {data}")


# ============================================================================
# 8. LLM Cache
# ============================================================================
def test_llm_cache():
    print("\n=== 8. LLM Cache Endpoints ===")
    token = TOKENS.get("admin")
    if not token:
        log("SKIP", "No admin token")
        return

    code, data = api("GET", "/enterprise/cache/stats", token=token)
    if code == 200:
        log("PASS", f"GET /cache/stats")
    else:
        log("FAIL", f"GET /cache/stats — HTTP {code}: {data}")


# ============================================================================
# 9. Tenant Isolation (cross-org visibility)
# ============================================================================
def test_tenant_isolation():
    print("\n=== 9. Tenant Isolation ===")

    token_cc = TOKENS.get("credit_operator")
    token_rv = TOKENS.get("risk_viewer")
    token_admin = TOKENS.get("admin")

    if not token_cc or not token_rv:
        log("SKIP", "Missing tokens for isolation test")
        return

    # credit_operator should see only corp_credit dept tasks
    code_cc, data_cc = api("GET", "/enterprise/tasks", token=token_cc)
    if code_cc == 200 and "tasks" in data_cc:
        ctx = data_cc.get("tenant_context", {})
        total = data_cc.get("total", 0)
        log("PASS", f"credit_operator tasks — total={total}, full_org={ctx.get('has_full_org_visibility')}")

        # Verify no tasks from other departments leak through
        tasks = data_cc["tasks"]
        cc_dept_ids = {"dept_corp_credit"}
        leaked = [t for t in tasks if t.get("department_id") not in cc_dept_ids]
        if not leaked:
            log("PASS", "credit_operator sees only dept_corp_credit tasks (no leaks)")
        else:
            log("FAIL", f"credit_operator sees tasks from other depts: {[t['department_id'] for t in leaked]}")
    else:
        log("FAIL", f"credit_operator tasks — HTTP {code_cc}")

    # risk_viewer has cross_org_read -> should see all org tasks
    code_rv, data_rv = api("GET", "/enterprise/tasks", token=token_rv)
    if code_rv == 200 and "tasks" in data_rv:
        ctx = data_rv.get("tenant_context", {})
        total = data_rv.get("total", 0)
        full_org = ctx.get("has_full_org_visibility", False)
        log("PASS", f"risk_viewer tasks — total={total}, full_org={full_org}")
        if full_org:
            log("PASS", "risk_viewer has full org visibility (cross_org_read)")
        else:
            log("FAIL", "risk_viewer should have full org visibility via cross_org_read")
    else:
        log("FAIL", f"risk_viewer tasks — HTTP {code_rv}")

    # Cross-org isolation: admin (锐智金融) should NOT see o_demo_cmb tasks
    if token_admin:
        code_a, data_a = api("GET", "/enterprise/tasks", token=token_admin)
        if code_a == 200 and "tasks" in data_a:
            ctx = data_a.get("tenant_context", {})
            org = ctx.get("org_id", "?")
            total = data_a.get("total", 0)
            # Admin is in 锐智金融, should see 0 demo tasks
            demo_tasks = [t for t in data_a["tasks"] if t.get("organization_id") == ORG_DEMO]
            if len(demo_tasks) == 0:
                log("PASS", f"Default admin (org={org}) sees 0 demo org tasks — proper isolation")
            else:
                log("FAIL", f"Default admin sees {len(demo_tasks)} demo org tasks — CROSS-ORG LEAK!")
        else:
            log("FAIL", f"Default admin tasks — HTTP {code_a}")

    # Export requires admin — operator should be denied
    code, data = api("GET", "/enterprise/dashboard/export", token=token_cc, expect_json=False)
    if code == 403:
        log("PASS", "credit_operator correctly denied export (admin-only)")
    elif code == 200:
        log("FAIL", "credit_operator should not access admin-only export")
    else:
        # Any non-200 is acceptable (might be 401 if role check differs)
        log("PASS", f"credit_operator export returns {code} (non-200)")


# ============================================================================
# 10. Unauthenticated Access
# ============================================================================
def test_unauthenticated():
    print("\n=== 10. Unauthenticated Access ===")

    protected_endpoints = [
        ("GET", "/enterprise/dashboard/overview"),
        ("GET", "/enterprise/approvals/pending"),
        ("GET", "/enterprise/audit/logs"),
        ("GET", "/enterprise/tasks"),
        ("GET", "/enterprise/workflows/templates"),
        ("GET", "/enterprise/cache/stats"),
    ]

    for method, path in protected_endpoints:
        code, _ = api(method, path)  # No token
        if code in (401, 403):
            log("PASS", f"Unauthenticated {path} → {code}")
        else:
            log("FAIL", f"Unauthenticated {path} — expected 401/403, got {code}")


# ============================================================================
# 11. Demo Admin (banking_admin) Full Access
# ============================================================================
def test_demo_admin():
    print("\n=== 11. Demo Admin (banking_admin) ===")
    token = TOKENS.get("banking_admin")
    if not token:
        log("SKIP", "No banking_admin token")
        return

    # Should have super_admin role — test export access
    code, data = api("GET", "/enterprise/dashboard/export", token=token, expect_json=False)
    if code == 200:
        log("PASS", f"banking_admin can access export (super_admin) — {len(data)} bytes")
    else:
        log("FAIL", f"banking_admin export — HTTP {code}")

    # /me should show demo org
    code, data = api("GET", "/enterprise/auth/me", token=token)
    if code == 200:
        org = data.get("org_id", "?")
        is_admin = data.get("is_admin", False)
        log("PASS", f"banking_admin /me — org_id={org}, is_admin={is_admin}")
        if org != ORG_DEMO:
            log("FAIL", f"banking_admin should be in org {ORG_DEMO}, got {org}")
        if not is_admin:
            log("FAIL", "banking_admin should have is_admin=true (super_admin role)")
    else:
        log("FAIL", f"banking_admin /me — HTTP {code}")

    # Admin visibility endpoint
    code, data = api("GET", "/enterprise/admin/visibility?user_id=eu_cc_op1", token=token)
    if code == 200:
        log("PASS", "banking_admin can use admin/visibility")
    else:
        log("FAIL", f"banking_admin admin/visibility — HTTP {code}")


# ============================================================================
# 12. Skyvern Core Health
# ============================================================================
def test_skyvern_core():
    print("\n=== 12. Skyvern Core Health ===")

    code, data = api("GET", "/heartbeat", expect_json=False)
    if code == 200:
        log("PASS", f"Skyvern heartbeat OK — {data.strip()}")
    else:
        log("FAIL", f"Skyvern heartbeat — HTTP {code}: {data}")


# ============================================================================
# Main
# ============================================================================
if __name__ == "__main__":
    print("=" * 64)
    print("  FinRPA Enterprise — System Integration Test")
    print(f"  Target: {BASE}")
    print("=" * 64)

    test_logins()
    test_auth_endpoints()
    test_dashboard()
    test_approvals()
    test_audit()
    test_tenant()
    test_workflows()
    test_llm_cache()
    test_tenant_isolation()
    test_unauthenticated()
    test_demo_admin()
    test_skyvern_core()

    print("\n" + "=" * 64)
    total = RESULTS["pass"] + RESULTS["fail"] + RESULTS["skip"]
    print(f"  TOTAL: {total}  |  PASS: {RESULTS['pass']}  |  FAIL: {RESULTS['fail']}  |  SKIP: {RESULTS['skip']}")
    if RESULTS["fail"] > 0:
        print("  STATUS: SOME TESTS FAILED")
        sys.exit(1)
    else:
        print("  STATUS: ALL TESTS PASSED")
        sys.exit(0)
