"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { listCompanies, type Company } from "@/lib/api/companies";
import { toFormErrors } from "@/lib/api/errors";
import { listJobs, type Job } from "@/lib/api/jobs";
import { triggerRun, type Run } from "@/lib/api/runs";
import { DEFAULT_FILTERS, JobFilters, type Filters } from "./job-filters";
import { JobsList, type JobRow } from "./jobs-list";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; jobs: Job[]; companies: Company[] };

const ALREADY_RUNNING = "A run is already in progress. New jobs show up when it finishes.";

function errorMessage(err: unknown): string {
  return toFormErrors(err, []).formError ?? "Something went wrong. Please try again.";
}

function toRows(jobs: Job[], companies: Company[]): JobRow[] {
  const byId = new Map(companies.map((c) => [c.id, c]));
  return jobs.map((job) => {
    const company = byId.get(job.company_id);
    return { ...job, companyName: company?.name ?? job.company, tier: company?.tier };
  });
}

function matches(job: JobRow, { active, companyId, tier }: Filters): boolean {
  if (active === "active" && !job.active) return false;
  if (active === "closed" && job.active) return false;
  if (companyId && job.company_id !== companyId) return false;
  if (tier && String(job.tier) !== tier) return false;
  return true;
}

function isDefault(filters: Filters): boolean {
  return (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).every(
    (key) => filters[key] === DEFAULT_FILTERS[key],
  );
}

function runBanner(run: Run): string {
  if (run.status === "running") return "Run started. New jobs show up when it finishes.";
  const found = `${run.jobs_found} new ${run.jobs_found === 1 ? "job" : "jobs"}`;
  return `Run finished. ${found}.`;
}

export function JobsScreen() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [running, setRunning] = useState(false);
  const [banner, setBanner] = useState<string>();
  const [actionError, setActionError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    Promise.all([listJobs(), listCompanies()]).then(
      ([jobs, companies]) => !cancelled && setState({ status: "ready", jobs, companies }),
      (err: unknown) => !cancelled && setState({ status: "error", message: errorMessage(err) }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  async function runNow() {
    setRunning(true);
    setBanner(undefined);
    setActionError(undefined);
    try {
      const run = await triggerRun();
      if (run.status === "failed") {
        setActionError(run.error ? `Run failed: ${run.error}` : "Run failed.");
        return;
      }
      setBanner(runBanner(run));
      if (run.status === "success") {
        const jobs = await listJobs();
        setState((prev) => (prev.status === "ready" ? { ...prev, jobs } : prev));
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setBanner(ALREADY_RUNNING);
      else setActionError(errorMessage(err));
    } finally {
      setRunning(false);
    }
  }

  const rows = state.status === "ready" ? toRows(state.jobs, state.companies) : [];
  const visible = rows.filter((job) => matches(job, filters));
  const openCount = rows.filter((job) => job.active).length;

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

      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl">Jobs</h1>
          {state.status === "ready" && rows.length > 0 && (
            <p className="text-sm text-muted">{openCount} open</p>
          )}
        </div>
        {state.status === "ready" && (
          <button
            type="button"
            onClick={runNow}
            disabled={running}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-60"
          >
            {running ? "Running…" : "Run now"}
          </button>
        )}
      </div>

      {state.status === "loading" && <p className="text-sm text-muted">Loading jobs…</p>}

      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}

      {state.status === "ready" &&
        (rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-divider px-6 py-12 text-center">
            <h2 className="font-heading text-xl">No jobs yet</h2>
            <p className="mt-2 text-sm text-muted">
              Run now to fetch openings from the companies you watch.
            </p>
          </div>
        ) : (
          <>
            <JobFilters filters={filters} companies={state.companies} onChange={setFilters} />
            {visible.length === 0 ? (
              <div className="rounded-md border border-dashed border-divider px-6 py-12 text-center">
                <h2 className="font-heading text-xl">No jobs match these filters</h2>
                {/* Default filters already: only closed jobs exist, so offer those. */}
                <button
                  type="button"
                  onClick={() =>
                    setFilters(isDefault(filters) ? { ...filters, active: "all" } : DEFAULT_FILTERS)
                  }
                  className="mt-3 text-sm font-semibold text-accent-strong hover:underline"
                >
                  {isDefault(filters) ? "Show closed jobs" : "Clear filters"}
                </button>
              </div>
            ) : (
              <JobsList jobs={visible} />
            )}
          </>
        ))}
    </>
  );
}
