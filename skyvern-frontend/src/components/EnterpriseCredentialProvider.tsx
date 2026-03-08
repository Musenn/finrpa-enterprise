/**
 * Bridges enterprise JWT auth into Skyvern's CredentialGetterContext.
 *
 * Skyvern's AxiosClient.getClient() uses a CredentialGetter (from React
 * context) to set the Authorization header on every request. Without a
 * provider, the getter is null and getClient() actively removes the
 * Authorization header — breaking all native Skyvern endpoints after
 * enterprise login.
 *
 * This provider returns the JWT token stored by AuthStore so that
 * getClient() preserves the Authorization: Bearer header.
 */

import { useCallback, type ReactNode } from "react";
import { CredentialGetterContext } from "@/store/CredentialGetterContext";
import { useAuthStore } from "@/store/AuthStore";

export function EnterpriseCredentialProvider({
  children,
}: {
  children: ReactNode;
}) {
  const token = useAuthStore((s) => s.token);

  const credentialGetter = useCallback(async () => {
    return token;
  }, [token]);

  return (
    <CredentialGetterContext.Provider value={credentialGetter}>
      {children}
    </CredentialGetterContext.Provider>
  );
}
