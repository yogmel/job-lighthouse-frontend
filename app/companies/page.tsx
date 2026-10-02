import type { Metadata } from "next";
import { CompaniesScreen } from "./companies-screen";

export const metadata: Metadata = {
  title: "Companies · Job Lighthouse",
};

function count(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export default async function CompaniesPage({ searchParams }: PageProps<"/companies">) {
  const { added, found, matched, via } = await searchParams;
  const name = Array.isArray(added) ? added[0] : added;
  const board = Array.isArray(via) ? via[0] : via;
  // Set by the add-company confirm step to show the "added" banner.
  const justAdded =
    name && board ? { name, found: count(found), matched: count(matched), via: board } : undefined;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
      <CompaniesScreen justAdded={justAdded} />
    </main>
  );
}
