"use client";

import { useEffect, useRef, useState } from "react";

export type RowMenuItem = {
  label: string;
  onSelect: () => void;
  /** Destructive actions get the danger color and sit after a divider. */
  danger?: boolean;
};

/** Rough menu height in px, used to decide whether it fits below the trigger. */
const MENU_ROOM = 260;

type Props = {
  /** Row name, for the trigger's accessible label and the menu heading. */
  name: string;
  items: RowMenuItem[];
};

/** "⋯" button that opens a small action menu for one table row. */
export function RowMenu({ name, items }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number }>();
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    // The menu is fixed to the viewport, so it would drift away from its row on scroll or resize.
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
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
        ref={triggerRef}
        onClick={() => {
          const rect = triggerRef.current?.getBoundingClientRect();
          if (rect) {
            const right = window.innerWidth - rect.right;
            // Opens upward when there is no room below, e.g. the last rows.
            setPos(
              window.innerHeight - rect.bottom < MENU_ROOM
                ? { bottom: window.innerHeight - rect.top + 4, right }
                : { top: rect.bottom + 4, right },
            );
          }
          setOpen((o) => !o);
        }}
        className="rounded-sm px-2 py-1 text-muted hover:bg-surface"
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          aria-label={name}
          style={pos}
          className="fixed z-20 flex w-56 flex-col gap-0.5 rounded-md border border-divider bg-background p-2 shadow-lg"
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
