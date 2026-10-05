"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  createCompany,
  listCompanies,
  updateCompany,
  type Company,
} from "@/lib/api/companies";
import { ApiError } from "@/lib/api/client";
import { toFormErrors } from "@/lib/api/errors";
import { useRuns } from "../run-context";
import { CompaniesTable, needsCustomHandling } from "./companies-table";
import { CompanyDialog } from "./company-dialog";
import type { CompanyDefaults } from "./company-fields";
import { RemoveCompanyDialog } from "./remove-company-dialog";
import type { RowMenuItem } from "./row-menu";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; companies: Company[] };

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
  const [banner, setBanner] = useState<string | undefined>(justAdded && addedBanner(justAdded));
  const [actionError, setActionError] = useState<string>();
  const [runningId, setRunningId] = useState<string>();
  const { trigger } = useRuns();

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

  function menuItems(company: Company): RowMenuItem[] {
    const edit = { label: "Edit company", onSelect: () => setEditing(company) };
    const remove = { label: "Remove company", onSelect: () => setRemoving(company), danger: true };
    // Resuming would only make runs fail: there is no handler to call yet.
    if (needsCustomHandling(company)) return [edit, remove];
    return [
      edit,
      ...(company.active
        ? [
            { label: "Run now", onSelect: () => runNow(company) },
            { label: "Pause watching", onSelect: () => setActive(company, false) },
          ]
        : [{ label: "Resume watching", onSelect: () => setActive(company, true) }]),
      remove,
    ];
  }

  return (
    <>
      {banner && (
        <p
          role="status"
          className="rounded-md border border-accent/40 bg-surface px-4 py-3 text-sm font-semibold"
        >
          {banner}
          {justAdded && banner === addedBanner(justAdded) && (
            <Link href="/jobs" className="ml-3 underline">
              View jobs
            </Link>
          )}
        </p>
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
          <CompaniesTable companies={state.companies} menuItems={menuItems} />
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
