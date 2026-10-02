"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getConfig, toConfigInput, updateConfig, type Config } from "@/lib/api/config";
import { isValidCron, nextCronRun } from "@/lib/cron";
import { toFormErrors } from "@/lib/api/errors";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; config: Config };

type Mode = "daily" | "weekdays" | "weekly" | "custom";

type Draft = { mode: Mode; time: string; day: string; raw: string };

const FIELDS = ["cron"] as const;

const MODES: { id: Mode; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekdays", label: "Weekdays" },
  { id: "weekly", label: "Weekly" },
  { id: "custom", label: "Custom cron" },
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Picks the preset that produces `cron`, or falls back to raw cron. */
function toDraft(cron: string): Draft {
  const base = { time: "07:00", day: "1", raw: cron };
  const m = /^(\d{1,2}) (\d{1,2}) \* \* (\*|1-5|[0-6])$/.exec(cron.trim());
  if (m && isValidCron(cron)) {
    return {
      ...base,
      mode: m[3] === "*" ? "daily" : m[3] === "1-5" ? "weekdays" : "weekly",
      time: `${pad(Number(m[2]))}:${pad(Number(m[1]))}`,
      day: m[3] === "*" || m[3] === "1-5" ? base.day : m[3],
    };
  }
  return { ...base, mode: "custom" };
}

function toCron({ mode, time, day, raw }: Draft): string {
  if (mode === "custom") return raw.trim();
  const [h, m] = time.split(":").map(Number);
  const dow = mode === "weekdays" ? "1-5" : mode === "weekly" ? day : "*";
  return `${m} ${h} * * ${dow}`;
}

/** "about 4h 12m", "about 25m" */
function untilLabel(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 48) return `about ${Math.round(h / 24)} days`;
  return `about ${h > 0 ? `${h}h ` : ""}${m}m`.replace(" 0m", "");
}

// The cron runs in UTC, so show the estimate in UTC too.
const nextRunFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

function errorMessage(err: unknown): string {
  return toFormErrors(err, []).formError ?? "Something went wrong. Please try again.";
}

export function ScheduleTab() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [draft, setDraft] = useState<Draft>(() => toDraft(""));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  // Captured once so the estimate doesn't change between renders.
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    getConfig().then(
      (config) => {
        if (cancelled) return;
        setState({ status: "ready", config });
        setDraft(toDraft(config.cron));
      },
      (err: unknown) => !cancelled && setState({ status: "error", message: errorMessage(err) }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") return <p className="text-sm text-muted">Loading schedule…</p>;
  if (state.status === "error") {
    return (
      <p role="alert" className="text-sm text-danger">
        {state.message}
      </p>
    );
  }

  const { config } = state;
  const cron = toCron(draft);
  const valid = isValidCron(cron);
  const dirty = cron !== config.cron.trim();
  const next = valid ? nextCronRun(cron, now) : null;

  function edit(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
  }

  function chooseMode(mode: Mode) {
    // Carry the current schedule into the raw editor so it can be tweaked.
    edit({ mode, ...(mode === "custom" ? { raw: cron } : {}) });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    setSaved(false);
    setFieldError(undefined);
    setFormError(undefined);
    try {
      const updated = await updateConfig({ ...toConfigInput(config), cron });
      setState({ status: "ready", config: updated });
      setDraft(toDraft(updated.cron));
      setSaved(true);
    } catch (err) {
      const errors = toFormErrors(err, FIELDS);
      setFieldError(errors.fieldErrors.cron);
      setFormError(errors.formError);
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "rounded-md border border-divider bg-field px-4 py-2 text-sm outline-none focus:border-accent aria-invalid:border-danger";
  const cronError = !valid ? "Enter 5 fields: minute hour day-of-month month day-of-week." : fieldError;

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <h2 className="font-heading text-xl">Schedule</h2>
      <p className="text-sm text-muted">When the runner checks every watched company.</p>

      {saved && (
        <p
          role="status"
          className="rounded-md border border-accent/40 bg-surface px-4 py-3 text-sm font-semibold"
        >
          Schedule saved. The next run follows the new schedule.
        </p>
      )}

      {formError && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Frequency</legend>
        <div className="flex gap-1 rounded-full border border-divider p-1">
          {MODES.map(({ id, label }) => (
            <label
              key={id}
              className={`flex-1 cursor-pointer rounded-full px-3 py-1.5 text-center text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                draft.mode === id
                  ? "bg-surface font-semibold text-accent-strong"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <input
                type="radio"
                name="frequency"
                value={id}
                checked={draft.mode === id}
                onChange={() => chooseMode(id)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {draft.mode !== "custom" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="schedule-time" className="text-sm font-medium">
              Time (UTC)
            </label>
            <input
              id="schedule-time"
              type="time"
              required
              value={draft.time}
              onChange={(e) => edit({ time: e.target.value })}
              className={inputClass}
            />
          </div>
          {draft.mode === "weekly" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="schedule-day" className="text-sm font-medium">
                Day
              </label>
              <select
                id="schedule-day"
                value={draft.day}
                onChange={(e) => edit({ day: e.target.value })}
                className={inputClass}
              >
                {DAYS.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="schedule-cron" className="text-sm font-medium">
          Cron expression
        </label>
        <input
          id="schedule-cron"
          value={draft.mode === "custom" ? draft.raw : cron}
          onChange={(e) => edit({ mode: "custom", raw: e.target.value })}
          placeholder="0 7 * * *"
          spellCheck={false}
          aria-invalid={cronError ? true : undefined}
          aria-describedby={cronError ? "schedule-error" : undefined}
          className={`${inputClass} font-mono`}
        />
        {cronError && (
          <p id="schedule-error" className="text-sm text-danger">
            {cronError}
          </p>
        )}
      </div>

      <p className="rounded-md border border-accent/40 bg-surface px-4 py-3 text-sm">
        Next run{" "}
        <strong>{next ? `${nextRunFormat.format(next)} UTC` : "—"}</strong>
        {next && ` — ${untilLabel(next.getTime() - now.getTime())} from now.`}
      </p>

      <div className="flex items-center justify-end gap-3 rounded-md border border-divider px-4 py-3">
        <button
          type="submit"
          disabled={!dirty || !valid || saving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
