import { afterEach, describe, expect, it, vi } from "vitest";
import { clearToken, getToken, setToken, tokenExpiry } from "./session";

function jwt(payload: object): string {
  const b64url = (v: object) =>
    btoa(JSON.stringify(v)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.signature`;
}

describe("session", () => {
  afterEach(() => {
    clearToken();
    vi.restoreAllMocks();
  });

  it("reads exp from the token payload", () => {
    expect(tokenExpiry(jwt({ user_id: "u1", exp: 1_900_000_000 }))).toBe(1_900_000_000);
    expect(tokenExpiry("not-a-jwt")).toBeNull();
  });

  it("stores and reads the token", () => {
    const token = jwt({ user_id: "u1", exp: Math.floor(Date.now() / 1000) + 3600 });
    setToken(token);
    expect(getToken()).toBe(token);
  });

  it("sets Max-Age from the exp claim", () => {
    const now = 1_800_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now * 1000);
    const cookieSetter = vi.spyOn(document, "cookie", "set");

    setToken(jwt({ user_id: "u1", exp: now + 900 }));

    expect(cookieSetter).toHaveBeenCalledWith(expect.stringContaining("Max-Age=900"));
    expect(cookieSetter).toHaveBeenCalledWith(expect.stringContaining("SameSite=Lax"));
  });

  it("clears the token", () => {
    setToken(jwt({ user_id: "u1", exp: Math.floor(Date.now() / 1000) + 3600 }));
    clearToken();
    expect(getToken()).toBeNull();
  });
});
