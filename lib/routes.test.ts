import { describe, expect, it } from "vitest";
import { loginUrl, safeNextPath } from "./routes";

describe("safeNextPath", () => {
  it.each([
    ["/companies", "/companies"],
    ["/settings?tab=profile", "/settings?tab=profile"],
    [undefined, "/setup"],
    [null, "/setup"],
    ["", "/setup"],
    ["https://evil.example", "/setup"],
    ["//evil.example", "/setup"],
    ["/\\evil.example", "/setup"],
    ["companies", "/setup"],
    ["/\t/evil.example", "/setup"],
    ["/\n/evil.example", "/setup"],
    ["/\r/evil.example", "/setup"],
    ["/login", "/setup"],
    ["/signup?x=1", "/setup"],
    ["/forgot-password", "/setup"],
    ["/reset-password?token=abc", "/setup"],
  ])("%s → %s", (next, expected) => {
    expect(safeNextPath(next)).toBe(expected);
  });
});

describe("loginUrl", () => {
  it("carries the page to return to", () => {
    expect(loginUrl("/settings?tab=profile")).toBe("/login?next=%2Fsettings%3Ftab%3Dprofile");
  });

  it("drops next when there is nothing to return to", () => {
    expect(loginUrl()).toBe("/login");
    expect(loginUrl("/")).toBe("/login");
    expect(loginUrl("/login")).toBe("/login");
  });
});
