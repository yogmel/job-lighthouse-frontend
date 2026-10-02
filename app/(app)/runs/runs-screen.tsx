"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { listCompanies, type Company } from "@/lib/api/companies";
import { getConfig } from "@/lib/api/config";
import { toFormErrors } from "@/lib/api/errors";
import { listRunCompanies, listRuns, type Run, type RunCompanyResult } from "@/lib/api/runs";
import { formatUtc, nextCronRun, untilLabel } from "@/lib/cron";
import { useRuns, withRun } from "../run-context";
import { isSameUtcDay, plural, startedLabel } from "./format";
import { needsAttention, RunBreakdown } from "./run-breakdown";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; runs: Run[]; companies: Company[]; cron: string };

/** Per-run breakdown, fetched on first view. */
type Breakdown = { results?: RunCompanyResult[]; error?: string };

const ALREADY_RUNNING = "A run is already in progress.";

function errorMessage(err: unknown): string {
  return toFormErrors(err, []).formError ?? "Something went wrong. Please try again.";
}

function Card({ kicker, value, detail }: { kicker: string; value: string; detail: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-surface px-4 py-3">
      <span className="text-xs font-semibold tracking-wide text-muted uppercase">{kicker}</span>
      <span className="font-heading text-2xl">{value}</span>
      <span className="text-xs text-muted">{detail}</span>
    </div>
  );
}

function RunResult({ run }: { run: Run }) {
  const [dot, label] =
    run.status === "running"
      ? ["border border-accent", "Running"]
      : run.status === "failed"
        ? ["bg-danger", run.error ? `Failed — ${run.error}` : "Failed"]
        : ["bg-accent", "Success"];
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`size-2 flex-none rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export function RunsScreen() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<string>();
  const [breakdowns, setBreakdowns] = useState<Record<string, Breakdown>>({});
  const [running, setRunning] = useState(false);
  const [banner, setBanner] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  // Captured once so the estimates don't change between renders.
  const [now] = useState(() => new Date());
  // Runs started from the header show up here too.
  const { triggered, trigger } = useRuns();

  useEffect(() => {
    let cancelled = false;
    Promise.all([listRuns(), listCompanies(), getConfig()]).then(
      ([runs, companies, config]) =>
        !cancelled &&
        setState({ status: "ready", runs, companies, cron: config.cron }),
      (err: unknown) => !cancelled && setState({ status: "error", message: errorMessage(err) }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const runs = state.status === "ready" ? withRun(state.runs, triggered) : [];
  const latest = runs[0];
  const selected = runs.find((r) => r.id === selectedId) ?? latest;

  // The latest run's breakdown feeds the "Need attention" card, so load it too.
  const wanted = [...new Set([latest?.id, selected?.id])].filter((id) => id !== undefined).join(",");
  const requested = useRef(new Set<string>());

  useEffect(() => {
    for (const id of wanted.split(",")) {
      if (!id || requested.current.has(id)) continue;
      requested.current.add(id);
      listRunCompanies(id).then(
        (results) => setBreakdowns((prev) => ({ ...prev, [id]: { results } })),
        (err: unknown) => setBreakdowns((prev) => ({ ...prev, [id]: { error: errorMessage(err) } })),
      );
    }
  }, [wanted]);

  async function runNow() {
    setRunning(true);
    setBanner(undefined);
    setActionError(undefined);
    try {
      const run = await trigger();
      setState((prev) => (prev.status === "ready" ? { ...prev, runs: withRun(prev.runs, run) } : prev));
      setSelectedId(run.id);
      setBanner(run.status === "running" ? "Run started." : "Run finished.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setBanner(ALREADY_RUNNING);
      else setActionError(errorMessage(err));
    } finally {
      setRunning(false);
    }
  }

  const header = (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl">Runs</h1>
        {state.status === "ready" && (
          <p className="text-sm text-muted">
            {plural(state.companies.filter((c) => c.active).length, "company", "companies")} per
            run · times in UTC
          </p>
        )}
      </div>
      {state.status === "ready" && (
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="rounded-md px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface"
          >
            Edit schedule
          </Link>
          <button
            type="button"
            onClick={runNow}
            disabled={running}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-60"
          >
            {running ? "Running…" : "Run now"}
          </button>
        </div>
      )}
    </div>
  );

  if (state.status !== "ready") {
    return (
      <>
        {header}
        {state.status === "loading" ? (
          <p className="text-sm text-muted">Loading runs…</p>
        ) : (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        )}
      </>
    );
  }

  const next = nextCronRun(state.cron, now);
  const today = runs.filter((r) => isSameUtcDay(new Date(r.started_at), now));
  const newToday = today.reduce((sum, r) => sum + r.jobs_found, 0);
  const latestResults = latest && breakdowns[latest.id]?.results;
  const scraped = latestResults?.reduce((sum, r) => sum + r.jobs_found, 0);
  const attention = latestResults?.filter(needsAttention).length;
  const companies = new Map(state.companies.map((c) => [c.id, c]));

  return (
    <>
      {banner && (
        <p
          role="status"
          className="rounded-md border border-accent/40 bg-surface px-4 py-3 text-sm font-semibold"
        >
          {banner}
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      )}

      {header}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          kicker="Next run"
          value={next ? untilLabel(next.getTime() - now.getTime()).replace("about ", "") : "—"}
          detail={next ? formatUtc(next) : "No valid schedule"}
        />
        <Card
          kicker="New jobs today"
          value={newToday.toLocaleString("en-GB")}
          detail={`Across ${plural(today.length, "run")} today`}
        />
        <Card
          kicker="Scraped last run"
          value={scraped === undefined ? "—" : scraped.toLocaleString("en-GB")}
          detail={
            latestResults
              ? `From ${plural(latestResults.length, "company", "companies")}`
              : "No runs yet"
          }
        />
        <Card
          kicker="Need attention"
          value={attention === undefined ? "—" : String(attention)}
          detail="Failed, or returned 0 or 1 jobs"
        />
      </div>

      {runs.length === 0 ? (
        <div className="rounded-md border border-dashed border-divider px-6 py-12 text-center">
          <h2 className="font-heading text-xl">No runs yet</h2>
          <p className="mt-2 text-sm text-muted">
            The first scheduled run fills this in, or start one now.
          </p>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_minmax(0,24rem)]">
          <section aria-label="History" className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">History</h2>
            <div className="overflow-x-auto rounded-md border border-divider">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Started</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Trigger</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">New</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    const isSelected = run.id === selected?.id;
                    return (
                      <tr
                        key={run.id}
                        aria-selected={isSelected}
                        className={`border-t border-divider ${isSelected ? "bg-surface/60" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedId(run.id)}
                            aria-pressed={isSelected}
                            className="font-semibold underline-offset-2 hover:underline"
                          >
                            {startedLabel(run.started_at, now)}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {run.trigger === "cron" ? "Scheduled" : "Manual"}
                        </td>
                        <td className="px-4 py-3">
                          {run.status === "running" ? "—" : run.jobs_found.toLocaleString("en-GB")}
                        </td>
                        <td className="px-4 py-3">
                          <RunResult run={run} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {selected && (
            <RunBreakdown
              run={selected}
              now={now}
              companies={companies}
              results={breakdowns[selected.id]?.results}
              error={breakdowns[selected.id]?.error}
            />
          )}
        </div>
      )}
    </>
  );
}
