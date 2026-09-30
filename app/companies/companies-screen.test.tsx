import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Company } from "@/lib/api/companies";
import { CompaniesScreen } from "./companies-screen";

const HALDEN: Company = {
  id: "c1",
  user_id: "u1",
  name: "Halden",
  tier: 1,
  added_at: "2026-03-28T12:00:00Z",
  website_url: "https://halden.example",
  active: true,
  source: { kind: "board", board: "ashby", board_id: "halden" },
};

const NORTHSTAR: Company = {
  id: "c2",
  user_id: "u1",
  name: "Northstar",
  tier: 3,
  added_at: "2026-04-08T12:00:00Z",
  website_url: "https://northstar.example",
  active: false,
  source: {
    kind: "scraper",
    strategy: "static",
    selectors: { careers_url: "https://northstar.example/jobs", job: ".job", title: "h3", link: "a" },
  },
};

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Answers `GET /companies` with `list`, and other calls from `routes` by "METHOD /path". */
function mockApi(list: Company[], routes: Record<string, () => Response> = {}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = String(input).replace("http://api.test", "");
    const key = `${init?.method ?? "GET"} ${path}`;
    if (key === "GET /companies") return json(200, list);
    const route = routes[key];
    if (!route) throw new Error(`Unexpected request: ${key}`);
    return route();
  });
}

function sentBody(spy: ReturnType<typeof mockApi>, key: string): unknown {
  const call = spy.mock.calls.find(
    ([input, init]) => `${init?.method ?? "GET"} ${String(input).replace("http://api.test", "")}` === key,
  );
  return call ? JSON.parse(String(call[1]?.body)) : undefined;
}

