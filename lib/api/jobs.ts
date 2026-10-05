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
};

/**
 * Fetches one page of jobs (newest first); pass the previous page's
 * `nextCursor` to continue. The board filters in the browser, so the cursor
 * walks the unfiltered list.
 */
export async function listJobs(cursor?: string | null): Promise<JobsPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const { data, headers } = await apiFetchWithHeaders<Job[]>(`/jobs${query}`);
  return { jobs: data, nextCursor: headers.get("X-Next-Cursor") };
}
