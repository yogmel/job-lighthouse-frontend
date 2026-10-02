"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getConfig, toConfigInput, updateConfig, type Config } from "@/lib/api/config";
import { isValidCron, nextCronRun } from "@/lib/cron";
import { toFormErrors } from "@/lib/api/errors";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; config: Config };

type Mode = "daily" | "weekdays" | "hours" | "custom";

type Draft = { mode: Mode; time: string; hours: string; raw: string };

const FIELDS = ["cron"] as const;

const MODES: { id: Mode; label: string }[] = [
  { id: "daily", label: "Every day" },
  { id: "weekdays", label: "Weekdays" },
  { id: "hours", label: "Every N hours" },
  { id: "custom", label: "Custom cron" },
];

const pad = (n: number) => String(n).padStart(2, "0");

/** Picks the preset that produces `cron`, or falls back to raw cron. */
function toDraft(cron: string): Draft {
  const base = { time: "07:00", hours: "6", raw: cron };
  const daily = /^(\d{1,2}) (\d{1,2}) \* \* (\*|1-5)$/.exec(cron.trim());
  if (daily && isValidCron(cron)) {
    return {
      ...base,
      mode: daily[3] === "*" ? "daily" : "weekdays",
      time: `${pad(Number(daily[2]))}:${pad(Number(daily[1]))}`,
    };
  }
  const hourly = /^0 \*\/(\d{1,2}) \* \* \*$/.exec(cron.trim());
  if (hourly && isValidCron(cron)) return { ...base, mode: "hours", hours: hourly[1] };
  return { ...base, mode: "custom" };
}

function toCron({ mode, time, hours, raw }: Draft): string {
  if (mode === "custom") return raw.trim();
  if (mode === "hours") return `0 */${hours} * * *`;
  const [h, m] = time.split(":").map(Number);
  return `${m} ${h} * * ${mode === "weekdays" ? "1-5" : "*"}`;
}

const nextRunFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "full",
  timeStyle: "short",
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
  const customError =
    draft.mode === "custom" && !valid
      ? "Enter 5 fields: minute hour day-of-month month day-of-week."
      : fieldError;

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <h2 className="font-heading text-xl">Schedule</h2>
      <p className="text-sm text-muted">
        When the runner looks for new openings. Times are in UTC.
      </p>

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

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="schedule-mode" className="text-sm font-medium">
            Frequency
          </label>
          <select
            id="schedule-mode"
            value={draft.mode}
            onChange={(e) => chooseMode(e.target.value as Mode)}
            className={inputClass}
          >
            {MODES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {(draft.mode === "daily" || draft.mode === "weekdays") && (
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
        )}

        {draft.mode === "hours" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="schedule-hours" className="text-sm font-medium">
              Hours between runs
            </label>
            <select
              id="schedule-hours"
              value={draft.hours}
              onChange={(e) => edit({ hours: e.target.value })}
              className={inputClass}
            >
              {[1, 2, 3, 4, 6, 8, 12].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {draft.mode === "custom" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="schedule-raw" className="text-sm font-medium">
            Cron expression
          </label>
          <input
            id="schedule-raw"
            value={draft.raw}
            onChange={(e) => edit({ raw: e.target.value })}
            placeholder="0 7 * * *"
            spellCheck={false}
            aria-invalid={customError ? true : undefined}
            aria-describedby={customError ? "schedule-error" : undefined}
            className={`${inputClass} font-mono`}
          />
        </div>
      )}
      {customError && (
        <p id="schedule-error" className="text-sm text-danger">
          {customError}
        </p>
      )}

      <p className="text-sm text-muted">
        Cron: <code className="font-mono text-foreground">{valid ? cron : "—"}</code>
        {" · "}
        Next run:{" "}
        <strong className="text-foreground">{next ? nextRunFormat.format(next) : "—"}</strong>
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
