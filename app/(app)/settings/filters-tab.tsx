"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getConfig, toConfigInput, updateConfig, type Config } from "@/lib/api/config";
import { toFormErrors } from "@/lib/api/errors";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; config: Config };

const FIELDS = ["keywords_include", "keywords_exclude", "location"] as const;

type Draft = { include: string; exclude: string; location: string };

function errorMessage(err: unknown): string {
  return toFormErrors(err, []).formError ?? "Something went wrong. Please try again.";
}

/** Keywords are edited as one comma-separated line. */
export function parseKeywords(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(",")) {
    const word = part.trim();
    if (word) seen.add(word);
  }
  return [...seen];
}

function toDraft(config: Config): Draft {
  return {
    include: config.keywords_include.join(", "),
    exclude: config.keywords_exclude.join(", "),
    location: config.location,
  };
}

const INPUT =
  "rounded-md border border-divider bg-field px-4 py-2.5 text-sm outline-none focus:border-accent aria-invalid:border-danger";

export function FiltersTab() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [draft, setDraft] = useState<Draft>({ include: "", exclude: "", location: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<(typeof FIELDS)[number], string>>>({});
  const [formError, setFormError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    getConfig().then(
      (config) => {
        if (cancelled) return;
        setState({ status: "ready", config });
        setDraft(toDraft(config));
      },
      (err: unknown) => !cancelled && setState({ status: "error", message: errorMessage(err) }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") return <p className="text-sm text-muted">Loading filters…</p>;
  if (state.status === "error") {
    return (
      <p role="alert" className="text-sm text-danger">
        {state.message}
      </p>
    );
  }

  const { config } = state;
  const next = {
    keywords_include: parseKeywords(draft.include),
    keywords_exclude: parseKeywords(draft.exclude),
    location: draft.location.trim(),
  };
  const dirty =
    next.keywords_include.join("\n") !== config.keywords_include.join("\n") ||
    next.keywords_exclude.join("\n") !== config.keywords_exclude.join("\n") ||
    next.location !== config.location;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setFieldErrors({});
    setFormError(undefined);
    try {
      const updated = await updateConfig({ ...toConfigInput(config), ...next });
      setState({ status: "ready", config: updated });
      setDraft(toDraft(updated));
      setSaved(true);
    } catch (err) {
      const errors = toFormErrors(err, FIELDS);
      setFieldErrors(errors.fieldErrors);
      setFormError(errors.formError);
    } finally {
      setSaving(false);
    }
  }

  function field(
    id: keyof Draft,
    errorKey: (typeof FIELDS)[number],
    label: string,
    hint: string,
    placeholder: string,
  ) {
    const error = fieldErrors[errorKey];
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <input
          id={id}
          name={id}
          type="text"
          value={draft[id]}
          onChange={(e) => {
            setDraft({ ...draft, [id]: e.target.value });
            setSaved(false);
          }}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
          className={INPUT}
        />
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
        {error && (
          <p id={`${id}-error`} className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <h2 className="font-heading text-xl">Filters</h2>
      <p className="text-sm text-muted">
        Applied at scrape time, so postings that don&apos;t pass are never stored or scored.
      </p>

      {saved && (
        <p
          role="status"
          className="rounded-md border border-accent/40 bg-surface px-4 py-3 text-sm font-semibold"
        >
          Filters saved. They apply to the next run.
        </p>
      )}

      {formError && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}

      {field(
        "include",
        "keywords_include",
        "Keywords to include",
        "Comma-separated. A posting needs at least one. Leave empty to keep everything.",
        "frontend, react, typescript",
      )}
      {field(
        "exclude",
        "keywords_exclude",
        "Keywords to exclude",
        "Comma-separated. Whole words only, so “intern” won’t drop “Internal Tools”.",
        "intern, junior",
      )}
      {field("location", "location", "Location", "Postings in other places are dropped.", "Berlin")}

      <div className="flex items-center gap-3 rounded-md border border-divider px-4 py-3">
        <span className="flex-1 text-sm text-muted">
          Saved changes apply to the <strong className="text-foreground">next run</strong>. Jobs
          already stored stay as they are.
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
