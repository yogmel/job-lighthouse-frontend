/**
 * Minimal 5-field cron support for the Settings → Schedule tab: validate an
 * expression and estimate its next run. The backend tick loop owns the real
 * schedule; this is only a preview. Expressions are evaluated in UTC, which
 * is what the scheduler is assumed to use (SYSTEM_DESIGN.md doesn't say).
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

function dayMatches(c: Parsed, date: Date): boolean {
  if (!c.month.values.has(date.getUTCMonth() + 1)) return false;
  const domOk = c.dom.values.has(date.getUTCDate());
  const dowOk = c.dow.values.has(date.getUTCDay());
  // Standard cron: when both day fields are restricted, either may match.
  if (!c.dom.any && !c.dow.any) return domOk || dowOk;
  return domOk && dowOk;
}

/** The first run strictly after `from`, or null if invalid or none within 5 years. */
export function nextCronRun(expression: string, from: Date): Date | null {
  const c = parse(expression);
  if (!c) return null;

  const t = new Date(from.getTime());
  t.setUTCSeconds(0, 0);
  t.setUTCMinutes(t.getUTCMinutes() + 1);

  const limit = from.getTime() + 5 * 366 * 24 * 60 * 60 * 1000;
  while (t.getTime() <= limit) {
    if (!dayMatches(c, t)) {
      t.setUTCDate(t.getUTCDate() + 1);
      t.setUTCHours(0, 0, 0, 0);
    } else if (!c.hour.values.has(t.getUTCHours())) {
      t.setUTCHours(t.getUTCHours() + 1, 0, 0, 0);
    } else if (!c.minute.values.has(t.getUTCMinutes())) {
      t.setUTCMinutes(t.getUTCMinutes() + 1);
    } else {
      return t;
    }
  }
  return null;
}
