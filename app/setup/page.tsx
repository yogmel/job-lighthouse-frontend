import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setup · Job Lighthouse",
};

/** Placeholder landing after signup; the Setup screen is a later ticket. */
export default function SetupPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="max-w-md text-center">
        <h1 className="font-heading text-3xl">You&apos;re in</h1>
        <p className="mt-2 text-muted">Setup is coming soon.</p>
      </div>
    </main>
  );
}
