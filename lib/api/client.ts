/**
 * Thin fetch wrapper for the backend services behind Nginx.
 * The browser calls both services directly (no BFF), with the same JWT.
 */

import { hardRedirect } from "@/lib/navigation";
import { loginUrl } from "@/lib/routes";
import { clearToken, getToken } from "@/lib/session";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/** Thrown when the request never got a response (offline, CORS, DNS). */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super("Network request failed", { cause });
    this.name = "NetworkError";
  }
}

function baseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
  }
  return url.replace(/\/+$/, "");
}

export type ApiRequestInit = RequestInit & {
  /**
   * Attach the session token and log out on 401 (default). Set to `false` for
   * the `/auth/*` calls, where 401 means bad credentials, not an expired session.
   */
  auth?: boolean;
};

/** Drops the session and sends the user to login, back to the current page after. */
function endSession(): void {
  clearToken();
  hardRedirect(loginUrl(`${window.location.pathname}${window.location.search}`));
}

export async function apiFetch<T>(
  path: string,
  { auth = true, ...init }: ApiRequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  // Outside the try: a missing base URL is a config bug, not a network failure.
  const url = `${baseUrl()}${path}`;

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (err) {
    throw new NetworkError(err);
  }

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    // Only 401 logs out; 403 (e.g. wrong current password) keeps the session.
    if (auth && res.status === 401) endSession();
    const detail =
      body && typeof body === "object" && "detail" in body ? body.detail : body;
    throw new ApiError(res.status, detail);
  }

  return body as T;
}
