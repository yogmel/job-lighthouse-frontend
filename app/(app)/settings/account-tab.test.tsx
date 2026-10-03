import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/lib/api/account";
import { hardRedirect } from "@/lib/navigation";
import { getToken, setToken } from "@/lib/session";
import { AccountTab } from "./account-tab";

vi.mock("@/lib/navigation", () => ({ hardRedirect: vi.fn() }));

const TOKEN = "header.eyJ1c2VyX2lkIjoidTEiLCJleHAiOjQxMDI0NDQ4MDB9.sig";

const ACCOUNT: Account = {
  id: "u1",
  email: "mel@example.com",
  email_verified: true,
  has_password: true,
  google_linked: true,
  created_at: "2026-01-01T00:00:00Z",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Answers `GET /account` with `account`, and other calls from `routes` by "METHOD /path". */
function mockApi(account: Account, routes: Record<string, (body: unknown) => Response> = {}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const key = `${init?.method ?? "GET"} ${String(input).replace("http://api.test", "")}`;
    if (key === "GET /account") return json(200, account);
    const route = routes[key];
    if (!route) throw new Error(`Unexpected request: ${key}`);
    return route(init?.body ? JSON.parse(String(init.body)) : undefined);
  });
}

function calls(spy: ReturnType<typeof mockApi>, key: string) {
  return spy.mock.calls.filter(
    ([input, init]) => `${init?.method ?? "GET"} ${String(input).replace("http://api.test", "")}` === key,
  );
}

