import type { Metadata } from "next";
import { SettingsScreen } from "./settings-screen";

export const metadata: Metadata = {
  title: "Settings · Job Lighthouse",
};

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
      <SettingsScreen />
    </main>
  );
}
