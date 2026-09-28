import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Sign up · Job Lighthouse",
};

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-lg bg-surface p-8 shadow-sm">
        <h1 className="font-heading text-3xl">Create your account</h1>
        <p className="mt-2 text-sm text-muted">
          Track companies and get every new opening scored against your profile.
        </p>
        <SignupForm />
      </div>
    </main>
  );
}
