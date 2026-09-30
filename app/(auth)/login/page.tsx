import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in · Job Lighthouse",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-lg bg-surface p-8 shadow-sm">
        <h1 className="font-heading text-3xl">Welcome back</h1>
        <p className="mt-2 text-sm text-muted">Log in to see your latest scored openings.</p>
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </div>
    </main>
  );
}
