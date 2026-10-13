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
