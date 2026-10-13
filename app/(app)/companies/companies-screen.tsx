"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  createCompany,
  listCompanies,
  updateCompany,
  type Company,
} from "@/lib/api/companies";
import { ApiError } from "@/lib/api/client";
import { listRunCompanies, listRuns } from "@/lib/api/runs";
import { toFormErrors } from "@/lib/api/errors";
import { Banner, BANNER_DISMISS_MS } from "../banner";
import { RunConfirmDialog } from "../run-confirm-dialog";
import { useRuns } from "../run-context";
import { CompaniesTable, needsCustomHandling } from "./companies-table";
import { CompanyDialog } from "./company-dialog";
import { CompanyFilterBar } from "./company-filter-bar";
import {
  DEFAULT_FILTERS,
  lastRunOutcomes,
  latestFullRun,
  matchesFilters,
  parseFilters,
  writeFilters,
  type CompanyFilters,
  type LastRunOutcome,
} from "./company-filters";
import type { CompanyDefaults } from "./company-fields";
import { parseSort, sortCompanies, writeSort, type CompanySort } from "./company-sort";
import { RemoveCompanyDialog } from "./remove-company-dialog";
import { icons, type RowAction } from "./row-actions";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; companies: Company[] };

/** What the URL holds: filters and sort. */
type View = { filters: CompanyFilters; sort: CompanySort };

function parseView(params: URLSearchParams): View {
  return { filters: parseFilters(params), sort: parseSort(params) };
}

/** Each Company's outcome in the latest Full run, for the Last run filter. */
type LastRun =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; outcomes: Map<string, LastRunOutcome> };

async function loadLastRun(): Promise<Map<string, LastRunOutcome>> {
  const run = latestFullRun(await listRuns());
  return run ? lastRunOutcomes(await listRunCompanies(run.id)) : new Map();
}

function errorMessage(err: unknown): string {
  return toFormErrors(err, []).formError ?? "Something went wrong. Please try again.";
}

function toDefaults({ name, tier, website_url, source }: Company): CompanyDefaults {
  return { name, tier, website_url, source: source.kind === "custom" ? undefined : source };
}

function summary(companies: Company[]): string {
  const paused = companies.filter((c) => !c.active).length;
  const watched = companies.length - paused;
  return paused > 0 ? `${watched} watched · ${paused} paused` : `${watched} watched`;
}

function FilteredTable({
  companies,
  sort,
  onSort,
  rowActions,
  onClear,
}: {
  companies: Company[];
  sort: CompanySort;
  onSort: (sort: CompanySort) => void;
  rowActions: (company: Company) => RowAction[];
  onClear: () => void;
}) {
  if (companies.length > 0) {
    return <CompaniesTable companies={companies} sort={sort} onSort={onSort} rowActions={rowActions} />;
  }
  return (
    <div className="rounded-md border border-dashed border-divider px-6 py-12 text-center">
      <h2 className="font-heading text-xl">No companies match these filters</h2>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 text-sm font-semibold text-accent-strong hover:underline"
      >
        Clear filters
      </button>
    </div>
  );
}

export type JustAdded = { name: string; found: number; matched: number; via: string };

function addedBanner({ name, found, matched, via }: JustAdded): string {
  const board = via.charAt(0).toUpperCase() + via.slice(1);
  return `${name} added. Watching ${found} openings via ${board} — ${matched} pass your filters and are already scored.`;
}

