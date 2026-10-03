import type { Metadata } from "next";
import { RunsScreen } from "./runs-screen";

export const metadata: Metadata = {
  title: "Runs · Job Lighthouse",
};

export default function RunsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
      <RunsScreen />
    </main>
  );
}
