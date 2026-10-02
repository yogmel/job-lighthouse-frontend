import { apiFetch } from "./client";

export type Account = {
  id: string;
  email: string;
  email_verified: boolean;
  has_password: boolean;
  google_linked: boolean;
  created_at: string;
};

export function getAccount(): Promise<Account> {
  return apiFetch<Account>("/account");
}

/**
 * At least one of `email` / `new_password`. `current_password` is required
 * when the account has a password; a wrong one answers 403 (not 401).
 */
export type AccountUpdate = {
  current_password?: string;
  email?: string;
  new_password?: string;
};

export function updateAccount(update: AccountUpdate): Promise<Account> {
  return apiFetch<Account>("/account", { method: "PUT", body: JSON.stringify(update) });
}

/**
 * Every row the user owns, as JSON. The shape isn't in SYSTEM_DESIGN.md;
 * the UI only saves it to a file, so it stays `unknown`.
 */
export function exportAccount(): Promise<unknown> {
  return apiFetch<unknown>("/account/export");
}

/**
 * Deletes the account and everything it owns. Assumed to answer 204;
 * the token stops working right after (BE-044).
 */
export async function deleteAccount(): Promise<void> {
  await apiFetch<null>("/account", { method: "DELETE" });
}
