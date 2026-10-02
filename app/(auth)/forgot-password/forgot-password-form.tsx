"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/api/auth";
import { isRejectedInput, toFormErrors } from "@/lib/api/errors";
import { LOGIN_PATH } from "@/lib/routes";
import { TextField } from "../text-field";

type State = { sent: boolean; email: string; formError?: string };

const initialState: State = { sent: false, email: "" };

/**
 * Same message whether or not the email has an account, and even when the
 * backend rejects it: the page must not reveal who is registered (BE-041).
 * Only "couldn't reach the server" is shown, so the user can retry.
 */
export function ForgotPasswordForm() {
  async function submit(_prev: State, formData: FormData): Promise<State> {
    const email = String(formData.get("email") ?? "").trim();
    try {
      await requestPasswordReset(email);
    } catch (err) {
      if (!isRejectedInput(err)) {
        return { sent: false, email, formError: toFormErrors(err, []).formError };
      }
    }
    return { sent: true, email };
  }

  const [state, formAction, pending] = useActionState(submit, initialState);

  if (state.sent) {
    return (
      <div className="mt-6 flex flex-col gap-6">
        <p role="status" className="rounded-md border border-accent/40 bg-background px-4 py-3 text-sm">
          If an account exists for <strong>{state.email}</strong>, we&apos;ve sent a link to reset
          its password. Check your inbox.
        </p>
        <BackToLogin />
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <TextField
          idPrefix="forgot"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
        />

        {state.formError && (
          <p role="alert" className="text-sm text-danger">
            {state.formError}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <BackToLogin />
    </div>
  );
}

function BackToLogin() {
  return (
    <p className="text-center text-sm text-muted">
      <Link href={LOGIN_PATH} className="font-semibold text-foreground underline underline-offset-2">
        Back to log in
      </Link>
    </p>
  );
}
