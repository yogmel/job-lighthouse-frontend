import { apiFetch } from "./client";

export type TokenResponse = {
  access_token: string;
  token_type: "bearer";
};

export function signup(email: string, password: string): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/auth/signup", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ email, password }),
  });
}

export function login(email: string, password: string): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ email, password }),
  });
}

export function googleAuth(idToken: string): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/auth/google", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ id_token: idToken }),
  });
}

/**
 * Asks for a reset link by email. Not in SYSTEM_DESIGN.md's shapes table yet;
 * assumed to be `{ email }` answering 2xx. The backend answers the same for
 * unknown emails (BE-041), so success says nothing about the account.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiFetch<unknown>("/auth/password-reset/request", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ email }),
  });
}

/**
 * Sets a new password from the emailed token. Assumed to be
 * `{ token, new_password }` answering 2xx (field name matches `PUT /account`).
 */
export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  await apiFetch<unknown>("/auth/password-reset/confirm", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}
