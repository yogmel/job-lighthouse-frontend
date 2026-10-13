"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { listCompanies, type Company } from "@/lib/api/companies";
import { getConfig } from "@/lib/api/config";
import { toFormErrors } from "@/lib/api/errors";
import { listRunCompanies, listRuns, type Run, type RunCompanyResult } from "@/lib/api/runs";
import { formatUtc, nextCronRun, untilLabel } from "@/lib/cron";
import { Banner, BANNER_DISMISS_MS } from "../banner";
import { RunConfirmDialog } from "../run-confirm-dialog";
import { useRuns, withRun } from "../run-context";
import { isSameUtcDay, plural, startedLabel } from "./format";
import { attentionReason, needsAttention, RunBreakdown } from "./run-breakdown";

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

const cardClass = "flex flex-col gap-1 rounded-md bg-surface px-4 py-3 text-left";

function CardBody({ kicker, value, detail }: { kicker: string; value: string; detail: string }) {
  return (
    <>
      <span className="text-xs font-semibold tracking-wide text-muted uppercase">{kicker}</span>
      <span className="font-heading text-2xl">{value}</span>
      <span className="text-xs text-muted">{detail}</span>
    </>
  );
}

function Card(props: { kicker: string; value: string; detail: string }) {
  return (
    <div className={cardClass}>
      <CardBody {...props} />
    </div>
  );
}

/** A card that opens the list below it; disabled when there is nothing to open. */
function CardButton({
  expanded,
  disabled,
  controls,
  onClick,
  ...body
}: {
  kicker: string;
  value: string;
  detail: string;
  expanded: boolean;
  disabled: boolean;
  controls: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      disabled={disabled}
      onClick={onClick}
      className={`${cardClass} enabled:cursor-pointer enabled:hover:ring-1 enabled:hover:ring-accent disabled:cursor-default ${
        expanded ? "ring-1 ring-accent" : ""
      }`}
    >
      <CardBody {...body} />
    </button>
  );
}

/** The Company a Single-company run was for, from its breakdown row (kept after the Company is deleted). */
function singleCompanyName(
  run: Run,
  breakdown: Breakdown | undefined,
  companies: Map<string, Company>,
): string | undefined {
  const row = breakdown?.results?.find((r) => r.company_id === run.company_id);
  return row?.company_name || (run.company_id ? companies.get(run.company_id)?.name : undefined);
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
  /** A pending Run now confirm: a Full run, or a Single-company run for `company`. */
  const [confirming, setConfirming] = useState<{ company?: { id: string; name: string } }>();
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [banner, setBanner] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const dismissBanner = useCallback(() => setBanner(undefined), []);
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
  // Single-company runs are named from their breakdown row, so those load too.
  const singleIds = runs.filter((r) => r.scope === "company").map((r) => r.id);
  const wanted = [...new Set([latest?.id, selected?.id, ...singleIds])]
    .filter((id) => id !== undefined)
    .join(",");
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

  async function runNow(company?: { id: string; name: string }) {
    setConfirming(undefined);
    setRunning(true);
    setBanner(undefined);
    setActionError(undefined);
    try {
      const run = await trigger(company?.id);
      setState((prev) => (prev.status === "ready" ? { ...prev, runs: withRun(prev.runs, run) } : prev));
      setSelectedId(run.id);
      const target = company ? ` for ${company.name}` : "";
      setBanner(run.status === "running" ? `Run started${target}.` : `Run finished${target}.`);
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
            onClick={() => setConfirming({})}
            disabled={running}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-60"
          >
            {running ? "Running…" : "Run now"}
          </button>
        </div>
      )}
      {confirming && (
        <RunConfirmDialog
          companyName={confirming.company?.name}
          onConfirm={() => runNow(confirming.company)}
          onClose={() => setConfirming(undefined)}
        />
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
  const attentionRows = latestResults?.filter(needsAttention);
  const attention = attentionRows?.length;
  const companies = new Map(state.companies.map((c) => [c.id, c]));
  const showAttention = attentionOpen && !!attention;

  return (
    <>
      {banner && (
        <Banner onDismiss={dismissBanner} autoDismissMs={BANNER_DISMISS_MS}>
          {banner}
        </Banner>
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
        <CardButton
          kicker="Need attention"
          value={attention === undefined ? "—" : String(attention)}
          detail="Failed, or returned 0 or 1 jobs"
          expanded={showAttention}
          disabled={!attention}
          controls="need-attention-list"
          onClick={() => setAttentionOpen((open) => !open)}
        />
      </div>

      {showAttention && attentionRows && (
        <section
          id="need-attention-list"
          aria-label="Need attention"
          className="rounded-md border border-divider"
        >
          <ul className="divide-y divide-divider text-sm">
            {attentionRows.map((result) => {
              const company = companies.get(result.company_id);
              const name = result.company_name || company?.name || "Removed company";
              return (
                <li key={result.id} className="flex items-center gap-3 px-4 py-3">
                  {company ? (
                    <a
                      href={company.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline-offset-2 hover:underline"
                    >
                      {name}
                    </a>
                  ) : (
                    <span className="font-semibold">{name}</span>
                  )}
                  <span className={`flex-1 ${result.status === "failed" ? "text-danger" : "text-muted"}`}>
                    {attentionReason(result)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Run ${name} now`}
                    title={
                      !company
                        ? "This company was removed"
                        : company.active
                          ? "Run now"
                          : "Resume this company to run it"
                    }
                    disabled={!company?.active || running}
                    onClick={() => company && setConfirming({ company: { id: company.id, name } })}
                    className="rounded-sm p-1.5 text-muted hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="size-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
                        onClick={() => setSelectedId(run.id)}
                        className={`cursor-pointer border-t border-divider hover:bg-surface/40 ${isSelected ? "bg-surface/60" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedId(run.id)}
                            aria-pressed={isSelected}
                            className="rounded-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                          >
                            {startedLabel(run.started_at, now)}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {run.trigger === "cron" ? "Scheduled" : "Manual"}
                          {run.scope === "company" && (
                            <span className="mt-1 flex items-center gap-2">
                              <span className="rounded-sm bg-surface px-1.5 py-0.5 text-xs font-semibold text-foreground">
                                Single company
                              </span>
                              <span className="text-foreground">
                                {singleCompanyName(run, breakdowns[run.id], companies) ??
                                  (breakdowns[run.id]?.error ? "Unknown company" : "…")}
                              </span>
                            </span>
                          )}
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
