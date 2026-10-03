"use client";

import { useState } from "react";
import { createCompany, type Company, type Detection } from "@/lib/api/companies";
import { toFormErrors } from "@/lib/api/errors";
import { safeHref } from "@/app/(app)/jobs/jobs-list";
import { TIERS } from "../company-fields";

type Props = {
  name: string;
  tier: number;
  /** Site root of the pasted URL; the detect response doesn't carry one. */
  websiteUrl: string;
  detection: Detection;
  onBack: () => void;
  onAdded: (company: Company) => void;
};

function sourceLabel({ source }: Detection): string {
  return source.kind === "board" ? source.board : source.kind === "scraper" ? "scraper" : "custom";
}

/** Review the detected source and its scored sample, then persist it as given. */
export function ConfirmCard({ name: initialName, tier: initialTier, websiteUrl, detection, onBack, onAdded }: Props) {
  const [name, setName] = useState(initialName);
  const [tier, setTier] = useState(initialTier);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const { source, jobs_found, jobs_matched, sample } = detection;

  async function confirm() {
    setPending(true);
    setError(undefined);
    try {
      // The detected source goes through untouched: confirming never re-detects.
      onAdded(
        await createCompany({
          name: name.trim(),
          tier,
          website_url: websiteUrl,
          source: detection.source,
        }),
      );
    } catch (err) {
      const { fieldErrors, formError } = toFormErrors(err, ["name", "website_url", "tier"]);
      setError(formError ?? Object.values(fieldErrors)[0]);
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-5 rounded-lg border border-divider p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">Resolved via {sourceLabel(detection)}</span>
          <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold">Ready</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm-name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="confirm-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-divider bg-field px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        {source.kind === "board" ? (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted">Job board</dt>
              <dd className="font-semibold">{source.board}</dd>
            </div>
            <div>
              <dt className="text-muted">Board id</dt>
              <dd className="font-mono">{source.board_id}</dd>
            </div>
          </dl>
        ) : source.kind === "scraper" ? (
          <dl className="text-sm">
            <dt className="text-muted">Careers page</dt>
            <dd className="break-all font-semibold">{source.selectors.careers_url}</dd>
          </dl>
        ) : null}

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium">Tier</legend>
          <div className="flex gap-4 py-1">
            {TIERS.map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="confirm-tier"
                  checked={tier === t}
                  onChange={() => setTier(t)}
                />
                Tier {t}
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={confirm}
            disabled={pending || !name.trim()}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Adding…" : "Start watching"}
          </button>
          <button
            type="button"
            onClick={onBack}
            disabled={pending}
            className="rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Back
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-divider p-6">
        <h2 className="text-sm font-semibold">
          {jobs_matched} of {jobs_found} openings pass your filters
        </h2>
        {sample.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 font-medium">Title</th>
                <th className="py-1 text-right font-medium">Match</th>
              </tr>
            </thead>
            <tbody>
              {sample.map((job) => {
                const href = safeHref(job.url);
                return (
                  <tr key={job.url} className="border-t border-divider">
                    <td className="py-2 pr-3">
                      {href ? (
                        <a href={href} target="_blank" rel="noreferrer" className="underline">
                          {job.title}
                        </a>
                      ) : (
                        job.title
                      )}
                    </td>
                    <td className="py-2 text-right font-semibold tabular-nums">{job.match_score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="text-xs text-muted">
          {jobs_found - jobs_matched} filtered out by your keywords and locations. They stay out of
          the board and the digest.
        </p>
      </div>
    </div>
  );
}
