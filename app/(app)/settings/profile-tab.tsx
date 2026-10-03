"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getConfig, toConfigInput, updateConfig, type Config } from "@/lib/api/config";
import { toFormErrors } from "@/lib/api/errors";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; config: Config };

const FIELDS = ["profile"] as const;

function errorMessage(err: unknown): string {
  return toFormErrors(err, []).formError ?? "Something went wrong. Please try again.";
}

export function ProfileTab() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    getConfig().then(
      (config) => {
        if (cancelled) return;
        setState({ status: "ready", config });
        setDraft(config.profile);
      },
      (err: unknown) => !cancelled && setState({ status: "error", message: errorMessage(err) }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") return <p className="text-sm text-muted">Loading profile…</p>;
  if (state.status === "error") {
    return (
      <p role="alert" className="text-sm text-danger">
        {state.message}
      </p>
    );
  }

  const { config } = state;
  const dirty = draft !== config.profile;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setFieldError(undefined);
    setFormError(undefined);
    try {
      const next = await updateConfig({ ...toConfigInput(config), profile: draft });
      setState({ status: "ready", config: next });
      setDraft(next.profile);
      setSaved(true);
    } catch (err) {
      const errors = toFormErrors(err, FIELDS);
      setFieldError(errors.fieldErrors.profile);
      setFormError(errors.formError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-heading text-xl">Profile</h2>
        <span className="text-xs text-muted">Version {config.profile_version}</span>
      </div>
      <p className="text-sm text-muted">This markdown is what the scorer reads to rate each posting.</p>

      {saved && (
        <p
          role="status"
          className="rounded-md border border-accent/40 bg-surface px-4 py-3 text-sm font-semibold"
        >
          Profile saved. It applies to the next run; already-scored jobs keep their score.
        </p>
      )}

      {formError && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile" className="text-sm font-medium">
          Profile markdown
        </label>
        <textarea
          id="profile"
          name="profile"
          rows={16}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setSaved(false);
          }}
          placeholder={"# Profile\nWhat you do, where you want to work, what you're looking for."}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "profile-error" : undefined}
          className="rounded-md border border-divider bg-field px-4 py-3 font-mono text-sm leading-relaxed outline-none focus:border-accent aria-invalid:border-danger"
        />
        {fieldError && (
          <p id="profile-error" className="text-sm text-danger">
            {fieldError}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 rounded-md border border-divider px-4 py-3">
        <span className="flex-1 text-sm text-muted">
          Saved changes apply to the <strong className="text-foreground">next run</strong>. Jobs
          already scored keep their score.
        </span>
        <button
          type="submit"
          disabled={!dirty || saving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