describe("AccountTab", () => {
  beforeEach(() => {
    setToken(TOKEN);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(hardRedirect).mockReset();
  });

  it("shows the email and how the account signs in", async () => {
    mockApi(ACCOUNT);
    render(<AccountTab />);

    expect(await screen.findByLabelText("Email")).toHaveValue("mel@example.com");
    expect(screen.getByText("Password set · Google linked")).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
  });

  describe("credentials", () => {
    it("sends only the new password with the current one", async () => {
      const put = vi.fn(() => json(200, ACCOUNT));
      const spy = mockApi(ACCOUNT, { "PUT /account": put });
      const user = userEvent.setup();
      render(<AccountTab />);

      await user.type(await screen.findByLabelText("Current password"), "old secret");
      await user.type(screen.getByLabelText("New password"), "new secret!");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByRole("status")).toHaveTextContent("Account updated.");
      expect(put).toHaveBeenCalledWith({
        current_password: "old secret",
        new_password: "new secret!",
      });
      expect(calls(spy, "PUT /account")).toHaveLength(1);
      expect(screen.getByLabelText("New password")).toHaveValue("");
    });

    it("sends a changed email and shows the saved value", async () => {
      const put = vi.fn(() => json(200, { ...ACCOUNT, email: "ada@example.com" }));
      mockApi(ACCOUNT, { "PUT /account": put });
      const user = userEvent.setup();
      render(<AccountTab />);

      const email = await screen.findByLabelText("Email");
      await user.clear(email);
      await user.type(email, "ada@example.com");
      await user.type(screen.getByLabelText("Current password"), "old secret");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByRole("status")).toHaveTextContent("Account updated.");
      expect(put).toHaveBeenCalledWith({ email: "ada@example.com", current_password: "old secret" });
      expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
    });

    it("lets a Google-only account set a first password without a current one", async () => {
      const googleOnly = { ...ACCOUNT, has_password: false };
      const put = vi.fn(() => json(200, { ...googleOnly, has_password: true }));
      mockApi(googleOnly, { "PUT /account": put });
      const user = userEvent.setup();
      render(<AccountTab />);

      expect(await screen.findByText("No password · Google linked")).toBeInTheDocument();
      expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
      await user.type(screen.getByLabelText("Set a password"), "first secret");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByRole("status")).toHaveTextContent("Account updated.");
      expect(put).toHaveBeenCalledWith({ new_password: "first secret" });
    });

    it("asks for the current password before sending", async () => {
      const spy = mockApi(ACCOUNT);
      const user = userEvent.setup();
      render(<AccountTab />);

      await user.type(await screen.findByLabelText("New password"), "new secret!");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(screen.getByText("Enter your current password.")).toBeInTheDocument();
      expect(calls(spy, "PUT /account")).toHaveLength(0);
    });

    it("shows a 403 on the current-password field and keeps the session", async () => {
      mockApi(ACCOUNT, {
        "PUT /account": () => json(403, { detail: "Current password is incorrect" }),
      });
      const user = userEvent.setup();
      render(<AccountTab />);

      await user.type(await screen.findByLabelText("Current password"), "wrong");
      await user.type(screen.getByLabelText("New password"), "new secret!");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText("Current password is incorrect")).toBeInTheDocument();
      expect(screen.getByLabelText("Current password")).toHaveAttribute("aria-invalid", "true");
      expect(getToken()).toBe(TOKEN);
      expect(hardRedirect).not.toHaveBeenCalled();
    });

    it("shows a taken email under the email field", async () => {
      mockApi(ACCOUNT, { "PUT /account": () => json(409, { detail: "Email already registered" }) });
      const user = userEvent.setup();
      render(<AccountTab />);

      const email = await screen.findByLabelText("Email");
      await user.clear(email);
      await user.type(email, "taken@example.com");
      await user.type(screen.getByLabelText("Current password"), "old secret");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText("Email already registered")).toBeInTheDocument();
      expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("downloads the export as a JSON file", async () => {
    const exported = { companies: [{ id: "c1" }], jobs: [] };
    mockApi(ACCOUNT, { "GET /account/export": () => json(200, exported) });
    // jsdom has no object URLs.
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:export");
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<AccountTab />);

    await user.click(await screen.findByRole("button", { name: "Export" }));

    await vi.waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toMatch(/^job-lighthouse-export-\d{4}-\d{2}-\d{2}\.json$/);
    expect(link.href).toBe("blob:export");
    const blob = createObjectURL.mock.calls[0][0];
    expect(JSON.parse(await blob.text())).toEqual(exported);
  });

  it("shows an alert when the export fails", async () => {
    mockApi(ACCOUNT, { "GET /account/export": () => json(500, { detail: "boom" }) });
    const user = userEvent.setup();
    render(<AccountTab />);

    await user.click(await screen.findByRole("button", { name: "Export" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });

  describe("delete account", () => {
    it("sends nothing until the deletion is confirmed", async () => {
      const spy = mockApi(ACCOUNT, { "DELETE /account": () => new Response(null, { status: 204 }) });
      const user = userEvent.setup();
      render(<AccountTab />);

      await user.click(await screen.findByRole("button", { name: "Delete" }));

      const dialog = screen.getByRole("dialog", { name: "Delete your account?" });
      const confirm = within(dialog).getByRole("button", { name: "Delete account" });
      expect(confirm).toBeDisabled();
      await user.type(within(dialog).getByLabelText(/to confirm/), "mel@example.co");
      expect(confirm).toBeDisabled();
      await user.click(confirm);
      expect(calls(spy, "DELETE /account")).toHaveLength(0);

      await user.type(within(dialog).getByLabelText(/to confirm/), "m");
      expect(confirm).toBeEnabled();
      await user.click(confirm);

      await vi.waitFor(() => expect(hardRedirect).toHaveBeenCalledWith("/signup"));
      expect(calls(spy, "DELETE /account")).toHaveLength(1);
      expect(getToken()).toBeNull();
    });

    it("sends nothing when cancelled", async () => {
      const spy = mockApi(ACCOUNT);
      const user = userEvent.setup();
      render(<AccountTab />);

      await user.click(await screen.findByRole("button", { name: "Delete" }));
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(calls(spy, "DELETE /account")).toHaveLength(0);
      expect(getToken()).toBe(TOKEN);
    });

    it("keeps the dialog open with the error when deletion fails", async () => {
      mockApi(ACCOUNT, { "DELETE /account": () => json(500, { detail: "boom" }) });
      const user = userEvent.setup();
      render(<AccountTab />);

      await user.click(await screen.findByRole("button", { name: "Delete" }));
      const dialog = screen.getByRole("dialog");
      await user.type(within(dialog).getByLabelText(/to confirm/), "mel@example.com");
      await user.click(within(dialog).getByRole("button", { name: "Delete account" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Something went wrong");
      expect(hardRedirect).not.toHaveBeenCalled();
      expect(getToken()).toBe(TOKEN);
    });
  });

  it("logs out", async () => {
    mockApi(ACCOUNT);
    const user = userEvent.setup();
    render(<AccountTab />);

    await user.click(await screen.findByRole("button", { name: "Log out" }));

    expect(getToken()).toBeNull();
    expect(hardRedirect).toHaveBeenCalledWith("/login");
  });
});
