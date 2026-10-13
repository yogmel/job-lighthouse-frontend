import type { ReactNode } from "react";

export type RowAction = {
  /** Accessible name, e.g. "Edit Halden". */
  label: string;
  /** Tooltip text; says why when the action is disabled. */
  tooltip: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** Destructive actions get the danger color. */
  danger?: boolean;
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const icons = {
  edit: (
    <Icon>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Icon>
  ),
  run: (
    <Icon>
      <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />
    </Icon>
  ),
  pause: (
    <Icon>
      <path d="M8 5v14M16 5v14" />
    </Icon>
  ),
  resume: (
    <Icon>
      <path d="m7 4 13 8-13 8Z" />
    </Icon>
  ),
  remove: (
    <Icon>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
    </Icon>
  ),
};

/** Icon buttons for one table row, each with a tooltip and an accessible name. */
export function RowActions({ actions }: { actions: RowAction[] }) {
  return (
    <div className="flex items-center justify-end gap-1">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          aria-label={action.label}
          title={action.tooltip}
          disabled={action.disabled}
          onClick={action.onClick}
          className={`rounded-sm p-1.5 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${
            action.danger ? "text-danger" : "text-muted hover:text-foreground"
          }`}
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
}
