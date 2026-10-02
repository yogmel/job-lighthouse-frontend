"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { detectCompany, type Detection } from "@/lib/api/companies";
import { toFormErrors } from "@/lib/api/errors";
import { TIERS } from "../company-fields";
import { ResolvingCard } from "./resolving-card";

type Step =
  | { status: "paste"; error?: string }
  | { status: "resolving"; url: string }
  | { status: "resolved"; url: string; name: string; tier: number; detection: Detection };

const STEPS = ["1 · Paste URL", "2 · Agent resolves", "3 · Confirm"];

function stepIndex(step: Step): number {
  return step.status === "paste" ? 0 : step.status === "resolving" ? 1 : 2;
}

/** Hostname for display; falls back to the raw text when it isn't a URL. */
export function displayHost(raw: string): string {
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).host;
  } catch {
    return raw;
  }
}

/** The pasted text with a scheme, since people paste `acme.com/careers`. */
function withScheme(raw: string): string {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export function AddCompanyScreen() {
  const [step, setStep] = useState<Step>({ status: "paste" });
  const [name, setName] = useState("");
  const [tier, setTier] = useState(2);
  const [url, setUrl] = useState("");
  const abort = useRef<AbortController>(null);

  async function find(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const pasted = url.trim();
    if (!pasted) return;
    const controller = new AbortController();
    abort.current = controller;
    setStep({ status: "resolving", url: pasted });
    try {
      const detection = await detectCompany(withScheme(pasted), controller.signal);
      setStep({
        status: "resolved",
        url: pasted,
        name: name.trim() || detection.name,
        tier,
        detection,
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      const { formError, fieldErrors } = toFormErrors(err, ["url"]);
      setStep({
        status: "paste",
        error: fieldErrors.url ?? formError ?? "Something went wrong. Please try again.",
      });
    }
  }

  function cancel() {
    abort.current?.abort();
    setStep({ status: "paste" });
  }

  const current = stepIndex(step);

  return (
    <>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          <Link href="/companies" className="underline">
            Companies
          </Link>{" "}
          · Add company
        </p>
        <h1 className="font-heading text-3xl">Add a company</h1>
        <ol className="flex flex-wrap gap-2 text-xs font-semibold">
          {STEPS.map((label, i) => (
            <li
              key={label}
              aria-current={i === current ? "step" : undefined}
              className={`rounded-full px-3 py-1 ${
                i === current
                  ? "bg-accent text-white"
                  : i < current
                    ? "bg-surface text-foreground"
                    : "bg-surface text-muted"
              }`}
            >
              {label}
            </li>
          ))}
        </ol>
      </div>

      {step.status === "paste" && (
        <form onSubmit={find} className="flex flex-col gap-5 rounded-lg border border-divider p-6">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-url" className="text-sm font-medium">
              Careers URL
            </label>
            <input
              id="add-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="acme.com/careers"
              aria-invalid={step.error ? true : undefined}
              aria-describedby="add-url-hint"
              className="rounded-md border border-divider bg-field px-3 py-2 text-sm outline-none focus:border-accent aria-invalid:border-danger"
            />
            <p id="add-url-hint" className="text-xs text-muted">
              Any careers or job-board page. The agent detects Greenhouse, Lever, Ashby and
              SmartRecruiters — otherwise it writes a scraper.
            </p>
            {step.error && (
              <p role="alert" className="text-sm text-danger">
                {step.error}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <label htmlFor="add-name" className="text-sm font-medium">
                Name
              </label>
              <input
                id="add-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="filled in automatically"
                className="rounded-md border border-divider bg-field px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-medium">Tier</legend>
              <div className="flex gap-4 py-2">
                {TIERS.map((t) => (
                  <label key={t} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="tier"
                      value={t}
                      checked={tier === t}
                      onChange={() => setTier(t)}
                    />
                    {t}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div>
            <button
              type="submit"
              disabled={!url.trim()}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              Find their jobs
            </button>
          </div>
        </form>
      )}

      {step.status === "resolving" && (
        <ResolvingCard name={name.trim()} host={displayHost(step.url)} onCancel={cancel} />
      )}

      {step.status === "resolved" && (
        <p role="status" className="rounded-md border border-accent/40 bg-surface px-4 py-3 text-sm">
          Detected {step.detection.source.kind === "board" ? step.detection.source.board : "a scraper"}{" "}
          for {displayHost(step.url)}: {step.detection.jobs_found} openings found.
        </p>
      )}
    </>
  );
}
