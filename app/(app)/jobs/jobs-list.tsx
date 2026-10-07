import type { Job } from "@/lib/api/jobs";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/** Scraped URLs are untrusted: only link out to http(s). */
export function safeHref(url: string): string | undefined {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

export type JobRow = Job & {
  /** Current company name, falling back to the name stored at scrape time. */
  companyName: string;
  /** Undefined when the company is gone from the companies list. */
  tier: number | undefined;
};

type Props = {
  jobs: JobRow[];
};

/** Jobs grouped by their company's tier (a client-side key), newest first. */
export function JobsList({ jobs }: Props) {
  const groups = new Map<number | undefined, JobRow[]>();
  const sorted = [...jobs].sort(
    (a, b) =>
      (a.tier ?? Infinity) - (b.tier ?? Infinity) ||
      new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  for (const job of sorted) {
    groups.set(job.tier, [...(groups.get(job.tier) ?? []), job]);
  }

  return (
    <div className="flex flex-col gap-6">
      {[...groups].map(([tier, rows]) => {
        const heading = tier === undefined ? "No tier" : `Tier ${tier}`;
        return (
          <section key={heading} aria-label={heading} className="flex flex-col gap-2">
            <h2 className="sticky top-0 z-10 border-b border-divider bg-background py-2 text-sm font-semibold text-muted">
              {heading} · {rows.length} {rows.length === 1 ? "job" : "jobs"}
            </h2>
            <ul className="divide-y divide-divider rounded-md border border-divider">
              {rows.map((job) => {
                const href = safeHref(job.url);
                return (
                  <li
                    key={job.id}
                    className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm ${
                      job.active ? "" : "opacity-60"
                    }`}
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold hover:text-accent-strong hover:underline"
                        >
                          {job.title}
                        </a>
                      ) : (
                        <span className="font-semibold">{job.title}</span>
                      )}
                      <span className="text-muted">
                        {job.companyName}
                        {job.location && ` · ${job.location}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-muted">
                      {!job.company_active && (
                        <span
                          title="This company is paused: it is not fetched and its jobs stay out of the digest."
                          className="rounded-sm bg-surface px-2 py-0.5 text-xs font-medium"
                        >
                          Paused
                        </span>
                      )}
                      {!job.active && (
                        <span className="rounded-sm bg-surface px-2 py-0.5 text-xs font-medium">
                          Closed
                        </span>
                      )}
                      <time dateTime={job.date}>{dateFormat.format(new Date(job.date))}</time>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
