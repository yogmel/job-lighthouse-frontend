import { describe, expect, it } from "vitest";
import type { Company } from "@/lib/api/companies";
import { DEFAULT_SORT, nextSort, parseSort, sortCompanies, writeSort } from "./company-sort";

const company = (id: string, name: string, added_at: string): Company => ({
  id,
  user_id: "u1",
  name,
  tier: 1,
  added_at,
  website_url: `https://${id}.example`,
  active: true,
  source: { kind: "board", board: "ashby", board_id: id },
});

const COMPANIES = [
  company("c1", "northstar", "2026-04-08T12:00:00Z"),
  company("c2", "Halden", "2026-03-28T12:00:00Z"),
  company("c3", "Orbit", "2026-05-02T12:00:00Z"),
];

describe("parseSort / writeSort", () => {
  it.each([
    ["", DEFAULT_SORT],
    ["sort=-name", { key: "name", dir: "desc" }],
    ["sort=added", { key: "added", dir: "asc" }],
    ["sort=-added", { key: "added", dir: "desc" }],
    ["sort=bogus", DEFAULT_SORT],
  ])("reads %j", (query, sort) => {
    expect(parseSort(new URLSearchParams(query))).toEqual(sort);
  });

  it("leaves the default out and keeps other params", () => {
    expect(writeSort(new URLSearchParams("tier=1&sort=-added"), DEFAULT_SORT).toString()).toBe("tier=1");
    expect(writeSort(new URLSearchParams("tier=1"), { key: "added", dir: "desc" }).toString()).toBe(
      "tier=1&sort=-added",
    );
  });
});

describe("nextSort", () => {
  it("flips the direction on the sorted column", () => {
    expect(nextSort(DEFAULT_SORT, "name")).toEqual({ key: "name", dir: "desc" });
    expect(nextSort({ key: "name", dir: "desc" }, "name")).toEqual({ key: "name", dir: "asc" });
  });

  it("starts name A–Z and date added newest first", () => {
    expect(nextSort({ key: "added", dir: "asc" }, "name")).toEqual({ key: "name", dir: "asc" });
    expect(nextSort(DEFAULT_SORT, "added")).toEqual({ key: "added", dir: "desc" });
  });
});

describe("sortCompanies", () => {
  const names = (list: Company[]) => list.map((c) => c.name);

  it("sorts by name, ignoring case", () => {
    expect(names(sortCompanies(COMPANIES, DEFAULT_SORT))).toEqual(["Halden", "northstar", "Orbit"]);
    expect(names(sortCompanies(COMPANIES, { key: "name", dir: "desc" }))).toEqual([
      "Orbit",
      "northstar",
      "Halden",
    ]);
  });

  it("sorts by date added", () => {
    expect(names(sortCompanies(COMPANIES, { key: "added", dir: "desc" }))).toEqual([
      "Orbit",
      "northstar",
      "Halden",
    ]);
    expect(names(sortCompanies(COMPANIES, { key: "added", dir: "asc" }))).toEqual([
      "Halden",
      "northstar",
      "Orbit",
    ]);
  });

  it("does not change the input", () => {
    sortCompanies(COMPANIES, DEFAULT_SORT);
    expect(names(COMPANIES)).toEqual(["northstar", "Halden", "Orbit"]);
  });
});
