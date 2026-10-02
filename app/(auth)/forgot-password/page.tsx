import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password · Job Lighthouse",
};

export default function ForgotPasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-lg bg-surface p-8 shadow-sm">
        <h1 className="font-heading text-3xl">Forgot your password?</h1>
        <p className="mt-2 text-sm text-muted">
          Enter your email and we&apos;ll send you a link to set a new one.
        </p>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
