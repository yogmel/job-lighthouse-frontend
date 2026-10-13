import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Config } from "@/lib/api/config";
import { ProfileTab } from "./profile-tab";

const CONFIG: Config = {
  id: "cfg1",
  user_id: "u1",
  keywords_include: ["frontend"],
  keywords_exclude: ["intern"],
  location: "Berlin",
  cron: "0 7 * * *",
  profile: "# Profile\nFrontend engineer.",
  profile_version: 3,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Answers `GET /config` with CONFIG and `PUT /config` with `put`. */
function mockApi(put: (body: unknown) => Response = (body) => json(200, body)) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const key = `${init?.method ?? "GET"} ${String(input).replace("http://api.test", "")}`;
    if (key === "GET /config") return json(200, CONFIG);
    if (key === "PUT /config") return put(JSON.parse(String(init?.body)));
    throw new Error(`Unexpected request: ${key}`);
  });
}

describe("ProfileTab", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the current profile into the editor", async () => {
    mockApi();
    render(<ProfileTab />);

    expect(await screen.findByLabelText("Profile markdown")).toHaveValue(CONFIG.profile);
    expect(screen.getByText("Version 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("saves the edited profile, keeps the other config fields and shows the next-run note", async () => {
    const put = vi.fn((body: unknown) =>
      json(200, { ...CONFIG, ...(body as object), profile_version: 4 }),
    );
    mockApi(put);
    const user = userEvent.setup();
    render(<ProfileTab />);

    const editor = await screen.findByLabelText("Profile markdown");
    await user.clear(editor);
    await user.type(editor, "# Profile{enter}Design engineer.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "It applies to the next run; already-scored jobs keep their score.",
    );
    expect(put).toHaveBeenCalledWith({
      keywords_include: ["frontend"],
      keywords_exclude: ["intern"],
      location: "Berlin",
      cron: "0 7 * * *",
      profile: "# Profile\nDesign engineer.",
    });
    expect(screen.getByText("Version 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("offers no rescore action", async () => {
    mockApi();
    render(<ProfileTab />);

    await screen.findByLabelText("Profile markdown");
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Save"]);
  });

  it("shows a validation error on the field and keeps the draft", async () => {
    mockApi(() =>
      json(422, { detail: [{ loc: ["body", "profile"], msg: "Profile is too long" }] }),
    );
    const user = userEvent.setup();
    render(<ProfileTab />);

    const editor = await screen.findByLabelText("Profile markdown");
    await user.type(editor, " More.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Profile is too long")).toBeInTheDocument();
    expect(editor).toHaveAttribute("aria-invalid", "true");
    expect(editor).toHaveValue(`${CONFIG.profile} More.`);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a form error when saving fails", async () => {
    mockApi(() => json(500, { detail: "boom" }));
    const user = userEvent.setup();
    render(<ProfileTab />);

    await user.type(await screen.findByLabelText("Profile markdown"), "!");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("has Write / Preview tabs with Write selected", async () => {
    mockApi();
    render(<ProfileTab />);

    await screen.findByLabelText("Profile markdown");
    expect(screen.getByRole("tablist", { name: "Profile editor" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Write" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Preview" })).toHaveAttribute("aria-selected", "false");
  });

  it("previews the unsaved draft as markdown", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<ProfileTab />);

    const editor = await screen.findByLabelText("Profile markdown");
    await user.clear(editor);
    await user.type(editor, "# Draft heading{enter}{enter}- remote only");
    await user.click(screen.getByRole("tab", { name: "Preview" }));

    const panel = screen.getByRole("tabpanel", { name: "Preview" });
    expect(within(panel).getByRole("heading", { level: 1, name: "Draft heading" })).toBeInTheDocument();
    expect(within(panel).getByRole("listitem")).toHaveTextContent("remote only");
    expect(screen.queryByLabelText("Profile markdown")).not.toBeInTheDocument();

    // Back on Write, the draft is still there.
    await user.click(screen.getByRole("tab", { name: "Write" }));
    expect(screen.getByLabelText("Profile markdown")).toHaveValue("# Draft heading\n\n- remote only");
  });

  it("does not render raw HTML in the preview", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<ProfileTab />);

    const editor = await screen.findByLabelText("Profile markdown");
    await user.clear(editor);
    await user.type(editor, '<b>bold</b> <img src="x" onerror="alert(1)">');
    await user.click(screen.getByRole("tab", { name: "Preview" }));

    const panel = screen.getByRole("tabpanel", { name: "Preview" });
    expect(panel.querySelector("b, img")).toBeNull();
  });

  it("keeps the next-run note on Preview", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<ProfileTab />);

    await screen.findByLabelText("Profile markdown");
    await user.click(screen.getByRole("tab", { name: "Preview" }));

    expect(screen.getByText(/Jobs\s+already scored keep their score/)).toBeInTheDocument();
  });

  it("moves between tabs with the arrow keys", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<ProfileTab />);

    await screen.findByLabelText("Profile markdown");
    await user.click(screen.getByRole("tab", { name: "Write" }));
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Preview" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Preview" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows an error when the profile can't be loaded", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(500, { detail: "boom" }));
    render(<ProfileTab />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });
});
