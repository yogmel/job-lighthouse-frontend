"use client";

import { useEffect, useState } from "react";
import {
  createCompany,
  listCompanies,
  updateCompany,
  type Company,
} from "@/lib/api/companies";
import { toFormErrors } from "@/lib/api/errors";
import { CompaniesTable } from "./companies-table";
import { CompanyDialog } from "./company-dialog";
import type { CompanyDefaults } from "./company-fields";
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

export function CompaniesScreen() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Company>();
  const [banner, setBanner] = useState<string>();

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

  function menuItems(company: Company): RowMenuItem[] {
    return [{ label: "Edit company", onSelect: () => setEditing(company) }];
  }

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

      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl">Companies</h1>
          {state.status === "ready" && state.companies.length > 0 && (
            <p className="text-sm text-muted">{summary(state.companies)}</p>
          )}
        </div>
        {state.status === "ready" && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
          >
            + Add company
          </button>
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
    </>
  );
}
