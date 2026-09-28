/**
 * Browser-side JWT storage. The cookie is not httpOnly on purpose: the
 * browser attaches the token to calls to both backend services itself.
 */

export const TOKEN_COOKIE = "jl_token";

/** Fallback lifetime when the token has no readable `exp` claim. */
const DEFAULT_MAX_AGE_S = 60 * 60;

/** Reads the `exp` claim (seconds since epoch) without verifying the token. */
export function tokenExpiry(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp: unknown = JSON.parse(json).exp;
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

function cookieAttributes(maxAge: number): string {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  return `Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function setToken(token: string): void {
  const exp = tokenExpiry(token);
  const maxAge =
    exp === null ? DEFAULT_MAX_AGE_S : Math.max(0, exp - Math.floor(Date.now() / 1000));
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; ${cookieAttributes(maxAge)}`;
}

export function getToken(): string | null {
  const prefix = `${TOKEN_COOKIE}=`;
  const entry = document.cookie.split("; ").find((c) => c.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}

export function clearToken(): void {
  document.cookie = `${TOKEN_COOKIE}=; ${cookieAttributes(0)}`;
}
