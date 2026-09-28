"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { googleAuth, signup, type TokenResponse } from "@/lib/api/auth";
import { toFormErrors, type FormErrors } from "@/lib/api/errors";
import { setToken } from "@/lib/session";
import { GoogleButton } from "./google-button";

const FIELDS = ["email", "password"] as const;
type Field = (typeof FIELDS)[number];

type State = FormErrors<Field> & { email: string };

const initialState: State = { fieldErrors: {}, email: "" };

/** Where a new account lands; the real Setup screen is a later ticket. */
export const AFTER_SIGNUP_PATH = "/setup";

export function SignupForm() {
  const router = useRouter();
  const [googleError, setGoogleError] = useState<string>();

  function onAuthenticated({ access_token }: TokenResponse) {
    setToken(access_token);
    router.replace(AFTER_SIGNUP_PATH);
  }

  async function submit(_prev: State, formData: FormData): Promise<State> {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    setGoogleError(undefined);
    try {
      onAuthenticated(await signup(email, password));
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
      <GoogleButton onCredential={onGoogleCredential} />

      <div className="flex items-center gap-3 text-xs text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-divider" />
        or
        <span className="h-px flex-1 bg-divider" />
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <TextField
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          error={fieldErrors.email}
        />
        <TextField
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          error={fieldErrors.password}
        />

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
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-foreground underline underline-offset-2">
          Log in
        </Link>
      </p>
    </div>
  );
}

type TextFieldProps = {
  name: Field;
  label: string;
  type: "email" | "password";
  autoComplete: string;
  defaultValue?: string;
  error?: string;
};

function TextField({ name, label, type, autoComplete, defaultValue, error }: TextFieldProps) {
  const id = `signup-${name}`;
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="rounded-md border border-divider bg-field px-3 py-2 text-sm outline-none focus:border-accent aria-invalid:border-danger"
      />
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
