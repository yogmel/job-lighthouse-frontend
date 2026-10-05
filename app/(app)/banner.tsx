"use client";

import { useEffect } from "react";

export const BANNER_DISMISS_MS = 8_000;

type Props = {
  children: React.ReactNode;
  onDismiss: () => void;
  /** Clears itself after this long. Omit to stay until closed. */
  autoDismissMs?: number;
};

/** Status banner with a close button. Pass `autoDismissMs` for messages that go stale. */
export function Banner({ children, onDismiss, autoDismissMs }: Props) {
  useEffect(() => {
    if (autoDismissMs === undefined) return;
    const id = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(id);
  }, [children, autoDismissMs, onDismiss]);

  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 rounded-md border border-accent/40 bg-surface px-4 py-3 text-sm font-semibold"
    >
      <p>{children}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-my-1 rounded-full px-2 py-1 text-muted transition-colors hover:text-foreground"
      >
        ×
      </button>
    </div>
  );
}
