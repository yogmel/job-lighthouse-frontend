import { apiFetch } from "./client";

export type Config = {
  id: string;
  user_id: string;
  keywords_include: string[];
  /** Word-boundary matched, applied at scrape time. */
  keywords_exclude: string[];
  location: string;
  /** Cron expression. */
  cron: string;
  /** Markdown the scorer reads to rate each posting. */
  profile: string;
  /** Bumped by the backend on every profile edit. */
  profile_version: number;
};

/** The fields `PUT /config` writes; the rest are server-owned. */
export type ConfigInput = Pick<
  Config,
  "keywords_include" | "keywords_exclude" | "location" | "cron" | "profile"
>;

export function getConfig(): Promise<Config> {
  return apiFetch<Config>("/config");
}

/**
 * Replaces the editable config. SYSTEM_DESIGN.md doesn't say whether `PUT`
 * merges, so callers send every editable field, not just the one they changed.
 */
export function updateConfig(input: ConfigInput): Promise<Config> {
  return apiFetch<Config>("/config", { method: "PUT", body: JSON.stringify(input) });
}

export function toConfigInput({
  keywords_include,
  keywords_exclude,
  location,
  cron,
  profile,
}: Config): ConfigInput {
  return { keywords_include, keywords_exclude, location, cron, profile };
}
