import type { Company, Source } from "@/lib/api/companies";
import { RowMenu, type RowMenuItem } from "./row-menu";

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

type Props = {
  companies: Company[];
  /** Row menu actions for one company. */
  menuItems: (company: Company) => RowMenuItem[];
};

export function CompaniesTable({ companies, menuItems }: Props) {
  return (
    // No overflow clipping here: it would cut off the row menus.
    <div className="rounded-md border border-divider">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface text-xs text-muted">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Tier</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Job board</th>
            <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">Added</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
            <th scope="col" className="w-12 px-4 py-2.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr
              key={company.id}
              className={`border-t border-divider ${company.active ? "" : "opacity-60"}`}
            >
              <td className="px-4 py-3 font-semibold">{company.name}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-sm px-2 py-0.5 text-xs font-medium ${
                    company.tier === 1 ? "bg-accent text-white" : "bg-surface"
                  }`}
                >
                  Tier {company.tier}
                </span>
              </td>
              <td className="px-4 py-3 text-muted">{sourceLabel(company.source)}</td>
              <td className="hidden px-4 py-3 text-muted sm:table-cell">
                <time dateTime={company.added_at}>{dateFormat.format(new Date(company.added_at))}</time>
              </td>
              <td className="px-4 py-3">
                <Status company={company} />
              </td>
              <td className="px-4 py-3 text-right">
                <RowMenu name={company.name} items={menuItems(company)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
