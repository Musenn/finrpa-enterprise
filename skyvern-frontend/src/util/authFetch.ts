/**
 * Fetch wrapper that automatically adds the enterprise auth token.
 * Reads the token from localStorage (same key as AuthStore).
 */
const LS_TOKEN = "finrpa_auth_token";

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = localStorage.getItem(LS_TOKEN);
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}
