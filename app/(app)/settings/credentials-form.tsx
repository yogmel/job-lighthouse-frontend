"use client";

import { useState, type FormEvent } from "react";
import { updateAccount, type Account, type AccountUpdate } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { toFormErrors } from "@/lib/api/errors";

const FIELDS = ["email", "current_password", "new_password"] as const;
type Field = (typeof FIELDS)[number];

type Errors = { fieldErrors: Partial<Record<Field, string>>; formError?: string };

type Props = {
  account: Account;
  onSaved: (account: Account) => void;
};

function signInSummary({ has_password, google_linked }: Account): string {
  const password = has_password ? "Password set" : "No password";
  return google_linked ? `${password} · Google linked` : password;
}

function PasswordInput({
  name,
  label,
  autoComplete,
  error,
}: {
  name: Field;
  label: string;
  autoComplete: string;
  error?: string;
}) {
  const id = `account-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="password"
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="rounded-md border border-divider bg-field px-3 py-2 text-sm outline-none focus:border-accent aria-invalid:border-danger"
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Change the login email and/or password (`PUT /account`). */
export function CredentialsForm({ account, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({ fieldErrors: {} });
  // Bumped after a save to clear the password inputs.
  const [formKey, setFormKey] = useState(0);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const currentPassword = String(data.get("current_password") ?? "");
    const newPassword = String(data.get("new_password") ?? "");

    const update: AccountUpdate = {};
    if (email !== account.email) update.email = email;
    if (newPassword) update.new_password = newPassword;
    if (!update.email && !update.new_password) {
      setErrors({ fieldErrors: {}, formError: "Change your email or enter a new password." });
      return;
    }
    if (account.has_password) {
      if (!currentPassword) {
        setErrors({ fieldErrors: { current_password: "Enter your current password." } });
        return;
      }
      update.current_password = currentPassword;
    }

    setSaving(true);
    setErrors({ fieldErrors: {} });
    try {
      onSaved(await updateAccount(update));
      setFormKey((k) => k + 1);
    } catch (err) {
      // 403 = missing or wrong current password; the session stays.
      if (err instanceof ApiError && err.status === 403) {
        const detail = typeof err.detail === "string" ? err.detail : "Current password is incorrect.";
        setErrors({ fieldErrors: { current_password: detail } });
      } else {
        setErrors(toFormErrors(err, FIELDS));
      }
    } finally {
      setSaving(false);
    }
  }

  const { fieldErrors, formError } = errors;

  return (
    <form key={formKey} onSubmit={save} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="account-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="account-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={account.email}
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "account-email-error" : undefined}
          className="rounded-md border border-divider bg-field px-3 py-2 text-sm outline-none focus:border-accent aria-invalid:border-danger"
        />
        {fieldErrors.email && (
          <p id="account-email-error" className="text-sm text-danger">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-wide text-muted uppercase">Sign in</span>
        <p className="text-sm text-muted">{signInSummary(account)}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {account.has_password && (
            <PasswordInput
              name="current_password"
              label="Current password"
              autoComplete="current-password"
              error={fieldErrors.current_password}
            />
          )}
          <PasswordInput
            name="new_password"
            label={account.has_password ? "New password" : "Set a password"}
            autoComplete="new-password"
            error={fieldErrors.new_password}
          />
        </div>
        <p className="text-xs text-muted">Leave the new password empty to keep the current one.</p>
      </div>

      {formError && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