describe("CompaniesScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists companies with tier, source, added date and state", async () => {
    const spy = mockFetch(200, [HALDEN, NORTHSTAR]);
    render(<CompaniesScreen />);

    const halden = (await screen.findByText("Halden")).closest("tr")!;
    expect(within(halden).getByText("Tier 1")).toBeInTheDocument();
    expect(within(halden).getByText("ashby")).toBeInTheDocument();
    expect(within(halden).getByText("28 Mar")).toBeInTheDocument();
    expect(within(halden).getByText("Active")).toBeInTheDocument();

    const northstar = screen.getByText("Northstar").closest("tr")!;
    expect(within(northstar).getByText("Tier 3")).toBeInTheDocument();
    expect(within(northstar).getByText("scraper")).toBeInTheDocument();
    expect(within(northstar).getByText("Paused")).toBeInTheDocument();

    expect(screen.getByText("1 watched · 1 paused")).toBeInTheDocument();
    expect(spy.mock.calls[0][0]).toBe("http://api.test/companies");
  });

  it("shows an empty state when there are no companies", async () => {
    mockFetch(200, []);
    render(<CompaniesScreen />);

    expect(await screen.findByText("No companies yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an alert when the list can't be loaded", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    render(<CompaniesScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/can't reach the server/i);
  });
});

describe("CompaniesScreen · add company", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts a board-backed company and shows the new row", async () => {
    const created: Company = { ...HALDEN, id: "c9", name: "Acme", tier: 2, source: { kind: "board", board: "greenhouse", board_id: "acme" } };
    const spy = mockApi([HALDEN], { "POST /companies": () => json(201, created) });
    const user = userEvent.setup();
    render(<CompaniesScreen />);

    await user.click(await screen.findByRole("button", { name: "+ Add company" }));
    const dialog = screen.getByRole("dialog", { name: "Add company" });
    await user.type(within(dialog).getByLabelText("Name"), "Acme");
    await user.type(within(dialog).getByLabelText("Website"), "https://acme.example");
    await user.click(within(dialog).getByLabelText("Tier 2"));
    await user.selectOptions(within(dialog).getByLabelText("Board"), "greenhouse");
    await user.type(within(dialog).getByLabelText("Board id"), "acme");
    await user.click(within(dialog).getByRole("button", { name: "Add company" }));

    const row = (await screen.findByText("Acme")).closest("tr")!;
    expect(within(row).getByText("greenhouse")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Acme added.");
    expect(sentBody(spy, "POST /companies")).toEqual({
      name: "Acme",
      tier: 2,
      website_url: "https://acme.example",
      source: { kind: "board", board: "greenhouse", board_id: "acme" },
    });
  });

  it("posts a scraper source with its selectors", async () => {
    const spy = mockApi([], { "POST /companies": () => json(201, NORTHSTAR) });
    const user = userEvent.setup();
    render(<CompaniesScreen />);

    await user.click(await screen.findByRole("button", { name: "+ Add company" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "Northstar");
    await user.type(within(dialog).getByLabelText("Website"), "https://northstar.example");
    await user.click(within(dialog).getByLabelText("Tier 3"));
    await user.click(within(dialog).getByLabelText("Scraper"));
    expect(within(dialog).queryByLabelText("Board id")).not.toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText("Strategy"), "dynamic");
    await user.type(within(dialog).getByLabelText("Careers URL"), "https://northstar.example/jobs");
    await user.type(within(dialog).getByLabelText("Job card selector"), ".job");
    await user.type(within(dialog).getByLabelText("Title selector"), "h3");
    await user.type(within(dialog).getByLabelText("Link selector"), "a");
    await user.click(within(dialog).getByRole("button", { name: "Add company" }));

    expect(await screen.findByText("Northstar")).toBeInTheDocument();
    expect(sentBody(spy, "POST /companies")).toEqual({
      name: "Northstar",
      tier: 3,
      website_url: "https://northstar.example",
      source: {
        kind: "scraper",
        strategy: "dynamic",
        selectors: { careers_url: "https://northstar.example/jobs", job: ".job", title: "h3", link: "a" },
      },
    });
  });

  it("shows a nested validation error under its field and keeps the input", async () => {
    mockApi([], {
      "POST /companies": () =>
        json(422, { detail: [{ loc: ["body", "source", "board", "board_id"], msg: "Field required" }] }),
    });
    const user = userEvent.setup();
    render(<CompaniesScreen />);

    await user.click(await screen.findByRole("button", { name: "+ Add company" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "Acme");
    await user.type(within(dialog).getByLabelText("Website"), "https://acme.example");
    await user.type(within(dialog).getByLabelText("Board id"), " ");
    await user.click(within(dialog).getByRole("button", { name: "Add company" }));

    expect(await within(dialog).findByText("Field required")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Board id")).toHaveAttribute("aria-invalid", "true");
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Acme");
    expect(screen.queryByRole("row", { name: /Acme/ })).not.toBeInTheDocument();
  });
});

describe("CompaniesScreen · edit company", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function openEdit(name: string) {
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: `Actions for ${name}` }));
    await user.click(screen.getByRole("menuitem", { name: "Edit company" }));
    return { user, dialog: screen.getByRole("dialog", { name: `Edit ${name}` }) };
  }

  it("prefills the dialog from the row", async () => {
    mockApi([HALDEN, NORTHSTAR]);
    render(<CompaniesScreen />);

    const { dialog } = await openEdit("Halden");
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Halden");
    expect(within(dialog).getByLabelText("Website")).toHaveValue("https://halden.example");
    expect(within(dialog).getByLabelText("Tier 1")).toBeChecked();
    expect(within(dialog).getByLabelText("Board")).toHaveValue("ashby");
    expect(within(dialog).getByLabelText("Board id")).toHaveValue("halden");
  });

  it("prefills scraper selectors", async () => {
    mockApi([NORTHSTAR]);
    render(<CompaniesScreen />);

    const { dialog } = await openEdit("Northstar");
    expect(within(dialog).getByLabelText("Scraper")).toBeChecked();
    expect(within(dialog).getByLabelText("Careers URL")).toHaveValue("https://northstar.example/jobs");
    expect(within(dialog).getByLabelText("Job card selector")).toHaveValue(".job");
  });

  it("shows the re-group note only while the tier differs", async () => {
    mockApi([HALDEN]);
    render(<CompaniesScreen />);

    const { user, dialog } = await openEdit("Halden");
    const note = /re-groups this company's existing jobs/;
    expect(within(dialog).queryByText(note)).not.toBeInTheDocument();

    await user.click(within(dialog).getByLabelText("Tier 2"));
    expect(within(dialog).getByText(note)).toBeInTheDocument();

    await user.click(within(dialog).getByLabelText("Tier 1"));
    expect(within(dialog).queryByText(note)).not.toBeInTheDocument();
  });

  it("puts the edited company and updates its row", async () => {
    const updated: Company = { ...HALDEN, name: "Halden AB", tier: 2 };
    const spy = mockApi([HALDEN], { "PUT /companies/c1": () => json(200, updated) });
    render(<CompaniesScreen />);

    const { user, dialog } = await openEdit("Halden");
    await user.clear(within(dialog).getByLabelText("Name"));
    await user.type(within(dialog).getByLabelText("Name"), "Halden AB");
    await user.click(within(dialog).getByLabelText("Tier 2"));
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    const row = (await screen.findByText("Halden AB")).closest("tr")!;
    expect(within(row).getByText("Tier 2")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Halden AB updated. Now Tier 2.");
    expect(sentBody(spy, "PUT /companies/c1")).toEqual({
      name: "Halden AB",
      tier: 2,
      website_url: "https://halden.example",
      source: { kind: "board", board: "ashby", board_id: "halden" },
    });
  });

  it("keeps the dialog open with the error when saving fails", async () => {
    mockApi([HALDEN], { "PUT /companies/c1": () => json(404, { detail: "Company not found" }) });
    render(<CompaniesScreen />);

    const { user, dialog } = await openEdit("Halden");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Company not found");
    expect(screen.getByText("Halden")).toBeInTheDocument();
  });
});

