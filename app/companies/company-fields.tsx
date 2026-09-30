"use client";

import { useState } from "react";
import { BOARDS, type Board, type CompanyInput, type EditableSource } from "@/lib/api/companies";
import { Field } from "./field";

export const TIERS = [1, 2, 3] as const;

/** Form field names; also the last `loc` segment of matching 422 errors. */
export const COMPANY_FIELDS = [
  "name",
  "website_url",
  "tier",
  "board",
  "board_id",
  "strategy",
  "careers_url",
  "job",
  "title",
  "link",
  "location",
] as const;
export type CompanyField = (typeof COMPANY_FIELDS)[number];

/** Prefill values; `source` is absent when it can't be edited here (`custom`). */
export type CompanyDefaults = Omit<CompanyInput, "source"> & { source?: EditableSource };

type Errors = Partial<Record<CompanyField, string>>;

function text(formData: FormData, name: CompanyField): string {
  return String(formData.get(name) ?? "").trim();
}

function readSource(formData: FormData): EditableSource {
  if (formData.get("kind") === "board") {
    return {
      kind: "board",
      board: text(formData, "board") as Board,
      board_id: text(formData, "board_id"),
    };
  }
  const location = text(formData, "location");
  return {
    kind: "scraper",
    strategy: formData.get("strategy") === "dynamic" ? "dynamic" : "static",
    selectors: {
      careers_url: text(formData, "careers_url"),
      job: text(formData, "job"),
      title: text(formData, "title"),
      link: text(formData, "link"),
      ...(location ? { location } : {}),
    },
  };
}

/** Builds the `POST /companies` / `PUT /companies/{id}` body from the form. */
export function readCompanyInput(formData: FormData): CompanyInput {
  return {
    name: text(formData, "name"),
    tier: Number(formData.get("tier")),
    website_url: text(formData, "website_url"),
    source: readSource(formData),
  };
}

const selectClass =
  "rounded-md border border-divider bg-field px-3 py-2 text-sm outline-none focus:border-accent";

type Props = {
  idPrefix: string;
  defaults?: CompanyDefaults;
  errors?: Errors;
  /** Note under the tier picker for the selected tier, if any. */
  tierHint?: (tier: number) => string | undefined;
};

/** Name, website, tier and an explicit source: a job board or a scraper. */
export function CompanyFields({ idPrefix, defaults, errors = {}, tierHint }: Props) {
  const source = defaults?.source;
  const [kind, setKind] = useState<EditableSource["kind"]>(source?.kind ?? "board");
  const [tier, setTier] = useState(defaults?.tier ?? 2);
  const hint = tierHint?.(tier);
  const board = source?.kind === "board" ? source : undefined;
  const scraper = source?.kind === "scraper" ? source : undefined;
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field idPrefix={idPrefix} name="name" label="Name" defaultValue={defaults?.name} error={errors.name} />
        <Field
          idPrefix={idPrefix}
          name="website_url"
          label="Website"
          type="url"
          placeholder="https://example.com"
          defaultValue={defaults?.website_url}
          error={errors.website_url}
        />
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Tier</legend>
        <div className="flex gap-2">
          {TIERS.map((option) => (
            <label
              key={option}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-divider bg-field px-3 py-2 text-sm has-checked:border-accent has-checked:font-semibold"
            >
              <input
                type="radio"
                name="tier"
                value={option}
                checked={tier === option}
                onChange={() => setTier(option)}
                className="accent-accent"
              />
              Tier {option}
            </label>
          ))}
        </div>
        {hint && <p className="text-xs text-muted">{hint}</p>}
        {errors.tier && <p className="text-sm text-danger">{errors.tier}</p>}
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Source</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="kind"
              value="board"
              checked={kind === "board"}
              onChange={() => setKind("board")}
              className="accent-accent"
            />
            Job board
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="kind"
              value="scraper"
              checked={kind === "scraper"}
              onChange={() => setKind("scraper")}
              className="accent-accent"
            />
            Scraper
          </label>
        </div>
      </fieldset>

      {kind === "board" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id("board")} className="text-sm font-medium">
              Board
            </label>
            <select id={id("board")} name="board" defaultValue={board?.board ?? BOARDS[0]} className={selectClass}>
              {BOARDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            {errors.board && <p className="text-sm text-danger">{errors.board}</p>}
          </div>
          <Field
            idPrefix={idPrefix}
            name="board_id"
            label="Board id"
            placeholder="e.g. stripe"
            defaultValue={board?.board_id}
            error={errors.board_id}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={id("strategy")} className="text-sm font-medium">
                Strategy
              </label>
              <select
                id={id("strategy")}
                name="strategy"
                defaultValue={scraper?.strategy ?? "static"}
                className={selectClass}
              >
                <option value="static">static</option>
                <option value="dynamic">dynamic</option>
              </select>
            </div>
            <Field
              idPrefix={idPrefix}
              name="careers_url"
              label="Careers URL"
              type="url"
              placeholder="https://example.com/careers"
              defaultValue={scraper?.selectors.careers_url}
              error={errors.careers_url}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              idPrefix={idPrefix}
              name="job"
              label="Job card selector"
              defaultValue={scraper?.selectors.job}
              error={errors.job}
            />
            <Field
              idPrefix={idPrefix}
              name="title"
              label="Title selector"
              defaultValue={scraper?.selectors.title}
              error={errors.title}
            />
            <Field
              idPrefix={idPrefix}
              name="link"
              label="Link selector"
              defaultValue={scraper?.selectors.link}
              error={errors.link}
            />
            <Field
              idPrefix={idPrefix}
              name="location"
              label="Location selector (optional)"
              required={false}
              defaultValue={scraper?.selectors.location}
              error={errors.location}
            />
          </div>
        </div>
      )}
    </div>
  );
}
