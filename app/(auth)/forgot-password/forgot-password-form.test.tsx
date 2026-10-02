import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm } from "./forgot-password-form";

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

async function submit(email = "ada@example.com") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.click(screen.getByRole("button", { name: "Send reset link" }));
}

const GENERIC = /If an account exists for ada@example.com/;

describe("ForgotPasswordForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the email without a token and shows the generic message", async () => {
    const spy = mockFetch(202, { detail: "ok" });
    render(<ForgotPasswordForm />);

    await submit();

    expect(await screen.findByRole("status")).toHaveTextContent(GENERIC);
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("http://api.test/auth/password-reset/request");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ email: "ada@example.com" });
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
  });

  it.each([
    [404, { detail: "No account with that email" }],
    [422, { detail: [{ loc: ["body", "email"], msg: "value is not a valid email address" }] }],
    [400, { detail: "Bad request" }],
  ])("shows the same generic message on a %i", async (status, body) => {
    mockFetch(status, body);
    render(<ForgotPasswordForm />);

    await submit();

    expect(await screen.findByRole("status")).toHaveTextContent(GENERIC);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/No account|not a valid/)).not.toBeInTheDocument();
  });

  it("asks to retry when the server can't be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    render(<ForgotPasswordForm />);

    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the server");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
  });

  it("asks to retry on a server error", async () => {
    mockFetch(500, { detail: "boom" });
    render(<ForgotPasswordForm />);

    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });
});
