type Props = {
  /** What the user typed in Name; empty until the agent fills it in. */
  name: string;
  host: string;
  onCancel: () => void;
};

const PROGRESS = [
  "Fetching the careers page",
  "Detecting the job board",
  "Reading openings",
  "Scoring matches against your profile",
];

/** Shown while `POST /companies/detect` runs; one request, so no per-step ticks. */
export function ResolvingCard({ name, host, onCancel }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-5 rounded-lg border border-divider p-6"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-md bg-surface font-heading"
        >
          {(name || host).charAt(0).toUpperCase()}
        </span>
        <div className="flex flex-col">
          <span className="font-semibold">{name || host}</span>
          <span className="text-xs text-muted">{host}</span>
        </div>
      </div>

      <ul className="flex flex-col gap-2 text-sm">
        {PROGRESS.map((label) => (
          <li key={label} className="flex items-center gap-2">
            <span aria-hidden className="size-2 animate-pulse rounded-full bg-accent" />
            {label}…
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-4 border-t border-divider pt-4">
        <p className="text-xs text-muted">This can take a few seconds.</p>
        <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm font-semibold">
          Cancel
        </button>
      </div>
    </div>
  );
}
