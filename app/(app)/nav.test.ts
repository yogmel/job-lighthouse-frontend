import { describe, expect, it } from "vitest";
import type { Run } from "@/lib/api/runs";
import { activeTab, runStatusText } from "./nav";

describe("activeTab", () => {
  it.each([
    ["/jobs", null, "jobs"],
    ["/companies", null, "companies"],
    ["/companies/new", null, "companies"],
    ["/runs", null, "runs"],
    ["/settings", "profile", "profile"],
    ["/settings", null, undefined],
    ["/settings", "account", undefined],
    ["/jobsearch", null, undefined],
    ["/setup", null, undefined],
  ])("%s ?tab=%s → %s", (pathname, tab, expected) => {
    expect(activeTab(pathname, tab)).toBe(expected);
  });
});

describe("runStatusText", () => {
  const NOW = new Date("2026-10-02T10:00:00Z");
  const CRON = "0 7,14 * * *";

  const run = (id: string, started_at: string, status: Run["status"] = "success"): Run => ({
    id,
    user_id: "u1",
    started_at,
    finished_at: status === "running" ? null : started_at,
    status,
    trigger: "cron",
    scope: "full",
    company_id: null,
    jobs_found: 0,
    error: null,
  });

  it("shows the newest run and the time to the next one", () => {
    const runs = [run("r1", "2026-10-01T07:03:00Z"), run("r2", "2026-10-02T07:04:00Z")];
    expect(runStatusText(runs, CRON, NOW)).toBe("Last run today 07:04 · next in 4h");
  });

  it("formats older runs like the Runs screen", () => {
    expect(runStatusText([run("r1", "2026-10-01T07:03:00Z")], CRON, NOW)).toBe(
      "Last run yesterday 07:03 · next in 4h",
    );
    expect(runStatusText([run("r1", "2026-08-20T07:03:00Z")], "30 14 * * *", NOW)).toBe(
      "Last run 20 Aug 07:03 · next in 4h 30m",
    );
  });

  it("says Running… while the newest run is going", () => {
    const runs = [run("r1", "2026-10-02T07:04:00Z"), run("r2", "2026-10-02T09:58:00Z", "running")];
    expect(runStatusText(runs, CRON, NOW)).toBe("Running…");
  });

  it("ignores a stale running run that a newer one superseded", () => {
    const runs = [run("r1", "2026-09-30T07:04:00Z", "running"), run("r2", "2026-10-02T07:04:00Z")];
    expect(runStatusText(runs, CRON, NOW)).toBe("Last run today 07:04 · next in 4h");
  });

  it("says No runs yet without history", () => {
    expect(runStatusText([], CRON, NOW)).toBe("No runs yet · next in 4h");
  });

  it("drops the next run without a usable schedule", () => {
    const runs = [run("r1", "2026-10-02T07:04:00Z")];
    expect(runStatusText(runs, undefined, NOW)).toBe("Last run today 07:04");
    expect(runStatusText(runs, "not a cron", NOW)).toBe("Last run today 07:04");
  });
});
