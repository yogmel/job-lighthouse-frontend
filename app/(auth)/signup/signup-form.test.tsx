import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getToken, clearToken } from "@/lib/session";
import { SignupForm } from "./signup-form";

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
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

describe("SignupForm", () => {
  beforeEach(() => {
    render(<SignupForm />);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    replace.mockReset();
    clearToken();
  });

  it("stores the token and redirects into the app on success", async () => {
    const fetchSpy = mockFetch(201, { access_token: TOKEN, token_type: "bearer" });

    await fillAndSubmit();

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/jobs"));
    expect(getToken()).toBe(TOKEN);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://api.test/auth/signup");
    expect(JSON.parse(String(init?.body))).toEqual({
      email: "ada@example.com",
      password: "correct horse",
    });
  });

  it("shows a duplicate email inline and keeps the email value", async () => {
    mockFetch(409, { detail: "Email already registered" });

    await fillAndSubmit();

    const email = screen.getByLabelText("Email");
    expect(await screen.findByText("Email already registered")).toBeInTheDocument();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Email already registered");
    expect(email).toHaveValue("ada@example.com");
    expect(replace).not.toHaveBeenCalled();
    expect(getToken()).toBeNull();
  });

  it("shows validation errors under the matching field", async () => {
    mockFetch(422, {
      detail: [{ loc: ["body", "password"], msg: "String should have at least 8 characters" }],
    });

    await fillAndSubmit("ada@example.com", "short");

    expect(await screen.findByText("String should have at least 8 characters")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a form-level alert when the server is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/can't reach the server/i);
  });
});
