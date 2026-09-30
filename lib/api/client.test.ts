import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hardRedirect } from "@/lib/navigation";
import { clearToken, getToken, setToken } from "@/lib/session";
import { login } from "./auth";
import { ApiError, apiFetch } from "./client";

vi.mock("@/lib/navigation", () => ({ hardRedirect: vi.fn() }));

const TOKEN = "header.eyJzdWIiOiJ1MSIsImV4cCI6NDEwMjQ0NDgwMH0.sig";

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function sentHeaders(spy: ReturnType<typeof mockFetch>): Headers {
  return new Headers(spy.mock.calls[0][1]?.headers);
}

describe("apiFetch session handling", () => {
  beforeEach(() => {
    setToken(TOKEN);
    window.history.replaceState(null, "", "/companies?tier=1");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(hardRedirect).mockReset();
    clearToken();
  });

  it("attaches the token as a bearer header", async () => {
    const spy = mockFetch(200, []);
    await apiFetch("/companies");
    expect(sentHeaders(spy).get("Authorization")).toBe(`Bearer ${TOKEN}`);
  });

  it("does not attach the token to auth calls", async () => {
    const spy = mockFetch(200, { access_token: TOKEN, token_type: "bearer" });
    await login("ada@example.com", "pw");
    expect(sentHeaders(spy).has("Authorization")).toBe(false);
  });

  it("logs out and redirects to login on 401", async () => {
    mockFetch(401, { detail: "Token expired" });
    await expect(apiFetch("/jobs")).rejects.toBeInstanceOf(ApiError);
    expect(getToken()).toBeNull();
    expect(hardRedirect).toHaveBeenCalledWith("/login?next=%2Fcompanies%3Ftier%3D1");
  });

  it("keeps the session on 403", async () => {
    mockFetch(403, { detail: "Current password is incorrect" });
    await expect(apiFetch("/account", { method: "PUT" })).rejects.toMatchObject({ status: 403 });
    expect(getToken()).toBe(TOKEN);
    expect(hardRedirect).not.toHaveBeenCalled();
  });

  it("keeps the session on a login 401 (bad credentials)", async () => {
    mockFetch(401, { detail: "Invalid email or password" });
    await expect(login("ada@example.com", "wrong")).rejects.toMatchObject({ status: 401 });
    expect(getToken()).toBe(TOKEN);
    expect(hardRedirect).not.toHaveBeenCalled();
  });
});
