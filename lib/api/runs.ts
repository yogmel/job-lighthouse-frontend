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
