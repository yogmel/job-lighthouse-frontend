"use client";

import { useId, useState } from "react";
import type { Company } from "@/lib/api/companies";

type Props = {
  label: string;
  /** "" = any company. */
  value: string;
  companies: Company[];
  onChange: (companyId: string) => void;
  className?: string;
};

const ALL_LABEL = "All companies";

/** Typeable company picker. Matching runs in the browser over the given list. */
export function CompanyCombobox({ label, value, companies, onChange, className }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-opt-${i}`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selectedName = companies.find((c) => c.id === value)?.name ?? ALL_LABEL;
  const needle = query.trim().toLowerCase();
  const matches = companies
    .filter((c) => c.name.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name));
  // "All companies" always leads the list.
  const options = [{ id: "", name: ALL_LABEL }, ...matches];

  function close() {
    setOpen(false);
    setQuery("");
  }

  function choose(companyId: string) {
    onChange(companyId);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) setOpen(true);
        else setActive((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) setOpen(true);
        else setActive((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        if (open) {
          e.preventDefault();
          choose(options[active]?.id ?? "");
        }
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          close();
        }
        break;
    }
  }

  return (
    <div className="relative flex flex-col gap-1.5 text-sm font-medium">
      <label htmlFor={`${id}-input`}>{label}</label>
      <input
        id={`${id}-input`}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? optionId(active) : undefined}
        autoComplete="off"
        value={open ? query : selectedName}
        placeholder={open ? selectedName : undefined}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={onKeyDown}
        className={className}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute top-full z-10 mt-1 max-h-60 w-full min-w-48 overflow-y-auto rounded-md border border-divider bg-field py-1 text-sm font-normal shadow-md"
        >
          {options.map((o, i) => (
            <li
              key={o.id || "all"}
              id={optionId(i)}
              role="option"
              aria-selected={o.id === value}
              // Keep focus in the input so blur doesn't close the list before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o.id)}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-1.5 ${i === active ? "bg-divider" : ""} ${
                o.id === value ? "font-medium" : ""
              }`}
            >
              {o.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
