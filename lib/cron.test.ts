import { describe, expect, it } from "vitest";
import { isValidCron, nextCronRun } from "./cron";

const at = (iso: string) => new Date(iso);

describe("isValidCron", () => {
  it.each(["0 7 * * *", "*/15 * * * *", "0 9 * * 1-5", "30 6 1,15 * *", "0 0 * * 7"])(
    "accepts %s",
    (expr) => expect(isValidCron(expr)).toBe(true),
  );

  it.each(["", "0 7 * *", "60 * * * *", "* 24 * * *", "* * 0 * *", "a b c d e", "*/0 * * * *", "5-1 * * * *"])(
    "rejects %j",
    (expr) => expect(isValidCron(expr)).toBe(false),
  );
});

describe("nextCronRun", () => {
  it("finds the next daily run later the same day", () => {
    expect(nextCronRun("0 7 * * *", at("2026-10-02T05:30:00Z"))).toEqual(at("2026-10-02T07:00:00Z"));
  });

  it("rolls to the next day once today's run has passed", () => {
    expect(nextCronRun("0 7 * * *", at("2026-10-02T07:00:00Z"))).toEqual(at("2026-10-03T07:00:00Z"));
  });

  it("handles steps", () => {
    expect(nextCronRun("0 */6 * * *", at("2026-10-02T07:10:00Z"))).toEqual(at("2026-10-02T12:00:00Z"));
  });

  it("skips weekends for a weekday schedule", () => {
    // 2026-10-02 is a Friday.
    expect(nextCronRun("0 9 * * 1-5", at("2026-10-02T10:00:00Z"))).toEqual(at("2026-10-05T09:00:00Z"));
  });

  it("treats 7 as Sunday", () => {
    expect(nextCronRun("0 9 * * 7", at("2026-10-02T10:00:00Z"))).toEqual(at("2026-10-04T09:00:00Z"));
  });

  it("matches either day field when both are restricted", () => {
    expect(nextCronRun("0 9 3 * 1", at("2026-10-02T10:00:00Z"))).toEqual(at("2026-10-03T09:00:00Z"));
  });

  it("returns null for an invalid expression", () => {
    expect(nextCronRun("nope", at("2026-10-02T10:00:00Z"))).toBeNull();
  });

  it("returns null when no date ever matches", () => {
    expect(nextCronRun("0 0 31 2 *", at("2026-10-02T10:00:00Z"))).toBeNull();
  });
});
