import type { Metadata } from "next";
import { JobsScreen } from "./jobs-screen";

export const metadata: Metadata = {
  title: "Jobs · Job Lighthouse",
};

export default function JobsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
      <JobsScreen />
    </main>
  );
}
