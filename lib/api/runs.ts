import { apiFetch } from "./client";

export type Run = {
  id: string;
  user_id: string;
  /** ISO timestamp. */
  started_at: string;
  /** ISO timestamp; null while running. */
  finished_at: string | null;
  status: "running" | "success" | "failed";
  trigger: "cron" | "manual";
  /** `company`: a Single-company run; `company_id` says which one. */
  scope: "full" | "company";
  /** Set for Single-company runs, null for Full runs. */
  company_id: string | null;
  jobs_found: number;
  error: string | null;
};

/**
 * Starts a manual run: a Full run, or with `companyId` a Single-company run.
 * While another run holds the lock the backend answers 409; a Single-company
 * run also gets 409 for a paused Company and 404 for an unknown one.
 */
export function triggerRun(companyId?: string): Promise<Run> {
  return companyId === undefined
    ? apiFetch<Run>("/runs", { method: "POST" })
    : apiFetch<Run>("/runs", { method: "POST", body: JSON.stringify({ company_id: companyId }) });
}

export function listRuns(): Promise<Run[]> {
  return apiFetch<Run[]>("/runs");
}

/** One company's outcome in one run. */
export type RunCompanyResult = {
  id: string;
  run_id: string;
  company_id: string;
  /** The name stored with the row, so it survives the Company being deleted. */
  company_name: string;
  /** `skipped`: not fetched this run (e.g. paused). */
  status: "ok" | "failed" | "skipped";
  jobs_found: number;
  error: string | null;
};

export function listRunCompanies(runId: string): Promise<RunCompanyResult[]> {
  return apiFetch<RunCompanyResult[]>(`/runs/${encodeURIComponent(runId)}/companies`);
}
