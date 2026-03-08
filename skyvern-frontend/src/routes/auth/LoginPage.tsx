import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/useI18n";
import { useAuthStore } from "@/store/AuthStore";
import { apiBaseUrl } from "@/util/env";

type OrgOption = { organization_id: string; organization_name: string };

const authEndpoint = `${apiBaseUrl}/enterprise/auth/login`;
const orgsEndpoint = `${apiBaseUrl}/enterprise/auth/organizations`;

export function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios
      .get<OrgOption[]>(orgsEndpoint)
      .then(({ data }) => {
        setOrganizations(data);
        const first = data[0];
        if (first) {
          setOrganizationId(first.organization_id);
        }
      })
      .catch(() => {
        // Fallback if API unavailable
        setOrganizations([
          { organization_id: "锐智金融", organization_name: "锐智金融科技" },
        ]);
        setOrganizationId("锐智金融");
      });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await axios.post(authEndpoint, {
        username,
        password,
        organization_id: organizationId,
      });

      login(data.access_token, data.user_id, data.display_name);
      navigate("/");
    } catch {
      setError(t("auth.loginFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="glass-page"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "var(--space-md)",
      }}
    >
      {/* Decorative background blobs */}
      <div
        style={{
          position: "fixed",
          top: "-15%",
          left: "-10%",
          width: "45vw",
          height: "45vw",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(26,58,92,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: "-20%",
          right: "-10%",
          width: "50vw",
          height: "50vw",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--glass-shadow)",
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          padding: "var(--space-2xl) var(--space-xl)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "var(--space-lg)",
          }}
        >
          <Logo />
        </div>

        {/* Title */}
        <h1
          style={{
            textAlign: "center",
            fontSize: 20,
            fontWeight: 700,
            color: "var(--finrpa-blue)",
            margin: 0,
            marginBottom: "var(--space-xs)",
          }}
        >
          {t("auth.welcomeTitle")}
        </h1>
        <p
          style={{
            textAlign: "center",
            fontSize: 14,
            color: "var(--finrpa-text-muted)",
            margin: 0,
            marginBottom: "var(--space-xl)",
          }}
        >
          {t("auth.welcomeDesc")}
        </p>

        {/* Error banner */}
        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: "var(--radius-sm)",
              padding: "var(--space-sm) var(--space-md)",
              marginBottom: "var(--space-md)",
              color: "#DC2626",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "var(--space-md)" }}>
            <Label
              htmlFor="organizationId"
              style={{ color: "var(--finrpa-text-secondary)", marginBottom: 6, display: "block" }}
            >
              {t("auth.organizationId")}
            </Label>
            <select
              id="organizationId"
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              className="glass-input"
              style={{ width: "100%", height: 40, borderRadius: "var(--radius-sm)" }}
              required
            >
              {organizations.map((org) => (
                <option key={org.organization_id} value={org.organization_id}>
                  {org.organization_name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "var(--space-md)" }}>
            <Label
              htmlFor="username"
              style={{ color: "var(--finrpa-text-secondary)", marginBottom: 6, display: "block" }}
            >
              {t("auth.username")}
            </Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="glass-input"
              style={{ width: "100%", height: 40 }}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div style={{ marginBottom: "var(--space-lg)" }}>
            <Label
              htmlFor="password"
              style={{ color: "var(--finrpa-text-secondary)", marginBottom: 6, display: "block" }}
            >
              {t("auth.password")}
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input"
              style={{ width: "100%", height: 40 }}
              autoComplete="current-password"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="glass-btn-primary"
            style={{
              width: "100%",
              height: 42,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "0.04em",
              borderRadius: "var(--radius-md)",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "..." : t("auth.loginButton")}
          </Button>
        </form>

        {/* Footer accent line */}
        <div
          style={{
            marginTop: "var(--space-xl)",
            height: 3,
            borderRadius: 2,
            background:
              "linear-gradient(90deg, var(--finrpa-blue) 0%, var(--finrpa-gold) 100%)",
            opacity: 0.5,
          }}
        />
      </div>
    </div>
  );
}
