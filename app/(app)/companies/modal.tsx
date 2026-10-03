"use client";

import { useId, type ReactNode } from "react";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** Centered dialog over a dimmed page. Escape and the ✕ button close it. */
export function Modal({ title, onClose, children }: Props) {
  const titleId = useId();
  return (
    <div
      className="fixed inset-0 z-10 flex items-start justify-center overflow-auto bg-foreground/40 px-4 py-12"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-xl rounded-lg border border-divider bg-background shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-divider px-6 py-4">
          <h2 id={titleId} className="font-heading text-xl">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
