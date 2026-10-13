/**
 * Minimal 5-field cron support for the Settings → Schedule tab: validate an
 * expression and estimate its next run. The backend tick loop owns the real
 * schedule; this is only a preview. Expressions are evaluated in the IANA time
 * zone from `Config.timezone` (UTC by default), so "9am" follows DST.
 */

type Field = { values: Set<number>; any: boolean };

type Parsed = {
  minute: Field;
  hour: Field;
  dom: Field;
  month: Field;
  dow: Field;
};

const RANGES = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
] as const;

function parseField(source: string, [min, max]: readonly [number, number]): Field | null {
  const values = new Set<number>();
  for (const part of source.split(",")) {
    const [range, step, extra] = part.split("/");
    if (extra !== undefined || range === "") return null;
    const size = step === undefined ? 1 : Number(step);
    if (!Number.isInteger(size) || size < 1 || (step !== undefined && !/^\d+$/.test(step))) {
      return null;
    }

    let from: number;
    let to: number;
    if (range === "*") {
      [from, to] = [min, max];
    } else {
      const m = /^(\d+)(?:-(\d+))?$/.exec(range);
      if (!m) return null;
      from = Number(m[1]);
      to = m[2] === undefined ? (step === undefined ? from : max) : Number(m[2]);
    }
    if (from < min || to > max || from > to) return null;
    for (let v = from; v <= to; v += size) values.add(v);
  }
  return { values, any: source === "*" };
}

function parse(expression: string): Parsed | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const fields = parts.map((p, i) => parseField(p, RANGES[i]));
  if (fields.some((f) => f === null)) return null;
  const [minute, hour, dom, month, dow] = fields as Field[];
  if (dow.values.has(7)) dow.values.add(0);
  return { minute, hour, dom, month, dow };
}

export function isValidCron(expression: string): boolean {
  return parse(expression) !== null;
}

export const DEFAULT_TIME_ZONE = "UTC";

/** True for any zone name the runtime's Intl knows (IANA names and aliases like "UTC"). */
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** IANA zone names for a picker; always includes UTC, which some runtimes leave out. */
export function listTimeZones(): string[] {
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return zones.includes(DEFAULT_TIME_ZONE) ? zones : [DEFAULT_TIME_ZONE, ...zones];
}

/** The zone the browser runs in, e.g. "Europe/Berlin". */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
}

type Wall = { month: number; day: number; dow: number; hour: number; minute: number };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const wallFormats = new Map<string, Intl.DateTimeFormat>();

/** The clock and calendar on the wall in `timeZone` at this instant. */
function wallTime(date: Date, timeZone: string): Wall {
  let format = wallFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      weekday: "short",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
    wallFormats.set(timeZone, format);
  }
  const parts = format.formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    month: Number(part("month")),
    day: Number(part("day")),
    dow: WEEKDAYS.indexOf(part("weekday")),
    hour: Number(part("hour")),
    minute: Number(part("minute")),
  };
}

function dayMatches(c: Parsed, wall: Wall): boolean {
  if (!c.month.values.has(wall.month)) return false;
  const domOk = c.dom.values.has(wall.day);
  const dowOk = c.dow.values.has(wall.dow);
  // Standard cron: when both day fields are restricted, either may match.
  if (!c.dom.any && !c.dow.any) return domOk || dowOk;
  return domOk && dowOk;
}

const MINUTE = 60_000;

/**
 * The first run strictly after `from`, evaluating the expression on the wall
 * clock of `timeZone`; null if invalid or none within 5 years. A wall time that
 * does not exist (spring-forward gap) is skipped; one that happens twice
 * (fall-back) runs at its first occurrence.
 */
export function nextCronRun(expression: string, from: Date, timeZone = DEFAULT_TIME_ZONE): Date | null {
  const c = parse(expression);
  if (!c || !isValidTimeZone(timeZone)) return null;

  let t = Math.floor(from.getTime() / MINUTE) * MINUTE + MINUTE;
  const limit = from.getTime() + 5 * 366 * 24 * 60 * MINUTE;
  while (t <= limit) {
    const wall = wallTime(new Date(t), timeZone);
    if (!dayMatches(c, wall)) {
      // Toward the next local midnight, an hour short so a DST jump cannot skip it.
      t += Math.max(60, (24 - wall.hour) * 60 - wall.minute - 60) * MINUTE;
    } else if (!c.hour.values.has(wall.hour)) {
      t += (60 - wall.minute) * MINUTE;
    } else if (!c.minute.values.has(wall.minute)) {
      t += MINUTE;
    } else {
      return new Date(t);
    }
  }
  return null;
}

/** "about 4h 12m", "about 25m" */
export function untilLabel(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 48) return `about ${Math.round(h / 24)} days`;
  return `about ${h > 0 ? `${h}h ` : ""}${m}m`.replace(" 0m", "");
}

const zoneFormats = new Map<string, Intl.DateTimeFormat>();

/** "Fri 2 Oct, 07:00 UTC", "Fri 2 Oct, 09:00 GMT+2" — the zone abbreviation is the runtime's. */
export function formatInZone(date: Date, timeZone = DEFAULT_TIME_ZONE): string {
  let format = zoneFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
      timeZoneName: "short",
    });
    zoneFormats.set(timeZone, format);
  }
  const parts = format.formatToParts(date);
  const zone = parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
  const rest = parts
    .filter((p) => p.type !== "timeZoneName")
    .map((p) => p.value)
    .join("")
    .trim();
  return `${rest} ${zone}`;
}
