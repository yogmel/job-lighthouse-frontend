import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordForm } from "./reset-password-form";

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

async function submit(password = "correct horse", confirm = password) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("New password"), password);
  await user.type(screen.getByLabelText("Confirm new password"), confirm);
  await user.click(screen.getByRole("button", { name: "Set new password" }));
}

const GENERIC = /If your reset link was valid, your password has been updated/;

describe("ResetPasswordForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the token and new password, then shows the generic message", async () => {
    const spy = mockFetch(200, { detail: "ok" });
    render(<ResetPasswordForm token="tok123" />);

    await submit();

    expect(await screen.findByRole("status")).toHaveTextContent(GENERIC);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("http://api.test/auth/password-reset/confirm");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ token: "tok123", new_password: "correct horse" });
  });

  it.each([
    [400, { detail: "Reset link is invalid or has expired" }, "Reset link is invalid or has expired"],
    [404, { detail: "Unknown token" }, "Unknown token"],
    [422, { detail: [{ loc: ["body", "token"], msg: "token already used" }] }, "token already used"],
  ])("shows the same generic message on a %i", async (status, body, detail) => {
    mockFetch(status, body);
    render(<ResetPasswordForm token="used" />);

    await submit();

    expect(await screen.findByRole("status")).toHaveTextContent(GENERIC);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(detail)).not.toBeInTheDocument();
  });

  it("checks the password length before sending", async () => {
    const spy = mockFetch(200, {});
    render(<ResetPasswordForm token="tok123" />);

    await submit("short");

    expect(await screen.findByText("Use at least 8 characters.")).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it("checks that both passwords match before sending", async () => {
    const spy = mockFetch(200, {});
    render(<ResetPasswordForm token="tok123" />);

    await submit("correct horse", "correct horsf");

    expect(await screen.findByText("Passwords don't match.")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toHaveAttribute("aria-invalid", "true");
    expect(spy).not.toHaveBeenCalled();
  });

  it("asks to retry when the server can't be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    render(<ResetPasswordForm token="tok123" />);

    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the server");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers a new link when the token is missing", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    render(<ResetPasswordForm />);

    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Send a new reset link" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(spy).not.toHaveBeenCalled();
  });
});
