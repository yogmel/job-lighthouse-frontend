/** Full-page navigation. Its own module so tests can mock it (jsdom can't). */
export function hardRedirect(url: string): void {
  window.location.replace(url);
}
