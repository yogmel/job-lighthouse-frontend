import { describe, expect, it } from "vitest";
import { loginUrl, safeNextPath } from "./routes";

describe("safeNextPath", () => {
  it.each([
    ["/companies", "/companies"],
    ["/settings?tab=profile", "/settings?tab=profile"],
    [undefined, "/jobs"],
    [null, "/jobs"],
    ["", "/jobs"],
    ["https://evil.example", "/jobs"],
    ["//evil.example", "/jobs"],
    ["/\\evil.example", "/jobs"],
    ["companies", "/jobs"],
    ["/\t/evil.example", "/jobs"],
    ["/\n/evil.example", "/jobs"],
    ["/\r/evil.example", "/jobs"],
    ["/login", "/jobs"],
    ["/signup?x=1", "/jobs"],
    ["/forgot-password", "/jobs"],
    ["/reset-password?token=abc", "/jobs"],
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
