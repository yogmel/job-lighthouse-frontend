"use client";

import { useEffect, useState } from "react";
import { exportAccount, getAccount, type Account } from "@/lib/api/account";
import { toFormErrors } from "@/lib/api/errors";
import { downloadJson } from "@/lib/download";
import { hardRedirect } from "@/lib/navigation";
import { LOGIN_PATH, SIGNUP_PATH } from "@/lib/routes";
import { clearToken } from "@/lib/session";
import { CredentialsForm } from "./credentials-form";
import { DeleteAccountDialog } from "./delete-account-dialog";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; account: Account };

function errorMessage(err: unknown): string {
  return toFormErrors(err, []).formError ?? "Something went wrong. Please try again.";
}

function exportFilename(now = new Date()): string {
  return `job-lighthouse-export-${now.toISOString().slice(0, 10)}.json`;
}

export function AccountTab() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [banner, setBanner] = useState<string>();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAccount().then(
      (account) => !cancelled && setState({ status: "ready", account }),
      (err: unknown) => !cancelled && setState({ status: "error", message: errorMessage(err) }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") return <p className="text-sm text-muted">Loading account…</p>;
  if (state.status === "error") {
    return (
      <p role="alert" className="text-sm text-danger">
        {state.message}
      </p>
    );
  }

  const { account } = state;

  function onSaved(next: Account) {
    setState({ status: "ready", account: next });
    setBanner("Account updated.");
  }

  async function exportData() {
    setExporting(true);
    setExportError(undefined);
    try {
      downloadJson(await exportAccount(), exportFilename());
    } catch (err) {
      setExportError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  function endSession(path: string) {
    clearToken();
    hardRedirect(path);
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-heading text-xl">Account</h2>

      {banner && (
        <p
          role="status"
          className="rounded-md border border-accent/40 bg-surface px-4 py-3 text-sm font-semibold"
        >
          {banner}
        </p>
      )}

      <CredentialsForm account={account} onSaved={onSaved} />

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Your data</h3>
        <div className="flex items-center gap-3 rounded-md border border-divider px-4 py-3">
          <p className="flex-1 text-sm text-muted">
            Export companies, jobs, runs and config as JSON
          </p>
          <button
            type="button"
            onClick={exportData}
            disabled={exporting}
            className="rounded-md border border-divider px-4 py-2 text-sm font-semibold hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export"}
          </button>
        </div>
        {exportError && (
          <p role="alert" className="text-sm text-danger">
            {exportError}
          </p>
        )}
      </section>

      <section className="flex items-center gap-3 rounded-md border border-danger/40 bg-danger/5 px-4 py-3">
        <p className="flex-1 text-sm">
          <strong>Delete account.</strong> Removes your companies, jobs and profile. Cannot be
          undone.
        </p>
        <button
          type="button"
          onClick={() => setDeleting(true)}
          className="rounded-md border border-danger px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/10"
        >
          Delete
        </button>
      </section>

      <button
        type="button"
        onClick={() => endSession(LOGIN_PATH)}
        className="self-start rounded-md px-4 py-2 text-sm font-semibold hover:bg-surface"
      >
        Log out
      </button>

      {deleting && (
        <DeleteAccountDialog
          email={account.email}
          onDeleted={() => endSession(SIGNUP_PATH)}
          onClose={() => setDeleting(false)}
        />
      )}
    </div>
  );
}
