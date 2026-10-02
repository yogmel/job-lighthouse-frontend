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
  jobs_found: number;
  error: string | null;
};

/**
 * Starts a manual run. While another run holds the lock the backend no-ops;
 * the response shape for that case isn't specified, so a 409 is treated as
 * "already running" too.
 */
export function triggerRun(): Promise<Run> {
  return apiFetch<Run>("/runs", { method: "POST" });
}

export function listRuns(): Promise<Run[]> {
  return apiFetch<Run[]>("/runs");
}

/** One company's outcome in one run. */
export type RunCompanyResult = {
  id: string;
  run_id: string;
  company_id: string;
  /** `skipped`: not fetched this run (e.g. paused). */
  status: "ok" | "failed" | "skipped";
  jobs_found: number;
  error: string | null;
};

export function listRunCompanies(runId: string): Promise<RunCompanyResult[]> {
  return apiFetch<RunCompanyResult[]>(`/runs/${encodeURIComponent(runId)}/companies`);
}
