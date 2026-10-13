import { describe, expect, it } from "vitest";
import type { Company } from "@/lib/api/companies";
import type { Run, RunCompanyResult } from "@/lib/api/runs";
import {
  DEFAULT_FILTERS,
  lastRunOutcomes,
  latestFullRun,
  matchesFilters,
  parseFilters,
  writeFilters,
} from "./company-filters";

const company = (overrides: Partial<Company> = {}): Company => ({
  id: "c1",
  user_id: "u1",
  name: "Halden",
  tier: 1,
  added_at: "2026-03-28T12:00:00Z",
  website_url: "https://halden.example",
  active: true,
  source: { kind: "board", board: "ashby", board_id: "halden" },
  ...overrides,
});

const run = (id: string, started_at: string, overrides: Partial<Run> = {}): Run => ({
  id,
  user_id: "u1",
  started_at,
  finished_at: started_at,
  status: "success",
  trigger: "cron",
  scope: "full",
  company_id: null,
  jobs_found: 0,
  error: null,
  ...overrides,
});

const result = (
  company_id: string,
  status: RunCompanyResult["status"],
  jobs_found = 0,
): RunCompanyResult => ({
  id: `x-${company_id}`,
  run_id: "r1",
  company_id,
  company_name: company_id,
  status,
  jobs_found,
  new_jobs: 0,
  error: null,
});

describe("parseFilters", () => {
  it("reads every filter", () => {
    expect(
      parseFilters(new URLSearchParams("tier=2&source=scraper&status=paused&last_run=zero")),
    ).toEqual({ tier: "2", source: "scraper", status: "paused", lastRun: "zero" });
  });

  it.each(["tier=abc", "tier=0", "source=workday", "status=closed", "last_run=bogus", ""])(
    "falls back to the default for %j",
    (query) => {
      expect(parseFilters(new URLSearchParams(query))).toEqual(DEFAULT_FILTERS);
    },
  );
});

describe("writeFilters", () => {
  it("sets non-default filters and leaves defaults out", () => {
    const params = writeFilters(new URLSearchParams(), {
      ...DEFAULT_FILTERS,
      tier: "1",
      lastRun: "failed",
    });
    expect(params.toString()).toBe("tier=1&last_run=failed");
  });

  it("keeps unrelated params and removes cleared filters", () => {
    const params = writeFilters(new URLSearchParams("added=Halden&tier=1&status=active"), {
      ...DEFAULT_FILTERS,
      status: "active",
    });
    expect(params.toString()).toBe("added=Halden&status=active");
  });
});

describe("latestFullRun", () => {
  it("picks the newest finished Full run, skipping Single-company and running ones", () => {
    const runs = [
      run("r1", "2026-10-01T07:00:00Z"),
      run("r2", "2026-10-02T07:00:00Z", { status: "failed" }),
      run("r3", "2026-10-02T08:00:00Z", { scope: "company", company_id: "c1" }),
      run("r4", "2026-10-02T09:00:00Z", { status: "running", finished_at: null }),
    ];
    expect(latestFullRun(runs)?.id).toBe("r2");
  });

  it("is undefined without a finished Full run", () => {
    expect(latestFullRun([run("r1", "2026-10-01T07:00:00Z", { scope: "company" })])).toBeUndefined();
  });
});

describe("lastRunOutcomes", () => {
  it("maps ok with jobs, ok with none and failed; skipped has no outcome", () => {
    const outcomes = lastRunOutcomes([
      result("c1", "ok", 4),
      result("c2", "ok", 0),
      result("c3", "failed"),
      result("c4", "skipped"),
    ]);
    expect(Object.fromEntries(outcomes)).toEqual({ c1: "ok", c2: "zero", c3: "failed" });
  });
});

describe("matchesFilters", () => {
  const outcomes = new Map([["c1", "ok" as const]]);

  it("matches everything with the default filters, even with no last-run data", () => {
    expect(matchesFilters(company(), DEFAULT_FILTERS, undefined)).toBe(true);
  });

  it("filters by tier, source, status and last run, combined with AND", () => {
    const filters = { tier: "1", source: "ashby", status: "active", lastRun: "ok" } as const;
    expect(matchesFilters(company(), filters, outcomes)).toBe(true);
    expect(matchesFilters(company({ tier: 2 }), filters, outcomes)).toBe(false);
    expect(matchesFilters(company({ active: false }), filters, outcomes)).toBe(false);
    expect(
      matchesFilters(company({ source: { kind: "board", board: "lever", board_id: "h" } }), filters, outcomes),
    ).toBe(false);
    expect(matchesFilters(company({ id: "c9" }), filters, outcomes)).toBe(false);
  });

  it("matches scraper and custom sources by kind", () => {
    const scraper = company({
      source: {
        kind: "scraper",
        strategy: "static",
        selectors: { careers_url: "https://x", job: ".j", title: "h3", link: "a" },
      },
    });
    const custom = company({ source: { kind: "custom", handler: "x" } });
    expect(matchesFilters(scraper, { ...DEFAULT_FILTERS, source: "scraper" }, undefined)).toBe(true);
    expect(matchesFilters(custom, { ...DEFAULT_FILTERS, source: "custom" }, undefined)).toBe(true);
    expect(matchesFilters(custom, { ...DEFAULT_FILTERS, source: "scraper" }, undefined)).toBe(false);
  });

  it("matches nothing on last run while the outcomes are unknown", () => {
    expect(matchesFilters(company(), { ...DEFAULT_FILTERS, lastRun: "ok" }, undefined)).toBe(false);
  });
});
