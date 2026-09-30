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
 * Not in SYSTEM_DESIGN.md's API table yet; assumed to be
 * `DELETE /companies/{id}` answering 204.
 */
export async function deleteCompany(id: string): Promise<void> {
  await apiFetch<null>(`/companies/${encodeURIComponent(id)}`, { method: "DELETE" });
}
