import type { Company } from "@/lib/api/companies";
import {
  SOURCE_LABELS,
  SOURCES,
  type CompanyFilters,
  type LastRunOutcome,
  type SourceFilter,
} from "./company-filters";

type Props = {
  filters: CompanyFilters;
  companies: Company[];
  onChange: (filters: CompanyFilters) => void;
};

const selectClass =
  "rounded-md border border-divider bg-field px-3 py-2 text-sm outline-none focus:border-accent";

export function CompanyFilterBar({ filters, companies, onChange }: Props) {
  // A tier from the URL stays selectable even when no company has it any more.
  const present = companies.map((c) => c.tier);
  if (filters.tier) present.push(Number(filters.tier));
  const tiers = [...new Set(present)].sort((a, b) => a - b);

  return (
    <div className="flex flex-wrap items-end gap-3">
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
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Source
        <select
          value={filters.source}
          onChange={(e) => onChange({ ...filters, source: e.target.value as SourceFilter | "" })}
          className={selectClass}
        >
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Status
        <select
          value={filters.status}
          onChange={(e) =>
            onChange({ ...filters, status: e.target.value as CompanyFilters["status"] })
          }
          className={selectClass}
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Last run
        <select
          value={filters.lastRun}
          onChange={(e) => onChange({ ...filters, lastRun: e.target.value as LastRunOutcome | "" })}
          className={selectClass}
        >
          <option value="">Any</option>
          <option value="ok">OK</option>
          <option value="zero">0 jobs</option>
          <option value="failed">Failed</option>
        </select>
      </label>
    </div>
  );
}
