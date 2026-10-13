import { describe, expect, it } from "vitest";
import { formatDate, formatTime, isSameDay, startedLabel } from "./dates";

describe("formatDate / formatTime", () => {
  // 23:30Z on 20 Sep is already 21 Sep in Berlin (UTC+2 in summer) and still 20 Sep in New York.
  const instant = "2026-09-20T23:30:00Z";

  it("shows the day and clock of the given zone", () => {
    expect(formatDate(instant, "UTC")).toBe("20 Sept");
    expect(formatDate(instant, "Europe/Berlin")).toBe("21 Sept");
    expect(formatDate(instant, "America/New_York")).toBe("20 Sept");
    expect(formatTime(new Date(instant), "Europe/Berlin")).toBe("01:30");
  });

  it("falls back to UTC for a missing or unknown zone", () => {
    expect(formatDate(instant)).toBe("20 Sept");
    expect(formatDate(instant, "Not/AZone")).toBe("20 Sept");
    expect(formatTime(new Date(instant), "")).toBe("23:30");
  });
});

describe("isSameDay", () => {
  it("compares calendar days in the zone, not in UTC", () => {
    const a = new Date("2026-09-20T23:30:00Z");
    const b = new Date("2026-09-21T00:30:00Z");
    expect(isSameDay(a, b, "UTC")).toBe(false);
    expect(isSameDay(a, b, "Europe/Berlin")).toBe(true);
  });
});

describe("startedLabel", () => {
  const now = new Date("2026-10-02T10:00:00Z");

  it("says Today / Yesterday by the zone's calendar", () => {
    expect(startedLabel("2026-10-02T07:04:00Z", now, "UTC")).toBe("Today 07:04");
    expect(startedLabel("2026-10-01T07:03:00Z", now, "UTC")).toBe("Yesterday 07:03");
    // 23:30Z on 1 Oct is 02:30 on 2 Oct in Berlin: today there, yesterday in UTC.
    expect(startedLabel("2026-10-01T23:30:00Z", now, "Europe/Berlin")).toBe("Today 01:30");
    expect(startedLabel("2026-10-01T23:30:00Z", now, "UTC")).toBe("Yesterday 23:30");
  });

  it("uses weekday names this week and dates before that", () => {
    expect(startedLabel("2026-09-27T07:04:00Z", now, "UTC")).toBe("Sun 07:04");
    expect(startedLabel("2026-09-24T07:04:00Z", now, "UTC")).toBe("24 Sept 07:04");
  });
});
