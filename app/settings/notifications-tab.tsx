"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getAccount } from "@/lib/api/account";
import {
  getConfig,
  NOTIFICATION_DEFAULTS,
  toConfigInput,
  updateConfig,
  type Config,
} from "@/lib/api/config";
import { toFormErrors } from "@/lib/api/errors";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; config: Config; email: string };

type Draft = { email: boolean; emptyCompany: boolean; minScore: string };

const FIELDS = ["notify_min_score"] as const;

function toDraft(config: Config): Draft {
  return {
    email: config.notify_email ?? NOTIFICATION_DEFAULTS.notify_email,
    emptyCompany: config.notify_empty_company ?? NOTIFICATION_DEFAULTS.notify_empty_company,
    minScore: String(config.notify_min_score ?? NOTIFICATION_DEFAULTS.notify_min_score),
  };
}

/** Whole number 0–100, or null. */
function parseScore(value: string): number | null {
  if (!/^\d{1,3}$/.test(value.trim())) return null;
  const n = Number(value);
  return n <= 100 ? n : null;
}

function errorMessage(err: unknown): string {
  return toFormErrors(err, []).formError ?? "Something went wrong. Please try again.";
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-divider px-4 py-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-[22px] w-[38px] flex-none rounded-full transition-colors ${
          checked ? "bg-accent" : "bg-divider"
        }`}
      >
        <span
          className={`absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all ${
            checked ? "right-[3px]" : "left-[3px]"
          }`}
        />
      </button>
      <div className="flex flex-1 flex-col">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted">{description}</span>
      </div>
      <span className="text-xs font-semibold text-muted">{checked ? "On" : "Off"}</span>
    </div>
  );
}

export function NotificationsTab() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [draft, setDraft] = useState<Draft>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    Promise.all([getConfig(), getAccount()]).then(
      ([config, account]) => {
        if (cancelled) return;
        setState({ status: "ready", config, email: account.email });
        setDraft(toDraft(config));
      },
      (err: unknown) => !cancelled && setState({ status: "error", message: errorMessage(err) }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "error") {
    return (
      <p role="alert" className="text-sm text-danger">
        {state.message}
      </p>
    );
  }
  if (state.status === "loading" || !draft) {
    return <p className="text-sm text-muted">Loading notifications…</p>;
  }

  const { config, email } = state;
  const saveable = toDraft(config);
  const dirty =
    draft.email !== saveable.email ||
    draft.emptyCompany !== saveable.emptyCompany ||
    draft.minScore !== saveable.minScore;

  function update(patch: Partial<Draft>) {
    setDraft((d) => d && { ...d, ...patch });
    setSaved(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const minScore = parseScore(draft.minScore);
    if (minScore === null) {
      setFieldError("Enter a whole number from 0 to 100.");
      return;
    }
    setSaving(true);
    setSaved(false);
    setFieldError(undefined);
    setFormError(undefined);
    try {
      const next = await updateConfig({
        ...toConfigInput(config),
        notify_email: draft.email,
        notify_empty_company: draft.emptyCompany,
        notify_min_score: minScore,
      });
      setState({ status: "ready", config: next, email });
      setDraft(toDraft(next));
      setSaved(true);
    } catch (err) {
      const errors = toFormErrors(err, FIELDS);
      setFieldError(errors.fieldErrors.notify_min_score);
      setFormError(errors.formError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <h2 className="font-heading text-xl">Notifications</h2>
      <p className="text-sm text-muted">
        One digest per run. Nothing is sent when a run finds nothing new.
      </p>

      {saved && (
        <p
          role="status"
          className="rounded-md border border-accent/40 bg-surface px-4 py-3 text-sm font-semibold"
        >
          Notification settings saved.
        </p>
      )}

      {formError && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Toggle
          label="Email digest"
          description={email}
          checked={draft.email}
          onChange={(email) => update({ email })}
        />
        <Toggle
          label="Warn me when a company returns nothing"
          description="Usually a stale scraper selector"
          checked={draft.emptyCompany}
          onChange={(emptyCompany) => update({ emptyCompany })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notify-min-score" className="text-sm font-medium">
          Only include jobs scoring above
        </label>
        <div className="flex items-center gap-3">
          <input
            id="notify-min-score"
            name="notify_min_score"
            inputMode="numeric"
            value={draft.minScore}
            onChange={(e) => update({ minScore: e.target.value })}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? "notify-min-score-error" : undefined}
            className="w-[90px] rounded-md border border-divider bg-field px-4 py-2 text-sm outline-none focus:border-accent aria-invalid:border-danger"
          />
          <span className="text-sm text-muted">
            Lower-scoring jobs still appear on the board, just not in the email.
          </span>
        </div>
        {fieldError && (
          <p id="notify-min-score-error" className="text-sm text-danger">
            {fieldError}
          </p>
        )}
      </div>

      <div className="flex justify-end border-t border-divider pt-4">
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
