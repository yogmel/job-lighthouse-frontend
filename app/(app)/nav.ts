import type { Run } from "@/lib/api/runs";
import { nextCronRun, untilLabel } from "@/lib/cron";
import { startedLabel } from "./runs/format";

export type TabId = "jobs" | "companies" | "runs" | "profile";

export const TABS: readonly { id: TabId; label: string; href: string }[] = [
  { id: "jobs", label: "Jobs", href: "/jobs" },
  { id: "companies", label: "Companies", href: "/companies" },
  { id: "runs", label: "Runs", href: "/runs" },
  { id: "profile", label: "Profile", href: "/settings?tab=profile" },
];

function under(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** The tab to underline. Settings counts as Profile only on its Profile tab. */
export function activeTab(pathname: string, settingsTab: string | null): TabId | undefined {
  if (under(pathname, "/jobs")) return "jobs";
  if (under(pathname, "/companies")) return "companies";
  if (under(pathname, "/runs")) return "runs";
  if (under(pathname, "/settings") && settingsTab === "profile") return "profile";
  return undefined;
}

/**
 * "Last run today 07:04 · next in 4h 12m", "Running…", "No runs yet · next in 25m".
 * `runs` in any order; `cron` undefined (or invalid) drops the "next in" part.
 */
export function runStatusText(runs: Run[], cron: string | undefined, now: Date): string {
  const next = cron ? nextCronRun(cron, now) : null;
  const nextPart = next ? ` · next in ${untilLabel(next.getTime() - now.getTime()).replace("about ", "")}` : "";

  const latest = runs.reduce<Run | undefined>(
    (newest, r) => (!newest || Date.parse(r.started_at) > Date.parse(newest.started_at) ? r : newest),
    undefined,
  );
  if (!latest) return `No runs yet${nextPart}`;
  if (latest.status === "running") return "Running…";
  const started = startedLabel(latest.started_at, now).replace(/^(Today|Yesterday)/, (day) =>
    day.toLowerCase(),
  );
  return `Last run ${started}${nextPart}`;
}