describe("CompaniesScreen · pause and remove", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function chooseAction(name: string, action: string) {
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: `Actions for ${name}` }));
    await user.click(screen.getByRole("menuitem", { name: action }));
    return user;
  }

  it("pauses with a partial PUT and keeps the row", async () => {
    const spy = mockApi([HALDEN], {
      "PUT /companies/c1": () => json(200, { ...HALDEN, active: false }),
    });
    render(<CompaniesScreen />);

    await chooseAction("Halden", "Pause watching");

    expect(await screen.findByRole("status")).toHaveTextContent("Halden paused.");
    const row = screen.getByText("Halden").closest("tr")!;
    expect(within(row).getByText("Paused")).toBeInTheDocument();
    expect(sentBody(spy, "PUT /companies/c1")).toEqual({ active: false });
    expect(spy.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  });

  it("resumes a paused company", async () => {
    const spy = mockApi([NORTHSTAR], {
      "PUT /companies/c2": () => json(200, { ...NORTHSTAR, active: true }),
    });
    render(<CompaniesScreen />);

    await chooseAction("Northstar", "Resume watching");

    expect(await screen.findByRole("status")).toHaveTextContent("Northstar resumed.");
    expect(within(screen.getByText("Northstar").closest("tr")!).getByText("Active")).toBeInTheDocument();
    expect(sentBody(spy, "PUT /companies/c2")).toEqual({ active: true });
  });

  it("shows an alert when pausing fails", async () => {
    mockApi([HALDEN], { "PUT /companies/c1": () => json(500, { detail: "boom" }) });
    render(<CompaniesScreen />);

    await chooseAction("Halden", "Pause watching");

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    expect(within(screen.getByText("Halden").closest("tr")!).getByText("Active")).toBeInTheDocument();
  });

  it("asks for confirmation before removing", async () => {
    const spy = mockApi([HALDEN, NORTHSTAR], {
      "DELETE /companies/c1": () => new Response(null, { status: 204 }),
    });
    render(<CompaniesScreen />);

    const user = await chooseAction("Halden", "Remove company");
    const dialog = screen.getByRole("dialog", { name: "Remove Halden?" });
    expect(spy).toHaveBeenCalledTimes(1); // only the list load

    await user.click(within(dialog).getByRole("button", { name: "Remove company" }));

    await vi.waitFor(() => expect(screen.queryByText("Halden")).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("Halden removed.");
    expect(screen.getByText("Northstar")).toBeInTheDocument();
    expect(spy.mock.calls[1][0]).toBe("http://api.test/companies/c1");
    expect(spy.mock.calls[1][1]?.method).toBe("DELETE");
  });

  it("sends nothing when removal is cancelled", async () => {
    const spy = mockApi([HALDEN]);
    render(<CompaniesScreen />);

    const user = await chooseAction("Halden", "Remove company");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Halden")).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("keeps the row and shows the error when removal fails", async () => {
    mockApi([HALDEN], { "DELETE /companies/c1": () => json(404, { detail: "Company not found" }) });
    render(<CompaniesScreen />);

    const user = await chooseAction("Halden", "Remove company");
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Remove company" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Company not found");
    expect(screen.getByText("Halden")).toBeInTheDocument();
  });
});
