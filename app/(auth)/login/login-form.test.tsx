import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getToken, clearToken } from "@/lib/session";
import { LoginForm } from "./login-form";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const TOKEN = "header.eyJ1c2VyX2lkIjoidTEiLCJleHAiOjQxMDI0NDQ4MDB9.sig";

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

async function fillAndSubmit(email = "ada@example.com", password = "correct horse") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Log in" }));
}

describe("LoginForm", () => {
  beforeEach(() => {
    render(<LoginForm />);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    replace.mockReset();
    clearToken();
  });

  it("stores the token and redirects into the app on success", async () => {
    const fetchSpy = mockFetch(200, { access_token: TOKEN, token_type: "bearer" });

    await fillAndSubmit();

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/setup"));
    expect(getToken()).toBe(TOKEN);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://api.test/auth/login");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      email: "ada@example.com",
      password: "correct horse",
    });
  });

  it("shows invalid credentials inline and keeps the email value", async () => {
    mockFetch(401, { detail: "Invalid email or password" });

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(replace).not.toHaveBeenCalled();
    expect(getToken()).toBeNull();
  });

  it("shows validation errors under the matching field", async () => {
    mockFetch(422, {
      detail: [{ loc: ["body", "email"], msg: "value is not a valid email address" }],
    });

    await fillAndSubmit("ada@example");

    expect(await screen.findByText("value is not a valid email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a form-level alert when the server is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/can't reach the server/i);
  });

  it("returns to the page from ?next= after login", async () => {
    mockFetch(200, { access_token: TOKEN, token_type: "bearer" });
    cleanup();
    render(<LoginForm next="/settings?tab=profile" />);

    await fillAndSubmit();

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/settings?tab=profile"));
  });

  it("ignores an off-site ?next=", async () => {
    mockFetch(200, { access_token: TOKEN, token_type: "bearer" });
    cleanup();
    render(<LoginForm next="//evil.example" />);

    await fillAndSubmit();

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/setup"));
  });

  it("links to sign up", () => {
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup");
  });

  it("links to the forgot-password page", () => {
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });
});
