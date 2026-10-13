"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { listCompanies, type Company } from "@/lib/api/companies";
import { toFormErrors } from "@/lib/api/errors";
import { listJobs, type Job, type JobsPage } from "@/lib/api/jobs";
import { useRuns } from "../run-context";
import {
  DEFAULT_FILTERS,
  filtersFromParams,
  filtersToParams,
  filtersToQuery,
  JobFilters,
  type Filters,
} from "./job-filters";
import { JobsList, type JobRow } from "./jobs-list";

/** One loaded list; `key` names the filters it was fetched with. */
type Loaded = {
  key: string;
  jobs: Job[];
  /** Cursor for the next page; null once the last page is loaded. */
  nextCursor: string | null;
  /** Match count from the first page; kept while paging, null if the backend didn't send it. */
  total: number | null;
  /** Per-tier match counts from the first page; kept while paging, null if the backend didn't send them. */
  tierCounts: Record<string, number> | null;
};

function errorMessage(err: unknown): string {
  return toFormErrors(err, []).formError ?? "Something went wrong. Please try again.";
}

/** Appends a page, skipping Jobs already loaded. */
function appendPage(jobs: Job[], page: JobsPage): Job[] {
  const seen = new Set(jobs.map((job) => job.id));
  return [...jobs, ...page.jobs.filter((job) => !seen.has(job.id))];
}

function toRows(jobs: Job[], companies: Company[]): JobRow[] {
  const byId = new Map(companies.map((c) => [c.id, c]));
  return jobs.map((job) => {
    const company = byId.get(job.company_id);
    return { ...job, companyName: company?.name ?? job.company, tier: company?.tier };
  });
}

function isDefault(filters: Filters): boolean {
  return (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).every(
    (key) => filters[key] === DEFAULT_FILTERS[key],
  );
}

