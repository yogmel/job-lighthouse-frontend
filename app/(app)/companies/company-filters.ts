import type { Board, Company } from "@/lib/api/companies";
import type { Run, RunCompanyResult } from "@/lib/api/runs";

export type SourceFilter = Board | "scraper" | "custom";

/** In the order the filter lists them. */
export const SOURCES: readonly SourceFilter[] = [
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "scraper",
  "custom",
];

export const SOURCE_LABELS: Record<SourceFilter, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  scraper: "Scraper",
  custom: "Custom",
};

const STATUSES = ["active", "paused"] as const;
type StatusFilter = (typeof STATUSES)[number];

/** A Company's outcome in the last Full run; no outcome when it was skipped or not in it. */
export const LAST_RUN_OUTCOMES = ["ok", "zero", "failed"] as const;
export type LastRunOutcome = (typeof LAST_RUN_OUTCOMES)[number];

export type CompanyFilters = {
  /** "" = any tier; otherwise the tier number as a string. */
  tier: string;
  source: SourceFilter | "";
  status: StatusFilter | "";
  lastRun: LastRunOutcome | "";
};

export const DEFAULT_FILTERS: CompanyFilters = { tier: "", source: "", status: "", lastRun: "" };

/** Query-string key per filter. */
const KEYS: Record<keyof CompanyFilters, string> = {
  tier: "tier",
  source: "source",
  status: "status",
  lastRun: "last_run",
};

function oneOf<T extends string>(values: readonly T[], value: string | null): T | "" {
  return values.find((v) => v === value) ?? "";
}

/** Filters from the URL; anything unknown falls back to "all". */
export function parseFilters(params: URLSearchParams): CompanyFilters {
  const tier = params.get(KEYS.tier) ?? "";
  return {
    tier: /^[1-9]\d*$/.test(tier) ? tier : "",
    source: oneOf(SOURCES, params.get(KEYS.source)),
    status: oneOf(STATUSES, params.get(KEYS.status)),
    lastRun: oneOf(LAST_RUN_OUTCOMES, params.get(KEYS.lastRun)),
  };
}

/** `params` with the filters set; defaults are left out, other params are kept. */
export function writeFilters(params: URLSearchParams, filters: CompanyFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of Object.keys(KEYS) as (keyof CompanyFilters)[]) {
    if (filters[key]) next.set(KEYS[key], filters[key]);
    else next.delete(KEYS[key]);
  }
  return next;
}

/**
 * The run the "Last run" filter reads: the newest finished Full run. A
 * Single-company run only covers one Company, and a running one is partial.
 */
export function latestFullRun(runs: Run[]): Run | undefined {
  return runs
    .filter((r) => r.scope === "full" && r.status !== "running")
    .reduce<Run | undefined>(
      (newest, r) => (!newest || Date.parse(r.started_at) > Date.parse(newest.started_at) ? r : newest),
      undefined,
    );
}

/** Company id → outcome, from one run's `RunCompanyResult` rows. Skipped rows are left out. */
export function lastRunOutcomes(results: RunCompanyResult[]): Map<string, LastRunOutcome> {
  const outcomes = new Map<string, LastRunOutcome>();
  for (const r of results) {
    if (r.status === "failed") outcomes.set(r.company_id, "failed");
    else if (r.status === "ok") outcomes.set(r.company_id, r.jobs_found > 0 ? "ok" : "zero");
  }
  return outcomes;
}

function sourceKey(company: Company): SourceFilter {
  return company.source.kind === "board" ? company.source.board : company.source.kind;
}

/**
 * Every set filter must match (AND). `outcomes` is undefined while the last
 * run is unknown; a Last run filter then matches nothing.
 */
export function matchesFilters(
  company: Company,
  { tier, source, status, lastRun }: CompanyFilters,
  outcomes: Map<string, LastRunOutcome> | undefined,
): boolean {
  if (tier && String(company.tier) !== tier) return false;
  if (source && sourceKey(company) !== source) return false;
  if (status && (status === "active") !== company.active) return false;
  if (lastRun && outcomes?.get(company.id) !== lastRun) return false;
  return true;
}
