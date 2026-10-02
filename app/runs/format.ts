/** Times on the Runs screen are UTC, like the schedule they come from. */

const DAY_MS = 24 * 60 * 60 * 1000;

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});
const weekdayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function utcDay(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS);
}

export function isSameUtcDay(a: Date, b: Date): boolean {
  return utcDay(a) === utcDay(b);
}

/** "Today 07:04", "Yesterday 07:03", "Sun 07:04" (this week), "28 Sep 07:04". */
export function startedLabel(iso: string, now: Date): string {
  const date = new Date(iso);
  const daysAgo = utcDay(now) - utcDay(date);
  const time = timeFormat.format(date);
  if (daysAgo === 0) return `Today ${time}`;
  if (daysAgo === 1) return `Yesterday ${time}`;
  if (daysAgo > 1 && daysAgo < 7) return `${weekdayFormat.format(date)} ${time}`;
  return `${dateFormat.format(date)} ${time}`;
}

/** "38s", "2m 5s"; null while the run is still going. */
export function durationLabel(startedAt: string, finishedAt: string | null): string | null {
  if (!finishedAt) return null;
  const seconds = Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
}
