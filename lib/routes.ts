/** App paths shared by the proxy, the API client and the auth forms. */

export const LOGIN_PATH = "/login";
export const SIGNUP_PATH = "/signup";
export const FORGOT_PASSWORD_PATH = "/forgot-password";
/** Target of the emailed reset link; the token rides in `?token=`. */
export const RESET_PASSWORD_PATH = "/reset-password";

/** Where a signed-in user lands: the Jobs board. */
export const AFTER_AUTH_PATH = "/jobs";

/** Routes reachable without a session. Everything else needs one. */
export const PUBLIC_PATHS: readonly string[] = [
  LOGIN_PATH,
  SIGNUP_PATH,
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const SENTINEL_ORIGIN = "http://app.invalid";

/**
 * Returns `next` if it is a same-origin app path worth going back to,
 * otherwise `AFTER_AUTH_PATH`. Guards against open redirects.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next?.startsWith("/")) return AFTER_AUTH_PATH;
  // Parse instead of prefix checks: the URL parser strips tabs/newlines, so
  // "/\t/evil.example" would otherwise slip through as "//evil.example".
  let url: URL;
  try {
    url = new URL(next, SENTINEL_ORIGIN);
  } catch {
    return AFTER_AUTH_PATH;
  }
  if (url.origin !== SENTINEL_ORIGIN || isPublicPath(url.pathname)) return AFTER_AUTH_PATH;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** `/login?next=<path>`, or plain `/login` when there is nothing to return to. */
export function loginUrl(next?: string): string {
  if (!next || next === "/" || isPublicPath(next.split(/[?#]/)[0])) return LOGIN_PATH;
  return `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}
