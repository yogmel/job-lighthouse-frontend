import type { Metadata } from "next";
import { CompaniesScreen } from "./companies-screen";

export const metadata: Metadata = {
  title: "Companies · Job Lighthouse",
};

export default function CompaniesPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
      <CompaniesScreen />
    </main>
  );
}
