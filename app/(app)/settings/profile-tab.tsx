"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Markdown from "react-markdown";
import { getConfig, toConfigInput, updateConfig, type Config } from "@/lib/api/config";
import { toFormErrors } from "@/lib/api/errors";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; config: Config };

const FIELDS = ["profile"] as const;

const MODES = [
  { id: "write", label: "Write" },
  { id: "preview", label: "Preview" },
] as const;

type Mode = (typeof MODES)[number]["id"];

// Preflight strips element styles; give the rendered markdown back a readable hierarchy.
const proseClass =
  "min-h-64 rounded-md border border-divider px-4 py-3 text-sm leading-relaxed " +
  "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:font-heading [&_h1]:text-2xl [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:font-heading [&_h2]:text-xl " +
  "[&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 " +
  "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-accent-strong [&_a]:underline " +
  "[&_code]:rounded-sm [&_code]:bg-surface [&_code]:px-1 [&_code]:font-mono [&_blockquote]:border-l-2 " +
  "[&_blockquote]:border-divider [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_hr]:my-4 [&_hr]:border-divider " +
  "[&>:first-child]:mt-0";

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
  const [mode, setMode] = useState<Mode>("write");
  const tabRefs = useRef<Partial<Record<Mode, HTMLButtonElement | null>>>({});

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

  /** Left / Right move between the two tabs (ARIA tabs pattern, automatic activation). */
  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = mode === "write" ? "preview" : "write";
    setMode(next);
    tabRefs.current[next]?.focus();
  }

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
      // The error belongs to the textarea, so bring it back.
      if (errors.fieldErrors.profile) setMode("write");
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
        <div role="tablist" aria-label="Profile editor" className="flex gap-1">
          {MODES.map(({ id, label }) => (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[id] = el;
              }}
              type="button"
              role="tab"
              id={`profile-tab-${id}`}
              aria-selected={mode === id}
              // Only the selected panel is mounted.
              aria-controls={mode === id ? `profile-panel-${id}` : undefined}
              tabIndex={mode === id ? 0 : -1}
              onClick={() => setMode(id)}
              onKeyDown={onTabKeyDown}
              className={`rounded-full px-3 py-1.5 text-sm ${
                mode === id
                  ? "bg-surface font-semibold text-accent-strong"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "write" ? (
          <div
            role="tabpanel"
            id="profile-panel-write"
            aria-labelledby="profile-tab-write"
            className="flex flex-col gap-1.5"
          >
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
          </div>
        ) : (
          <div
            role="tabpanel"
            id="profile-panel-preview"
            aria-labelledby="profile-tab-preview"
            tabIndex={0}
            className={proseClass}
          >
            {/* Raw HTML in the draft is escaped to text, never rendered. */}
            {draft.trim() ? <Markdown>{draft}</Markdown> : <p className="text-muted">Nothing to preview.</p>}
          </div>
        )}
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