export function JobsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Filters live in the URL; the canonical string is also the identity of a fetch.
  const filtersKey = filtersToParams(filtersFromParams(searchParams)).toString();
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(filtersKey)), [filtersKey]);

  const [loaded, setLoaded] = useState<Loaded>();
  const [companies, setCompanies] = useState<Company[]>();
  /** `key` is the filters a failed fetch was for; null = the companies list. */
  const [loadError, setLoadError] = useState<{ key: string | null; message: string }>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string>();
  const { triggered } = useRuns();

  // Responses for filters that are no longer current are dropped.
  const currentKey = useRef(filtersKey);
  useEffect(() => {
    currentKey.current = filtersKey;
  }, [filtersKey]);

  function setFilters(next: Filters) {
    const qs = filtersToParams(next).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => {
    let cancelled = false;
    listCompanies().then(
      (list) => !cancelled && setCompanies(list),
      (err: unknown) => !cancelled && setLoadError({ key: null, message: errorMessage(err) }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Every filter change starts over from the first page.
  useEffect(() => {
    let cancelled = false;
    listJobs(filtersToQuery(filters)).then(
      (page) => {
        if (cancelled) return;
        setLoaded({
          key: filtersKey,
          jobs: page.jobs,
          nextCursor: page.nextCursor,
          total: page.total,
          tierCounts: page.tierCounts,
        });
        setLoadError(undefined);
        setMoreError(undefined);
      },
      (err: unknown) => !cancelled && setLoadError({ key: filtersKey, message: errorMessage(err) }),
    );
    return () => {
      cancelled = true;
    };
  }, [filters, filtersKey]);

  // A run started from the header that finished right away brings new jobs.
  const finishedRun = triggered?.status === "success" ? triggered.id : undefined;
  useEffect(() => {
    if (!finishedRun) return;
    let cancelled = false;
    const key = currentKey.current;
    // Starts over from the first page: the new jobs sit at the top, so the loaded pages and cursor are stale.
    listJobs(filtersToQuery(filtersFromParams(new URLSearchParams(key)))).then(
      (page) =>
        !cancelled &&
        currentKey.current === key &&
        setLoaded({ key, jobs: page.jobs, nextCursor: page.nextCursor, total: page.total, tierCounts: page.tierCounts }),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [finishedRun]);

  /** Reloads from the first page with the same filters; the old list stays up meanwhile. */
  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError(undefined);
    const key = filtersKey;
    try {
      const [page, list] = await Promise.all([listJobs(filtersToQuery(filters)), listCompanies()]);
      setCompanies(list);
      if (currentKey.current === key) {
        setLoaded({ key, jobs: page.jobs, nextCursor: page.nextCursor, total: page.total, tierCounts: page.tierCounts });
        setMoreError(undefined);
      }
    } catch (err) {
      setRefreshError(errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }

  const nextCursor = loaded?.nextCursor ?? null;

  async function loadMore() {
    if (!loaded || !nextCursor || loadingMore) return;
    const { key } = loaded;
    setLoadingMore(true);
    setMoreError(undefined);
    try {
      const page = await listJobs(filtersToQuery(filters), nextCursor);
      // Ignore the page if a reload or filter change replaced the list (and cursor) meanwhile.
      setLoaded((prev) =>
        prev && prev.key === key && prev.nextCursor === nextCursor
          ? { ...prev, jobs: appendPage(prev.jobs, page), nextCursor: page.nextCursor }
          : prev,
      );
    } catch (err) {
      setMoreError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  const fatalError = !loaded || !companies ? loadError : undefined;
  const ready = loaded && companies;
  /** The list on screen belongs to earlier filters; the new ones are still loading. */
  const switching = ready && loaded.key !== filtersKey && loadError?.key !== filtersKey;
  const filterError = ready && loadError?.key === filtersKey ? loadError.message : undefined;

  const rows = ready ? toRows(loaded.jobs, companies) : [];
  const openCount = rows.filter((job) => job.active).length;
  const everything = filters.active === "all" && !filters.companyId && !filters.tier;

  return (
    <>
      <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl">Jobs</h1>
        {ready && rows.length > 0 && (
          <p className="flex gap-2 text-sm text-muted">
            <span>{openCount} open</span>
            {loaded.total !== null && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {rows.length} of {loaded.total} jobs
                </span>
              </>
            )}
          </p>
        )}
      </div>
        {ready && (
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="rounded-md border border-divider px-4 py-2 text-sm font-semibold hover:border-accent disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        )}
      </div>
      {refreshError && (
        <p role="alert" className="text-sm text-danger">
          {refreshError}
        </p>
      )}

      {!ready && !fatalError && <p className="text-sm text-muted">Loading jobs…</p>}

      {fatalError && (
        <p role="alert" className="text-sm text-danger">
          {fatalError.message}
        </p>
      )}

      {ready && (
        <>
          <JobFilters filters={filters} companies={companies} onChange={setFilters} />
          {filterError && (
            <p role="alert" className="text-sm text-danger">
              {filterError}
            </p>
          )}
          {/* The list scrolls here, not the page: tier headings stay pinned and Load more sits at the bottom. */}
          <div
            data-testid="jobs-scroll"
            aria-busy={switching}
            className={`flex max-h-[70dvh] flex-col gap-4 overflow-y-auto overscroll-contain ${
              switching ? "opacity-60" : ""
            }`}
          >
            {rows.length === 0 ? (
              everything ? (
                <div className="rounded-md border border-dashed border-divider px-6 py-12 text-center">
                  <h2 className="font-heading text-xl">No jobs yet</h2>
                  <p className="mt-2 text-sm text-muted">
                    Run now to fetch openings from the companies you watch.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-divider px-6 py-12 text-center">
                  <h2 className="font-heading text-xl">No jobs match these filters</h2>
                  {/* Default filters already: only closed jobs can exist, so offer those. */}
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
              )
            ) : (
              <JobsList jobs={rows} tierCounts={loaded?.tierCounts ?? null} />
            )}
            {moreError && (
              <p role="alert" className="text-sm text-danger">
                {moreError}
              </p>
            )}
            {nextCursor && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore || switching}
                className="self-center rounded-md border border-divider px-4 py-2 text-sm font-semibold hover:border-accent disabled:opacity-60"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
