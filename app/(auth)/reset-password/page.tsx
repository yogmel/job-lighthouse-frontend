import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Set a new password · Job Lighthouse",
  // The reset token is in the URL; keep it out of Referer headers.
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-lg bg-surface p-8 shadow-sm">
        <h1 className="font-heading text-3xl">Set a new password</h1>
        <ResetPasswordForm token={typeof token === "string" ? token : undefined} />
      </div>
    </main>
  );
}
