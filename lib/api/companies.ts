import { apiFetch } from "./client";

export const BOARDS = ["lever", "greenhouse", "ashby", "smartrecruiters"] as const;
export type Board = (typeof BOARDS)[number];

export type Selectors = {
  careers_url: string;
  job: string;
  title: string;
  link: string;
  location?: string;
};

/** A company is watched through exactly one source; `custom` is v0.10. */
export type Source =
  | { kind: "board"; board: Board; board_id: string }
  | { kind: "scraper"; strategy: "static" | "dynamic"; selectors: Selectors }
  | { kind: "custom"; handler: string };

export type Company = {
  id: string;
  user_id: string;
  name: string;
  tier: number;
  /** ISO timestamp. */
  added_at: string;
  website_url: string;
  /** false = paused: the row and its jobs are kept, runs skip it. */
  active: boolean;
  source: Source;
};

export function listCompanies(): Promise<Company[]> {
  return apiFetch<Company[]>("/companies");
}

/** Sources the manual form can set; `custom` needs a developer (v0.10). */
export type EditableSource = Exclude<Source, { kind: "custom" }>;

export type CompanyInput = {
  name: string;
  tier: number;
  website_url: string;
  source: EditableSource;
};

export function createCompany(input: CompanyInput): Promise<Company> {
  return apiFetch<Company>("/companies", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Partial update: send only what changed (e.g. `{ tier }` or `{ active }`). */
export type CompanyUpdate = Partial<CompanyInput & { active: boolean }>;

export function updateCompany(id: string, update: CompanyUpdate): Promise<Company> {
  return apiFetch<Company>(`/companies/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(update),
  });
}

/**
 * `DELETE /companies/{id}`: removes the company and its jobs (run history is
 * kept). 204; 404 if it is gone; 409 while a run is in progress.
 */
export async function deleteCompany(id: string): Promise<void> {
  await apiFetch<null>(`/companies/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** One opening from the detect sample, already scored against the user's profile. */
export type SampleJob = {
  title: string;
  url: string;
  match_score: number;
};

/**
 * Draft returned by `POST /companies/detect`. Not persisted: confirming sends
 * exactly this `source` to `POST /companies`. Field names beyond `source`
 * and the sample aren't in SYSTEM_DESIGN.md yet; assumed here.
 */
export type Detection = {
  /** Best guess from the page; may be empty. */
  name: string;
  source: EditableSource;
  /** Openings read from the source. */
  jobs_found: number;
  /** Openings that pass the user's keyword/location filters. */
  jobs_matched: number;
  sample: SampleJob[];
};

/** Pass `signal` to abort a slow detection (the agent step can take seconds). */
export function detectCompany(url: string, signal?: AbortSignal): Promise<Detection> {
  return apiFetch<Detection>("/companies/detect", {
    method: "POST",
    body: JSON.stringify({ url }),
    signal,
  });
}
