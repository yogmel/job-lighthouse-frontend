import { DEFAULT_TIME_ZONE, isValidTimeZone } from "./cron";

/**
 * Every date the app shows goes through here, in the zone from
 * `Config.timezone`. An unknown or empty zone falls back to UTC.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function zoneOrDefault(timeZone: string | undefined): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
}

const formats = new Map<string, Intl.DateTimeFormat>();

function format(kind: string, timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${kind}|${timeZone}`;
  let f = formats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { ...options, timeZone });
    formats.set(key, f);
  }
  return f;
}

/** "07:04". */
export function formatTime(date: Date, timeZone?: string): string {
  const zone = zoneOrDefault(timeZone);
  return format("time", zone, { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

/** "28 Sep". */
export function formatDate(date: Date | string, timeZone?: string): string {
  const zone = zoneOrDefault(timeZone);
  return format("date", zone, { day: "numeric", month: "short" }).format(new Date(date));
}

/** Whole days since the epoch on the calendar of `timeZone`. */
function dayNumber(date: Date, timeZone: string): number {
  const parts = format("day", timeZone, { year: "numeric", month: "numeric", day: "numeric" }).formatToParts(date);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day")) / DAY_MS;
}

/** True when both instants fall on the same calendar day in `timeZone`. */
export function isSameDay(a: Date, b: Date, timeZone?: string): boolean {
  const zone = zoneOrDefault(timeZone);
  return dayNumber(a, zone) === dayNumber(b, zone);
}

/** "Today 07:04", "Yesterday 07:03", "Sun 07:04" (this week), "28 Sep 07:04". */
export function startedLabel(iso: string, now: Date, timeZone?: string): string {
  const zone = zoneOrDefault(timeZone);
  const date = new Date(iso);
  const daysAgo = dayNumber(now, zone) - dayNumber(date, zone);
  const time = formatTime(date, zone);
  if (daysAgo === 0) return `Today ${time}`;
  if (daysAgo === 1) return `Yesterday ${time}`;
  if (daysAgo > 1 && daysAgo < 7) {
    return `${format("weekday", zone, { weekday: "short" }).format(date)} ${time}`;
  }
  return `${formatDate(date, zone)} ${time}`;
}