export function CompaniesScreen({ justAdded }: { justAdded?: JustAdded }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Company>();
  const [removing, setRemoving] = useState<Company>();
  const [confirmingRun, setConfirmingRun] = useState<Company>();
  const [banner, setBanner] = useState<string | undefined>(justAdded && addedBanner(justAdded));
  const [actionError, setActionError] = useState<string>();
  const [runningId, setRunningId] = useState<string>();
  const { trigger, triggered } = useRuns();
  const dismissBanner = useCallback(() => setBanner(undefined), []);
  const [lastRun, setLastRun] = useState<LastRun>({ status: "loading" });

  // Filters and sort live in the URL. Local state answers right away; it re-reads
  // the URL whenever the query changes from outside (e.g. a link to /companies).
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [view, setViewState] = useState<View>(() => parseView(searchParams));
  const [readQuery, setReadQuery] = useState(query);
  if (query !== readQuery) {
    setReadQuery(query);
    setViewState(parseView(searchParams));
  }
  const { filters, sort } = view;

  function setView(next: View) {
    setViewState(next);
    // Native history updates sync with useSearchParams without a server round trip.
    const current = new URLSearchParams(window.location.search);
    const params = writeSort(writeFilters(current, next.filters), next.sort).toString();
    window.history.replaceState(null, "", params ? `?${params}` : window.location.pathname);
  }

  const setFilters = (next: CompanyFilters) => setView({ ...view, filters: next });
  const setSort = (next: CompanySort) => setView({ ...view, sort: next });

  useEffect(() => {
    let cancelled = false;
    listCompanies().then(
      (companies) => !cancelled && setState({ status: "ready", companies }),
      (err: unknown) => !cancelled && setState({ status: "error", message: errorMessage(err) }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // A run started on this visit that finished right away can change the outcomes.
  const finishedRun = triggered?.status === "running" ? undefined : triggered?.id;
  useEffect(() => {
    let cancelled = false;
    loadLastRun().then(
      (outcomes) => !cancelled && setLastRun({ status: "ready", outcomes }),
      () => !cancelled && setLastRun({ status: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [finishedRun]);

  /** The company is already gone on the server: reload the list to match. */
  async function onGone(company: Company) {
    setRemoving(undefined);
    setActionError(undefined);
    try {
      setState({ status: "ready", companies: await listCompanies() });
      setBanner(`${company.name} was already removed.`);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  function onCreated(company: Company) {
    setState((prev) =>
      prev.status === "ready" ? { ...prev, companies: [...prev.companies, company] } : prev,
    );
    setAdding(false);
    setBanner(`${company.name} added.`);
  }

  function replaceCompany(company: Company) {
    setState((prev) =>
      prev.status === "ready"
        ? { ...prev, companies: prev.companies.map((c) => (c.id === company.id ? company : c)) }
        : prev,
    );
  }

  function onUpdated(before: Company, after: Company) {
    replaceCompany(after);
    setEditing(undefined);
    setBanner(
      after.tier === before.tier
        ? `${after.name} updated.`
        : `${after.name} updated. Now Tier ${after.tier}.`,
    );
  }

  /** Pausing keeps the row and its jobs; runs just skip the company. */
  async function setActive(company: Company, active: boolean) {
    setActionError(undefined);
    try {
      replaceCompany(await updateCompany(company.id, { active }));
      setBanner(`${company.name} ${active ? "resumed" : "paused"}.`);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  /** Starts a Single-company run. 409 (paused / run in progress) and 404 show the backend's message. */
  async function runNow(company: Company) {
    setConfirmingRun(undefined);
    if (runningId) return;
    setRunningId(company.id);
    setBanner(undefined);
    setActionError(undefined);
    try {
      const run = await trigger(company.id);
      setBanner(
        run.status === "running" ? `Run started for ${company.name}.` : `Run finished for ${company.name}.`,
      );
    } catch (err) {
      setActionError(errorMessage(err));
      // 404: the company is gone, so the list is stale.
      if (err instanceof ApiError && err.status === 404) {
        listCompanies().then(
          (companies) => setState({ status: "ready", companies }),
          () => {},
        );
      }
    } finally {
      setRunningId(undefined);
    }
  }

  function onRemoved(company: Company) {
    setState((prev) =>
      prev.status === "ready"
        ? { ...prev, companies: prev.companies.filter((c) => c.id !== company.id) }
        : prev,
    );
    setRemoving(undefined);
    setBanner(`${company.name} and its jobs removed.`);
  }

  function rowActions(company: Company): RowAction[] {
    const { name } = company;
    // Resuming would only make runs fail: there is no handler to call yet.
    const noHandler = needsCustomHandling(company);
    const pausedTip = noHandler
      ? "Paused until a developer ships a handler for this company"
      : "Resume this company to run it";
    return [
      { label: `Edit ${name}`, tooltip: "Edit", icon: icons.edit, onClick: () => setEditing(company) },
      {
        label: `Run ${name} now`,
        tooltip: company.active ? "Run now" : pausedTip,
        icon: icons.run,
        onClick: () => setConfirmingRun(company),
        disabled: !company.active,
      },
      company.active
        ? {
            label: `Pause ${name}`,
            tooltip: "Pause watching",
            icon: icons.pause,
            onClick: () => setActive(company, false),
          }
        : {
            label: `Resume ${name}`,
            tooltip: noHandler ? pausedTip : "Resume watching",
            icon: icons.resume,
            onClick: () => setActive(company, true),
            disabled: noHandler,
          },
      {
        label: `Remove ${name}`,
        tooltip: "Remove",
        icon: icons.remove,
        onClick: () => setRemoving(company),
        danger: true,
      },
    ];
  }

  return (
    <>
      {banner && (
        <Banner onDismiss={dismissBanner} autoDismissMs={BANNER_DISMISS_MS}>
          {banner}
          {justAdded && banner === addedBanner(justAdded) && (
            <Link href="/jobs" className="ml-3 underline">
              View jobs
            </Link>
          )}
        </Banner>
      )}

      {actionError && (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      )}

      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl">Companies</h1>
          {state.status === "ready" && state.companies.length > 0 && (
            <p className="text-sm text-muted">{summary(state.companies)}</p>
          )}
        </div>
        {state.status === "ready" && (
          <div className="flex items-center gap-2">
            <Link
              href="/companies/new"
              className="rounded-md px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface"
            >
              Add from URL
            </Link>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
            >
              + Add company
            </button>
          </div>
        )}
      </div>

      {state.status === "loading" && <p className="text-sm text-muted">Loading companies…</p>}

      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}

      {state.status === "ready" &&
        (state.companies.length === 0 ? (
          <div className="rounded-md border border-dashed border-divider px-6 py-12 text-center">
            <h2 className="font-heading text-xl">No companies yet</h2>
            <p className="mt-2 text-sm text-muted">
              Add a company to start watching its openings.
            </p>
          </div>
        ) : (
          <>
            <CompanyFilterBar filters={filters} companies={state.companies} onChange={setFilters} />
            {filters.lastRun && lastRun.status === "error" && (
              <p role="alert" className="text-sm text-danger">
                Couldn&apos;t load the last run, so the Last run filter matches nothing.
              </p>
            )}
            {filters.lastRun && lastRun.status === "loading" ? (
              <p className="text-sm text-muted">Loading last run…</p>
            ) : (
              <FilteredTable
                companies={sortCompanies(
                  state.companies.filter((c) =>
                    matchesFilters(c, filters, lastRun.status === "ready" ? lastRun.outcomes : undefined),
                  ),
                  sort,
                )}
                sort={sort}
                onSort={setSort}
                rowActions={rowActions}
                onClear={() => setFilters(DEFAULT_FILTERS)}
              />
            )}
          </>
        ))}

      {adding && (
        <CompanyDialog
          title="Add company"
          submitLabel="Add company"
          pendingLabel="Adding…"
          idPrefix="add"
          save={createCompany}
          onSaved={onCreated}
          onClose={() => setAdding(false)}
        />
      )}

      {editing && (
        <CompanyDialog
          key={editing.id}
          title={`Edit ${editing.name}`}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          idPrefix="edit"
          defaults={toDefaults(editing)}
          tierHint={(tier) =>
            tier === editing.tier
              ? undefined
              : "Changing the tier re-groups this company's existing jobs."
          }
          save={(input) => updateCompany(editing.id, input)}
          onSaved={(company) => onUpdated(editing, company)}
          onClose={() => setEditing(undefined)}
        />
      )}

      {confirmingRun && (
        <RunConfirmDialog
          companyName={confirmingRun.name}
          onConfirm={() => runNow(confirmingRun)}
          onClose={() => setConfirmingRun(undefined)}
        />
      )}

      {removing && (
        <RemoveCompanyDialog
          key={removing.id}
          company={removing}
          onRemoved={onRemoved}
          onGone={onGone}
          onClose={() => setRemoving(undefined)}
        />
      )}
    </>
  );
}
