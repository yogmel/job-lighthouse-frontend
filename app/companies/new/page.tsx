import type { Metadata } from "next";
import { AddCompanyScreen } from "./add-company-screen";

export const metadata: Metadata = {
  title: "Add a company · Job Lighthouse",
};

export default function AddCompanyPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <AddCompanyScreen />
    </main>
  );
}
