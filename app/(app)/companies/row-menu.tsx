"use client";

import { useEffect, useRef, useState } from "react";

export type RowMenuItem = {
  label: string;
  onSelect: () => void;
  /** Destructive actions get the danger color and sit after a divider. */
  danger?: boolean;
};

type Props = {
  /** Row name, for the trigger's accessible label and the menu heading. */
  name: string;
  items: RowMenuItem[];
};

/** "⋯" button that opens a small action menu for one table row. */
export function RowMenu({ name, items }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const regular = items.filter((item) => !item.danger);
  const danger = items.filter((item) => item.danger);

  function renderItem(item: RowMenuItem) {
    return (
      <button
        key={item.label}
        type="button"
        role="menuitem"
        onClick={() => {
          setOpen(false);
          item.onSelect();
        }}
        className={`rounded-sm px-3 py-2 text-left text-sm hover:bg-surface ${item.danger ? "text-danger" : ""}`}
      >
        {item.label}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button
        type="button"
        aria-label={`Actions for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-sm px-2 py-1 text-muted hover:bg-surface"
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          aria-label={name}
          className="absolute right-0 z-5 mt-1 flex w-56 flex-col gap-0.5 rounded-md border border-divider bg-background p-2 shadow-lg"
        >
          <span className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">
            {name}
          </span>
          {regular.map(renderItem)}
          {danger.length > 0 && regular.length > 0 && (
            <div role="separator" className="mx-2 my-1 h-px bg-divider" />
          )}
          {danger.map(renderItem)}
        </div>
      )}
    </div>
  );
}
