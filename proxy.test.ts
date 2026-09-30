// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

function jwt(payload: object): string {
  const b64url = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.signature`;
}

const now = () => Math.floor(Date.now() / 1000);

function request(path: string, token?: string): NextRequest {
  const headers = token === undefined ? undefined : { cookie: `jl_token=${token}` };
  return new NextRequest(`http://app.test${path}`, { headers });
}

describe("proxy", () => {
  it("redirects to login when there is no token", () => {
    const res = proxy(request("/settings?tab=profile"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://app.test/login?next=%2Fsettings%3Ftab%3Dprofile",
    );
  });

  it("redirects and clears the cookie when the token is expired", () => {
    const res = proxy(request("/setup", jwt({ sub: "u1", exp: now() - 60 })));
    expect(res.headers.get("location")).toBe("http://app.test/login?next=%2Fsetup");
    expect(res.headers.get("set-cookie")).toMatch(/jl_token=;/);
  });

  it("redirects and clears the cookie when the token is malformed", () => {
    const res = proxy(request("/setup", "garbage"));
    expect(res.headers.get("location")).toBe("http://app.test/login?next=%2Fsetup");
    expect(res.headers.get("set-cookie")).toMatch(/jl_token=;/);
  });

  it("lets a valid token through", () => {
    const res = proxy(request("/setup", jwt({ sub: "u1", exp: now() + 3600 })));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["/login", "/signup"])("leaves %s public", (path) => {
    const res = proxy(request(path));
    expect(res.headers.get("location")).toBeNull();
  });
});
