import type { Company } from "@/lib/api/companies";

export type SortKey = "name" | "added";
export type SortDir = "asc" | "desc";
export type CompanySort = { key: SortKey; dir: SortDir };

export const DEFAULT_SORT: CompanySort = { key: "name", dir: "asc" };

/** Direction a column starts in: names A–Z, dates newest first. */
const FIRST_DIR: Record<SortKey, SortDir> = { name: "asc", added: "desc" };

const SORT_PARAM = "sort";

/** `?sort=name|-name|added|-added`; a leading "-" is descending. Unknown values fall back to name A–Z. */
export function parseSort(params: URLSearchParams): CompanySort {
  const value = params.get(SORT_PARAM) ?? "";
  const dir: SortDir = value.startsWith("-") ? "desc" : "asc";
  const key = value.replace(/^-/, "");
  return key === "name" || key === "added" ? { key, dir } : DEFAULT_SORT;
}

/** `params` with the sort set; the default is left out, other params are kept. */
export function writeSort(params: URLSearchParams, sort: CompanySort): URLSearchParams {
  const next = new URLSearchParams(params);
  if (sort.key === DEFAULT_SORT.key && sort.dir === DEFAULT_SORT.dir) next.delete(SORT_PARAM);
  else next.set(SORT_PARAM, `${sort.dir === "desc" ? "-" : ""}${sort.key}`);
  return next;
}

/** Clicking the sorted column flips it; another column starts in its own first direction. */
export function nextSort(current: CompanySort, key: SortKey): CompanySort {
  if (current.key !== key) return { key, dir: FIRST_DIR[key] };
  return { key, dir: current.dir === "asc" ? "desc" : "asc" };
}

const collator = new Intl.Collator("en", { sensitivity: "base" });

export function sortCompanies(companies: Company[], { key, dir }: CompanySort): Company[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...companies].sort(
    (a, b) =>
      sign *
      (key === "name"
        ? collator.compare(a.name, b.name)
        : Date.parse(a.added_at) - Date.parse(b.added_at)),
  );
}
