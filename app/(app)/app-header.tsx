"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { listCompanies } from "@/lib/api/companies";
import { getConfig } from "@/lib/api/config";
import { toFormErrors } from "@/lib/api/errors";
import { listJobs } from "@/lib/api/jobs";
import { listRuns, type Run } from "@/lib/api/runs";
import { Banner, BANNER_DISMISS_MS } from "./banner";
import { activeTab, runStatusText, TABS } from "./nav";
import { useRuns, withRun } from "./run-context";

type Counts = { jobs?: number; companies?: number };

/** Feedback for the header's Run now, tied to the page it was clicked on. */
type Feedback = {
  pathname: string;
  kind: "status" | "alert";
  text: string;
  /** "Run started": stays while the run is going, then clears. */
  whileRunning?: boolean;
};

const RUNNING_POLL_MS = 30_000;

function errorMessage(err: unknown): string {
  return toFormErrors(err, []).formError ?? "Something went wrong. Please try again.";
}

function runFeedback(run: Run): Pick<Feedback, "kind" | "text" | "whileRunning"> {
  if (run.status === "failed") {
    return { kind: "alert", text: run.error ? `Run failed: ${run.error}` : "Run failed." };
  }
  if (run.status === "running") {
    return { kind: "status", text: "Run started. New jobs show up when it finishes.", whileRunning: true };
  }
  const found = `${run.jobs_found} new ${run.jobs_found === 1 ? "job" : "jobs"}`;
  return { kind: "status", text: `Run finished. ${found}.` };
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

function TabBar({ counts, settingsTab }: { counts: Counts; settingsTab: string | null }) {
  const pathname = usePathname();
  const active = activeTab(pathname, settingsTab);
  return (
    <nav aria-label="Main" className="overflow-x-auto">
      <ul className="flex gap-6 whitespace-nowrap">
        {TABS.map(({ id, label, href }) => {
          const count = id === "jobs" ? counts.jobs : id === "companies" ? counts.companies : undefined;
          const isActive = active === id;
          return (
            <li key={id}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 border-b-2 py-3 text-sm font-semibold transition-colors ${
                  isActive
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {label}
                {count !== undefined && " "}
                {count !== undefined && (
                  <span className="text-xs font-normal text-muted">{count.toLocaleString("en-GB")}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TabBarWithParams({ counts }: { counts: Counts }) {
  return <TabBar counts={counts} settingsTab={useSearchParams().get("tab")} />;
}

/** Logo, run status, Run now, Settings, and the main tabs. Every signed-in screen gets it. */
export function AppHeader() {
  const pathname = usePathname();
  const { triggered, trigger } = useRuns();
  const [counts, setCounts] = useState<Counts>({});
  const [runs, setRuns] = useState<Run[]>();
  const [cron, setCron] = useState<string>();
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>();

  // Counts and run history can change on any screen, so refetch on navigation.
  // Each request stands alone: one failing hides only its own piece.
  useEffect(() => {
    let cancelled = false;
    listCompanies().then(
      (companies) => !cancelled && setCounts((prev) => ({ ...prev, companies: companies.length })),
      () => {},
    );
    listRuns().then(
      (list) => !cancelled && setRuns(list),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // A finished run can bring new jobs. The first page is the whole job list's
  // cost, so this runs on load and after a run, not on every navigation.
  const finishedRun = triggered?.status === "success" ? triggered.id : undefined;
  useEffect(() => {
    let cancelled = false;
    listJobs().then(
      (page) =>
        !cancelled && setCounts((prev) => ({ ...prev, jobs: page.total ?? page.jobs.length })),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [finishedRun]);

  useEffect(() => {
    getConfig().then(
      (config) => setCron(config.cron),
      () => {},
    );
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const allRuns = runs && withRun(runs, triggered);
  const isRunning = allRuns?.[0]?.status === "running";

  // Poll while a run is going so "Running…" clears when it ends.
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      listRuns().then(setRuns, () => {});
    }, RUNNING_POLL_MS);
    return () => clearInterval(id);
  }, [isRunning]);

  async function runNow() {
    setBusy(true);
    setFeedback(undefined);
    try {
      const run = await trigger();
      setFeedback({ pathname, ...runFeedback(run) });
    } catch (err) {
      setFeedback(
        err instanceof ApiError && err.status === 409
          ? { pathname, kind: "status", text: "A run is already in progress." }
          : { pathname, kind: "alert", text: errorMessage(err) },
      );
    } finally {
      setBusy(false);
    }
  }

  // "Run started" is stale once the run ends.
  const stale = feedback?.whileRunning && allRuns && !isRunning;
  const shown = feedback?.pathname === pathname && !stale ? feedback : undefined;
  const dismissFeedback = useCallback(() => setFeedback(undefined), []);

  return (
    <header className="border-b border-divider">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-4">
          <Link href="/jobs" className="flex min-w-0 items-center gap-2 font-heading text-xl">
            <span aria-hidden="true" className="size-3 flex-none rounded-full bg-accent" />
            Job Lighthouse
          </Link>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            {allRuns && (
              <p className="text-xs text-muted" aria-label="Run status">
                {runStatusText(allRuns, cron, now)}
              </p>
            )}
            <button
              type="button"
              onClick={runNow}
              disabled={busy}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-60"
            >
              {busy ? "Starting…" : "Run now"}
            </button>
            <Link
              href="/settings"
              aria-label="Settings"
              className="rounded-full p-2 text-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              <GearIcon />
            </Link>
          </div>
        </div>
        <Suspense fallback={<TabBar counts={counts} settingsTab={null} />}>
          <TabBarWithParams counts={counts} />
        </Suspense>
      </div>
      {shown && (
        <div className="mx-auto w-full max-w-5xl px-4 pb-3 sm:px-6">
          {shown.kind === "alert" ? (
            <div role="alert" className="flex items-start justify-between gap-3 text-sm text-danger">
              <p>{shown.text}</p>
              <button type="button" onClick={dismissFeedback} aria-label="Dismiss" className="px-2">
                ×
              </button>
            </div>
          ) : (
            <Banner
              onDismiss={dismissFeedback}
              autoDismissMs={shown.whileRunning ? undefined : BANNER_DISMISS_MS}
            >
              {shown.text}
            </Banner>
          )}
        </div>
      )}
    </header>
  );
}
