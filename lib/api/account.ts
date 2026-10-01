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
