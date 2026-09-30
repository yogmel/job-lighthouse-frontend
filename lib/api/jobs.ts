import { apiFetch } from "./client";

export type Job = {
  id: string;
  user_id: string;
  title: string;
  url: string;
  location: string;
  description: string;
  /** The real link to the company; filter and group on this, not `company`. */
  company_id: string;
  /** Company name at scrape time; may drift after a rename. Display-only. */
  company: string;
  match_score: number;
  match_description: string;
  profile_version: number;
  /** ISO timestamp. */
  date: string;
  /** ISO timestamp; null = not yet included in a sent digest. */
  notified_at: string | null;
  /** false = the posting closed (or its company was paused). Not a user dismissal. */
  active: boolean;
};

/**
 * Fetches every job; the board filters in the browser. Tier lives on the
 * company (a client-side grouping key) and `GET /jobs` query param names
 * aren't in SYSTEM_DESIGN.md yet.
 */
export function listJobs(): Promise<Job[]> {
  return apiFetch<Job[]>("/jobs");
}
