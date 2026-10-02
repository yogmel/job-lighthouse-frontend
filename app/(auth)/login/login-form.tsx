"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { googleAuth, login, type TokenResponse } from "@/lib/api/auth";
import { toFormErrors, type FormErrors } from "@/lib/api/errors";
import { FORGOT_PASSWORD_PATH, safeNextPath } from "@/lib/routes";
import { setToken } from "@/lib/session";
import { GoogleButton } from "../google-button";
import { TextField } from "../text-field";

const FIELDS = ["email", "password"] as const;
type Field = (typeof FIELDS)[number];

type State = FormErrors<Field> & { email: string };

const initialState: State = { fieldErrors: {}, email: "" };

type Props = {
  /** Page to return to after login, from `?next=`; validated before use. */
  next?: string;
};

export function LoginForm({ next }: Props) {
  const router = useRouter();
  const [googleError, setGoogleError] = useState<string>();

  function onAuthenticated({ access_token }: TokenResponse) {
    setToken(access_token);
    router.replace(safeNextPath(next));
  }

  async function submit(_prev: State, formData: FormData): Promise<State> {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    setGoogleError(undefined);
    try {
      onAuthenticated(await login(email, password));
      return { fieldErrors: {}, email };
    } catch (err) {
      return { ...toFormErrors(err, FIELDS), email };
    }
  }

  async function onGoogleCredential(idToken: string) {
    setGoogleError(undefined);
    try {
      onAuthenticated(await googleAuth(idToken));
    } catch (err) {
      const { formError, fieldErrors } = toFormErrors(err, FIELDS);
      setGoogleError(formError ?? fieldErrors.email ?? fieldErrors.password);
    }
  }

  const [state, formAction, pending] = useActionState(submit, initialState);
  const { fieldErrors } = state;
  const formError = googleError ?? state.formError;

  return (
    <div className="mt-6 flex flex-col gap-6">
      <GoogleButton text="signin_with" onCredential={onGoogleCredential} />

      <div className="flex items-center gap-3 text-xs text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-divider" />
        or
        <span className="h-px flex-1 bg-divider" />
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <TextField
          idPrefix="login"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          error={fieldErrors.email}
        />
        <TextField
          idPrefix="login"
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          error={fieldErrors.password}
        />
        <Link
          href={FORGOT_PASSWORD_PATH}
          className="-mt-2 self-end text-sm text-muted underline underline-offset-2 hover:text-foreground"
        >
          Forgot password?
        </Link>

        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        New to Job Lighthouse?{" "}
        <Link href="/signup" className="font-semibold text-foreground underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </div>
  );
}
