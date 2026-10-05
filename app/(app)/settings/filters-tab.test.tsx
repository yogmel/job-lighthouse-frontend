import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Config } from "@/lib/api/config";
import { FiltersTab, parseKeywords } from "./filters-tab";

const CONFIG: Config = {
  id: "cfg1",
  user_id: "u1",
  keywords_include: ["frontend", "react"],
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

function mockApi(put: (body: unknown) => Response = (body) => json(200, body)) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const key = `${init?.method ?? "GET"} ${String(input).replace("http://api.test", "")}`;
    if (key === "GET /config") return json(200, CONFIG);
    if (key === "PUT /config") return put(JSON.parse(String(init?.body)));
    throw new Error(`Unexpected request: ${key}`);
  });
}

describe("parseKeywords", () => {
  it("splits on commas, trims and drops blanks and duplicates", () => {
    expect(parseKeywords(" a, b ,, a ,c ")).toEqual(["a", "b", "c"]);
    expect(parseKeywords("")).toEqual([]);
  });
});

describe("FiltersTab", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads include, exclude and location", async () => {
    mockApi();
    render(<FiltersTab />);

    expect(await screen.findByLabelText("Keywords to include")).toHaveValue("frontend, react");
    expect(screen.getByLabelText("Keywords to exclude")).toHaveValue("intern");
    expect(screen.getByLabelText("Location")).toHaveValue("Berlin");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("saves the edited filters, keeps the other config fields and shows the next-run note", async () => {
    const put = vi.fn((body: unknown) => json(200, { ...CONFIG, ...(body as object) }));
    mockApi(put);
    const user = userEvent.setup();
    render(<FiltersTab />);

    const exclude = await screen.findByLabelText("Keywords to exclude");
    await user.clear(exclude);
    await user.type(exclude, "intern, junior");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("apply to the next run");
    expect(put).toHaveBeenCalledWith({
      keywords_include: ["frontend", "react"],
      keywords_exclude: ["intern", "junior"],
      location: "Berlin",
      cron: "0 7 * * *",
      profile: "# Profile",
    });
  });

  it("shows a validation error on the field", async () => {
    mockApi(() =>
      json(422, { detail: [{ loc: ["body", "location"], msg: "Location is too long" }] }),
    );
    const user = userEvent.setup();
    render(<FiltersTab />);

    await user.type(await screen.findByLabelText("Location"), "x");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Location is too long")).toBeInTheDocument();
    expect(screen.getByLabelText("Location")).toHaveAttribute("aria-invalid", "true");
  });
});
