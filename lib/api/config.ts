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
  /**
   * Notification preferences (FE-010). Not in SYSTEM_DESIGN.md yet: the
   * backend must add them to `Config`. Optional until it does; see
   * `NOTIFICATION_DEFAULTS` for what a missing value means.
   */
  notify_email?: boolean;
  notify_empty_company?: boolean;
  notify_min_score?: number;
};

/** What the UI assumes when the backend omits a notification field. */
export const NOTIFICATION_DEFAULTS = {
  notify_email: true,
  notify_empty_company: true,
  notify_min_score: 40,
} as const;

/** The fields `PUT /config` writes; the rest are server-owned. */
export type ConfigInput = Pick<
  Config,
  | "keywords_include"
  | "keywords_exclude"
  | "location"
  | "cron"
  | "profile"
  | "notify_email"
  | "notify_empty_company"
  | "notify_min_score"
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
  notify_email,
  notify_empty_company,
  notify_min_score,
}: Config): ConfigInput {
  return {
    keywords_include,
    keywords_exclude,
    location,
    cron,
    profile,
    notify_email,
    notify_empty_company,
    notify_min_score,
  };
}
