import { render, screen } from "@testing-library/react";
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

  it("shows an error when the profile can't be loaded", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(500, { detail: "boom" }));
    render(<ProfileTab />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });
});
