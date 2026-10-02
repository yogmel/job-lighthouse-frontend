"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmPasswordReset } from "@/lib/api/auth";
import { isRejectedInput, toFormErrors } from "@/lib/api/errors";
import { FORGOT_PASSWORD_PATH, LOGIN_PATH } from "@/lib/routes";
import { TextField } from "../text-field";

/** Same bounds the backend enforces on every password. */
const MIN_LENGTH = 8;
const MAX_LENGTH = 256;

type Field = "password" | "confirm";

type State = { done: boolean; fieldErrors: Partial<Record<Field, string>>; formError?: string };

const initialState: State = { done: false, fieldErrors: {} };

function checkPasswords(password: string, confirm: string): State["fieldErrors"] {
  if (password.length < MIN_LENGTH) return { password: `Use at least ${MIN_LENGTH} characters.` };
  if (password.length > MAX_LENGTH) return { password: `Use at most ${MAX_LENGTH} characters.` };
  if (password !== confirm) return { confirm: "Passwords don't match." };
  return {};
}

type Props = {
  /** From the emailed link's `?token=`. */
  token?: string;
};

/**
 * Shows the same outcome whether the token was valid or not, so the page
 * can't be used to probe tokens. Only "couldn't reach the server" is shown,
 * so the user can retry.
 */
export function ResetPasswordForm({ token }: Props) {
  async function submit(_prev: State, formData: FormData): Promise<State> {
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    const fieldErrors = checkPasswords(password, confirm);
    if (Object.keys(fieldErrors).length > 0) return { done: false, fieldErrors };
    try {
      await confirmPasswordReset(token ?? "", password);
    } catch (err) {
      if (!isRejectedInput(err)) {
        return { done: false, fieldErrors: {}, formError: toFormErrors(err, []).formError };
      }
    }
    return { done: true, fieldErrors: {} };
  }

  const [state, formAction, pending] = useActionState(submit, initialState);

  if (!token) {
    return (
      <div className="mt-6 flex flex-col gap-6">
        <p role="alert" className="text-sm">
          This link is missing its reset code. Open the link from the email again, or ask for a
          new one.
        </p>
        <p className="text-center text-sm">
          <Link
            href={FORGOT_PASSWORD_PATH}
            className="font-semibold text-foreground underline underline-offset-2"
          >
            Send a new reset link
          </Link>
        </p>
      </div>
    );
  }

  if (state.done) {
    return (
      <div className="mt-6 flex flex-col gap-6">
        <p role="status" className="rounded-md border border-accent/40 bg-background px-4 py-3 text-sm">
          If your reset link was valid, your password has been updated. Log in with the new
          password. If that doesn&apos;t work, the link may have expired — ask for a new one.
        </p>
        <div className="flex flex-col items-center gap-2 text-sm">
          <Link
            href={LOGIN_PATH}
            className="rounded-md bg-accent px-4 py-2.5 font-semibold text-white transition-colors hover:bg-accent-strong"
          >
            Log in
          </Link>
          <Link href={FORGOT_PASSWORD_PATH} className="text-muted underline underline-offset-2">
            Send a new reset link
          </Link>
        </div>
      </div>
    );
  }

  const { fieldErrors } = state;

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <TextField
        idPrefix="reset"
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        error={fieldErrors.password}
      />
      <TextField
        idPrefix="reset"
        name="confirm"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        error={fieldErrors.confirm}
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
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
