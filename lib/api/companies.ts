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
