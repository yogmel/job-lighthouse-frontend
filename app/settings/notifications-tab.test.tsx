import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Config } from "@/lib/api/config";
import { NotificationsTab } from "./notifications-tab";

const CONFIG: Config = {
  id: "cfg1",
  user_id: "u1",
  keywords_include: ["frontend"],
  keywords_exclude: ["intern"],
  location: "Berlin",
  cron: "0 7 * * *",
  profile: "# Profile",
  profile_version: 3,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockApi(config: Config = CONFIG, put: (body: unknown) => Response = (b) => json(200, b)) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const key = `${init?.method ?? "GET"} ${String(input).replace("http://api.test", "")}`;
    if (key === "GET /config") return json(200, config);
    if (key === "GET /account") return json(200, { id: "u1", email: "mel@example.com" });
    if (key === "PUT /config") return put(JSON.parse(String(init?.body)));
    throw new Error(`Unexpected request: ${key}`);
  });
}

describe("NotificationsTab", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows defaults, the account email and no Notion control", async () => {
    mockApi();
    render(<NotificationsTab />);

    expect(await screen.findByRole("switch", { name: "Email digest" })).toBeChecked();
    expect(screen.getByText("mel@example.com")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /company returns nothing/ })).toBeChecked();
    expect(screen.getByLabelText("Only include jobs scoring above")).toHaveValue("40");
    expect(screen.queryByText(/notion/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("saves changed preferences and keeps the other config fields", async () => {
    const put = vi.fn((body: unknown) => json(200, { ...CONFIG, ...(body as object) }));
    mockApi(CONFIG, put);
    const user = userEvent.setup();
    render(<NotificationsTab />);

    await user.click(await screen.findByRole("switch", { name: "Email digest" }));
    const min = screen.getByLabelText("Only include jobs scoring above");
    await user.clear(min);
    await user.type(min, "60");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Notification settings saved.");
    expect(put).toHaveBeenCalledWith({
      keywords_include: ["frontend"],
      keywords_exclude: ["intern"],
      location: "Berlin",
      cron: "0 7 * * *",
      profile: "# Profile",
      notify_email: false,
      notify_empty_company: true,
      notify_min_score: 60,
    });
  });

  it("rejects an out-of-range score without calling the API", async () => {
    const put = vi.fn((b: unknown) => json(200, b));
    mockApi(CONFIG, put);
    const user = userEvent.setup();
    render(<NotificationsTab />);

    const min = await screen.findByLabelText("Only include jobs scoring above");
    await user.clear(min);
    await user.type(min, "150");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter a whole number from 0 to 100.")).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });
});
