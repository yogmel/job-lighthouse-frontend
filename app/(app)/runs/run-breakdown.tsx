import { sourceLabel } from "@/app/(app)/companies/companies-table";
import type { Company } from "@/lib/api/companies";
import type { Run, RunCompanyResult } from "@/lib/api/runs";
import { durationLabel, plural, startedLabel } from "./format";

/** An ok fetch with 0 or 1 jobs usually means a stale selector or a partial page. */
export function needsAttention(result: RunCompanyResult): boolean {
  return result.status === "failed" || (result.status === "ok" && result.jobs_found <= 1);
}

/** Healthy rows first, then the ones to look at, then skipped — as in the mockup. */
function rank(result: RunCompanyResult): number {
  if (result.status === "skipped") return 2;
  return needsAttention(result) ? 1 : 0;
}

function Dot({ result }: { result: RunCompanyResult }) {
  const className =
    result.status === "skipped"
      ? "border border-muted"
      : needsAttention(result)
        ? "bg-danger"
        : "bg-accent";
  return <span aria-hidden="true" className={`size-2 flex-none rounded-full ${className}`} />;
}

function describe(result: RunCompanyResult, company: Company | undefined): string {
  const parts = [result.company_name || company?.name || "Removed company"];
  if (company) parts.push(sourceLabel(company.source));
  if (result.status !== "skipped") parts.push(plural(result.jobs_found, "job"));
  if (result.status === "ok" && result.jobs_found <= 1 && !result.error) parts.push("likely partial");
  if (result.error) parts.push(result.error);
  return parts.join(" · ");
}

type Props = {
  run: Run;
  now: Date;
  companies: Map<string, Company>;
  /** undefined while loading. */
  results: RunCompanyResult[] | undefined;
  error?: string;
};

export function RunBreakdown({ run, now, companies, results, error }: Props) {
  const duration = durationLabel(run.started_at, run.finished_at);
  const meta = [
    duration ?? "Running",
    results && plural(results.length, "company", "companies"),
  ].filter(Boolean);
  const sorted = results && [...results].sort((a, b) => rank(a) - rank(b));

  return (
    <section
      aria-label="Per-company breakdown"
      className="flex flex-col gap-3 rounded-md border border-divider p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">{startedLabel(run.started_at, now)}</h2>
        <span className="text-xs text-muted">{meta.join(" · ")}</span>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {!error && !sorted && <p className="text-sm text-muted">Loading breakdown…</p>}
      {sorted?.length === 0 && <p className="text-sm text-muted">No companies in this run.</p>}

      {sorted && sorted.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {sorted.map((result) => (
            <li key={result.id} className="flex items-center gap-2">
              <Dot result={result} />
              <span className="flex-1">{describe(result, companies.get(result.company_id))}</span>
              <span
                className={`text-xs ${result.status === "failed" ? "font-semibold text-danger" : "text-muted"}`}
              >
                {result.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
