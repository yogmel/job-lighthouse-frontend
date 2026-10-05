"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Centered dialog over a dimmed page, built on a native modal `<dialog>`: the
 * browser moves focus in, keeps Tab inside and closes on Escape. The ✕ button
 * and Escape call `onClose`; a click on the backdrop does nothing.
 */
export function Modal({ title, onClose, children }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement;
    const handleClose = () => onCloseRef.current();
    dialog.addEventListener("close", handleClose);
    dialog.showModal();
    return () => {
      dialog.removeEventListener("close", handleClose);
      if (dialog.open) dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="mx-auto mt-12 max-h-[calc(100dvh-6rem)] w-[calc(100%-2rem)] max-w-xl overflow-auto rounded-lg border border-divider bg-background p-0 text-foreground shadow-lg backdrop:bg-foreground/40"
    >
      <div className="flex items-center justify-between border-b border-divider px-6 py-4">
        <h2 id={titleId} className="font-heading text-xl">
          {title}
        </h2>
        <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close" className="text-muted">
          ✕
        </button>
      </div>
      {children}
    </dialog>
  );
}
