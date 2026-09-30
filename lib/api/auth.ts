import { apiFetch } from "./client";

export type TokenResponse = {
  access_token: string;
  token_type: "bearer";
};

export function signup(email: string, password: string): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function login(email: string, password: string): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function googleAuth(idToken: string): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken }),
  });
}
