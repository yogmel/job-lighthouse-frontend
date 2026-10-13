import { apiFetchWithHeaders } from "./client";

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
  /** false = the posting closed. Not a user dismissal, and unaffected by pausing the company. */
  active: boolean;
  /** false = the job's company is paused: its jobs stay listed but are left out of the digest. */
  company_active: boolean;
};

export type JobsPage = {
  jobs: Job[];
  /** From `X-Next-Cursor`; null on the last page. */
  nextCursor: string | null;
  /** From `X-Total-Count`; only the first page sends it, so null on later pages or if absent. */
  total: number | null;
};

export type JobsQuery = {
  companyId?: string;
  tier?: number;
  /** true = open, false = closed, undefined = all. */
  active?: boolean;
};

/**
 * Fetches one page of jobs (newest first); pass the previous page's
 * `nextCursor` to continue. The server applies the filters, so the cursor
 * walks the filtered list and `total` counts it.
 */
export async function listJobs(query: JobsQuery = {}, cursor?: string | null): Promise<JobsPage> {
  const params = new URLSearchParams();
  if (query.companyId) params.set("company_id", query.companyId);
  if (query.tier !== undefined) params.set("tier", String(query.tier));
  if (query.active !== undefined) params.set("active", String(query.active));
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  const { data, headers } = await apiFetchWithHeaders<Job[]>(`/jobs${qs ? `?${qs}` : ""}`);
  const total = Number.parseInt(headers.get("X-Total-Count") ?? "", 10);
  return {
    jobs: data,
    nextCursor: headers.get("X-Next-Cursor"),
    total: Number.isFinite(total) && total >= 0 ? total : null,
  };
}
