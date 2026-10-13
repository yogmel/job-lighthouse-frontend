import { describe, expect, it } from "vitest";
import { formatInZone, isValidCron, isValidTimeZone, listTimeZones, nextCronRun } from "./cron";

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

describe("nextCronRun in a time zone", () => {
  const berlin = "Europe/Berlin";

  it("reads the hour on the wall clock of the zone", () => {
    // Berlin is UTC+2 in summer.
    expect(nextCronRun("0 9 * * *", at("2026-07-01T00:00:00Z"), berlin)).toEqual(at("2026-07-01T07:00:00Z"));
  });

  it("follows the zone's winter offset", () => {
    expect(nextCronRun("0 9 * * *", at("2026-12-01T00:00:00Z"), berlin)).toEqual(at("2026-12-01T08:00:00Z"));
  });

  it("keeps 9am local when the clocks go back (2026-10-25)", () => {
    expect(nextCronRun("0 9 * * *", at("2026-10-24T08:00:00Z"), berlin)).toEqual(at("2026-10-25T08:00:00Z"));
  });

  it("keeps 9am local when the clocks go forward (2026-03-29)", () => {
    expect(nextCronRun("0 9 * * *", at("2026-03-28T09:00:00Z"), berlin)).toEqual(at("2026-03-29T07:00:00Z"));
  });

  it("skips a wall time that does not exist", () => {
    // 02:30 on 2026-03-29 is inside Berlin's spring-forward gap.
    expect(nextCronRun("30 2 * * *", at("2026-03-28T12:00:00Z"), berlin)).toEqual(at("2026-03-30T00:30:00Z"));
  });

  it("runs once, at the first pass, when a wall time happens twice", () => {
    // 02:30 on 2026-10-25 occurs at 00:30Z (CEST) and 01:30Z (CET).
    expect(nextCronRun("30 2 * * *", at("2026-10-24T12:00:00Z"), berlin)).toEqual(at("2026-10-25T00:30:00Z"));
  });

  it("handles zones with a half-hour offset", () => {
    expect(nextCronRun("0 9 * * *", at("2026-10-02T00:00:00Z"), "Asia/Kolkata")).toEqual(
      at("2026-10-02T03:30:00Z"),
    );
  });

  it("matches the weekday in the zone, not in UTC", () => {
    // Monday 09:00 in Auckland (UTC+13) is still Sunday in UTC.
    expect(nextCronRun("0 9 * * 1", at("2026-10-04T19:00:00Z"), "Pacific/Auckland")).toEqual(
      at("2026-10-04T20:00:00Z"),
    );
  });

  it("defaults to UTC", () => {
    expect(nextCronRun("0 7 * * *", at("2026-10-02T05:30:00Z"))).toEqual(
      nextCronRun("0 7 * * *", at("2026-10-02T05:30:00Z"), "UTC"),
    );
  });

  it("returns null for an unknown zone", () => {
    expect(nextCronRun("0 7 * * *", at("2026-10-02T05:30:00Z"), "Mars/Olympus")).toBeNull();
  });
});

describe("time zone helpers", () => {
  it("validates IANA names", () => {
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });

  it("lists zones with UTC included", () => {
    const zones = listTimeZones();
    expect(zones).toContain("UTC");
    expect(zones).toContain("Europe/Berlin");
  });

  it("formats a date in the zone with its abbreviation", () => {
    expect(formatInZone(at("2026-10-02T07:00:00Z"))).toBe("Fri 2 Oct, 07:00 UTC");
    expect(formatInZone(at("2026-10-02T07:00:00Z"), "Europe/Berlin")).toMatch(/^Fri 2 Oct, 09:00 \S+$/);
  });
});
