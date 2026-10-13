import type { Company, Source } from "@/lib/api/companies";
import { nextSort, type CompanySort, type SortKey } from "./company-sort";
import { RowActions, type RowAction } from "./row-actions";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/** Board name for board-backed companies, otherwise the source kind. */
export function sourceLabel(source: Source): string {
  return source.kind === "board" ? source.board : source.kind;
}

/**
 * Detection fell through to a `custom` source and no handler has shipped yet.
 * The backend keeps these paused until a developer ships the handler; an
 * active `custom` company means its handler is live.
 */
export function needsCustomHandling(company: Company): boolean {
  return company.source.kind === "custom" && !company.active;
}

/** Paused rows fade their cells, not the row, so the action icons stay fully opaque. */
function dim(company: Company): string {
  return company.active ? "" : "opacity-60";
}

function Status({ company }: { company: Company }) {
  if (needsCustomHandling(company)) {
    return (
      <span
        title="Paused until a developer ships a handler for this company."
        className="rounded-sm border border-dashed border-accent px-2 py-0.5 text-xs font-medium whitespace-nowrap text-accent-strong"
      >
        Needs custom handling
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${company.active ? "bg-accent" : "border border-muted"}`}
      />
      {company.active ? "Active" : "Paused"}
    </span>
  );
}

/** A header that sorts by its column; `aria-sort` sits on the `<th>`, the click on the button inside. */
function SortHeader({
  label,
  column,
  sort,
  onSort,
  className = "",
}: {
  label: string;
  column: SortKey;
  sort: CompanySort;
  onSort: (sort: CompanySort) => void;
  className?: string;
}) {
  const sorted = sort.key === column;
  return (
    <th
      scope="col"
      aria-sort={sorted ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
      className={`px-4 py-2.5 font-medium ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(nextSort(sort, column))}
        className={`inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${sorted ? "text-foreground" : ""}`}
      >
        {label}
        <span aria-hidden="true" className={sorted ? "" : "invisible"}>
          {sort.dir === "asc" || !sorted ? "↑" : "↓"}
        </span>
      </button>
    </th>
  );
}

type Props = {
  companies: Company[];
  sort: CompanySort;
  onSort: (sort: CompanySort) => void;
  /** Row action icons for one company. */
  rowActions: (company: Company) => RowAction[];
};

export function CompaniesTable({ companies, sort, onSort, rowActions }: Props) {
  return (
    // Scrolls inside the box.
    <div
      data-testid="companies-scroll"
      className="max-h-[70dvh] overflow-auto overscroll-contain rounded-md border border-divider"
    >
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-surface text-xs text-muted shadow-[0_1px_0_var(--color-divider)]">
          <tr>
            <SortHeader label="Name" column="name" sort={sort} onSort={onSort} />
            <th scope="col" className="px-4 py-2.5 font-medium">Tier</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Job board</th>
            <SortHeader
              label="Added"
              column="added"
              sort={sort}
              onSort={onSort}
              className="hidden sm:table-cell"
            />
            <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
            <th scope="col" className="w-px px-4 py-2.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr
              key={company.id}
              className="border-t border-divider"
            >
              <td className={`px-4 py-3 font-semibold ${dim(company)}`}>
                <a
                  href={company.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:underline"
                >
                  {company.name}
                </a>
              </td>
              <td className={`px-4 py-3 ${dim(company)}`}>
                <span
                  className={`rounded-sm px-2 py-0.5 text-xs font-medium ${
                    company.tier === 1 ? "bg-accent text-white" : "bg-surface"
                  }`}
                >
                  Tier {company.tier}
                </span>
              </td>
              <td className={`px-4 py-3 text-muted ${dim(company)}`}>{sourceLabel(company.source)}</td>
              <td className={`hidden px-4 py-3 text-muted sm:table-cell ${dim(company)}`}>
                <time dateTime={company.added_at}>{dateFormat.format(new Date(company.added_at))}</time>
              </td>
              <td className={`px-4 py-3 ${dim(company)}`}>
                <Status company={company} />
              </td>
              <td className="px-4 py-3 text-right">
                <RowActions actions={rowActions(company)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
