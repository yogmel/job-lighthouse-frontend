/** Saves `data` as a pretty-printed JSON file through a temporary link. */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoke after the click has been handled, or some browsers cancel it.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
