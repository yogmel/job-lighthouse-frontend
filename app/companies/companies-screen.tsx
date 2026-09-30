"use client";

import { useEffect, useState } from "react";
import { listCompanies, type Company } from "@/lib/api/companies";
import { toFormErrors } from "@/lib/api/errors";
import { AddCompanyForm } from "./add-company-form";
import { CompaniesTable } from "./companies-table";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; companies: Company[] };

function errorMessage(err: unknown): string {
  return toFormErrors(err, []).formError ?? "Something went wrong. Please try again.";
}

function summary(companies: Company[]): string {
  const paused = companies.filter((c) => !c.active).length;
  const watched = companies.length - paused;
  return paused > 0 ? `${watched} watched · ${paused} paused` : `${watched} watched`;
}

export function CompaniesScreen() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [adding, setAdding] = useState(false);
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
          <CompaniesTable companies={state.companies} />
        ))}

      {adding && <AddCompanyForm onCreated={onCreated} onClose={() => setAdding(false)} />}
    </>
  );
}
