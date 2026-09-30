import type { Company, Source } from "@/lib/api/companies";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/** Board name for board-backed companies, otherwise the source kind. */
export function sourceLabel(source: Source): string {
  return source.kind === "board" ? source.board : source.kind;
}

type Props = {
  companies: Company[];
};

export function CompaniesTable({ companies }: Props) {
  return (
    <div className="overflow-x-auto rounded-md border border-divider">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface text-xs text-muted">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Tier</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Job board</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Added</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
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
              <td className="px-4 py-3 text-muted">
                <time dateTime={company.added_at}>{dateFormat.format(new Date(company.added_at))}</time>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full ${
                      company.active ? "bg-accent" : "border border-muted"
                    }`}
                  />
                  {company.active ? "Active" : "Paused"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
