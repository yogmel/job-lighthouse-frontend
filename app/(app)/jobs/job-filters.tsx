import type { Company } from "@/lib/api/companies";

export type ActiveFilter = "active" | "closed" | "all";

export type Filters = {
  active: ActiveFilter;
  /** "" = any company. */
  companyId: string;
  /** "" = any tier; otherwise the tier number as a string. */
  tier: string;
};

/** Inactive jobs are history, hidden from the default view. */
export const DEFAULT_FILTERS: Filters = { active: "active", companyId: "", tier: "" };

type Props = {
  filters: Filters;
  companies: Company[];
  onChange: (filters: Filters) => void;
};

const selectClass =
  "rounded-md border border-divider bg-field px-3 py-2 text-sm outline-none focus:border-accent";

export function JobFilters({ filters, companies, onChange }: Props) {
  const byName = [...companies].sort((a, b) => a.name.localeCompare(b.name));
  const tiers = [...new Set(companies.map((c) => c.tier))].sort((a, b) => a - b);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Status
        <select
          value={filters.active}
          onChange={(e) => onChange({ ...filters, active: e.target.value as ActiveFilter })}
          className={selectClass}
        >
          <option value="active">Open</option>
          <option value="closed">Closed</option>
          <option value="all">All</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Company
        <select
          value={filters.companyId}
          onChange={(e) => onChange({ ...filters, companyId: e.target.value })}
          className={selectClass}
        >
          <option value="">All companies</option>
          {byName.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Tier
        <select
          value={filters.tier}
          onChange={(e) => onChange({ ...filters, tier: e.target.value })}
          className={selectClass}
        >
          <option value="">All tiers</option>
          {tiers.map((t) => (
            <option key={t} value={String(t)}>
              Tier {t}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
