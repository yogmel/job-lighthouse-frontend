import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Company } from "@/lib/api/companies";
import type { Config } from "@/lib/api/config";
import type { Run, RunCompanyResult } from "@/lib/api/runs";
import { RunsScreen } from "./runs-screen";

const NOW = new Date("2026-10-02T10:00:00Z");

const company = (id: string, name: string, source: Company["source"], active = true): Company => ({
  id,
  user_id: "u1",
  name,
  tier: 1,
  added_at: "2026-03-01T00:00:00Z",
  website_url: `https://${id}.example`,
  active,
  source,
});

const COMPANIES: Company[] = [
  company("c1", "Northwind", { kind: "board", board: "greenhouse", board_id: "northwind" }),
  company("c2", "Northstar", {
    kind: "scraper",
    strategy: "static",
    selectors: { careers_url: "https://northstar.example/jobs", job: ".job", title: "h3", link: "a" },
  }),
  company("c3", "Fernwell", { kind: "board", board: "lever", board_id: "fernwell" }),
  company("c4", "Vela", { kind: "board", board: "ashby", board_id: "vela" }, false),
];

const run = (id: string, started_at: string, patch: Partial<Run> = {}): Run => ({
  id,
  user_id: "u1",
  started_at,
  finished_at: new Date(Date.parse(started_at) + 38_000).toISOString(),
  status: "success",
  trigger: "cron",
  scope: "full",
  company_id: null,
  jobs_found: 0,
  error: null,
  ...patch,
});

const RUNS: Run[] = [
  run("r2", "2026-10-01T07:03:00Z", { jobs_found: 7 }),
  run("r3", "2026-10-02T07:04:00Z", { jobs_found: 12 }),
  run("r1", "2026-09-26T07:04:00Z", { status: "failed", error: "scorer timeout" }),
];

const result = (
  id: string,
  company_id: string,
  status: RunCompanyResult["status"],
  jobs_found: number,
  error: string | null = null,
  company_name = COMPANIES.find((c) => c.id === company_id)?.name ?? "",
  new_jobs = 0,
): RunCompanyResult => ({ id, run_id: "r3", company_id, company_name, status, jobs_found, new_jobs, error });

const LATEST_RESULTS: RunCompanyResult[] = [
  result("x4", "c4", "skipped", 0),
  result("x2", "c2", "failed", 0, "selector miss"),
  result("x1", "c1", "ok", 34, null, undefined, 11),
  result("x3", "c3", "ok", 1, null, undefined, 1),
];

const CONFIG = { cron: "0 7 * * *" } as Config;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockApi(
  runs: Run[] = RUNS,
  routes: Record<string, () => Response> = {},
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const key = `${init?.method ?? "GET"} ${String(input).replace("http://api.test", "")}`;
    if (key === "GET /runs") return json(200, runs);
    if (key === "GET /companies") return json(200, COMPANIES);
    if (key === "GET /config") return json(200, CONFIG);
    const route = routes[key];
    if (route) return route();
    if (key === "GET /runs/r3/companies") return json(200, LATEST_RESULTS);
    if (key === "GET /runs/r2/companies") {
      return json(200, [{ ...result("y1", "c1", "ok", 30), run_id: "r2" }]);
    }
    throw new Error(`Unexpected request: ${key}`);
  });
}

function breakdown() {
  return screen.getByRole("region", { name: "Per-company breakdown" });
}

function card(kicker: string) {
  return screen.getByText(kicker).parentElement!;
}

describe("RunsScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows the next run in the configured time zone", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = String(input).replace("http://api.test", "");
      if (path === "/runs") return json(200, RUNS);
      if (path === "/companies") return json(200, COMPANIES);
      if (path === "/config") return json(200, { cron: "0 7 * * *", timezone: "Asia/Kolkata" });
      return json(200, LATEST_RESULTS);
    });
    render(<RunsScreen />);

    // 07:00 in India (UTC+5:30) is 01:30Z, so after 10:00Z on 2 Oct the next one is Sat 3 Oct.
    const detail = await within(await screen.findByText("Next run").then(() => card("Next run"))).findByText(
      /^Sat 3 Oct, 07:00 /,
    );
    expect(detail).not.toHaveTextContent(/UTC$/);
  });

  it("lists the history newest first", async () => {
    mockApi();
    render(<RunsScreen />);

    const history = await screen.findByRole("region", { name: "History" });
    const rows = within(history).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual([
      "Today 07:04",
      "Yesterday 07:03",
      "Sat 07:04",
    ]);
    expect(within(rows[0]).getByText("Success")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Scheduled")).toBeInTheDocument();
    expect(within(rows[0]).getByText("12")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Failed — scorer timeout")).toBeInTheDocument();
  });

  it("shows the next run and today's totals", async () => {
    mockApi();
    render(<RunsScreen />);

    expect(await screen.findByText("3 companies per run · times in UTC")).toBeInTheDocument();
    expect(within(card("Next run")).getByText("21h")).toBeInTheDocument();
    expect(within(card("Next run")).getByText("Sat 3 Oct, 07:00 UTC")).toBeInTheDocument();
    expect(within(card("New jobs today")).getByText("12")).toBeInTheDocument();
    expect(within(card("New jobs today")).getByText("Across 1 run today")).toBeInTheDocument();
    expect(await within(card("Scraped last run")).findByText("35")).toBeInTheDocument();
    expect(within(card("Scraped last run")).getByText("From 4 companies")).toBeInTheDocument();
    // Northstar failed, Fernwell found only 1 job.
    expect(within(card("Need attention")).getByText("2")).toBeInTheDocument();
  });

  it("breaks the latest run down per company with status and job counts", async () => {
    mockApi();
    render(<RunsScreen />);

    const region = await screen.findByRole("region", { name: "Per-company breakdown" });
    const items = await within(region).findAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "Northwind · greenhouse · 11 new jobs · 34 scrapedok",
      "Northstar · scraper · 0 new jobs · 0 scraped · selector missfailed",
      "Fernwell · lever · 1 new job · 1 scraped · likely partialok",
      "Vela · ashbyskipped",
    ]);
    expect(within(region).getByText("12 new jobs")).toBeInTheDocument();
    expect(within(region).getByText("Today 07:04")).toBeInTheDocument();
    expect(within(region).getByText("38s · 4 companies")).toBeInTheDocument();
  });

  it("shows another run's breakdown when its row is picked", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<RunsScreen />);

    await user.click(await screen.findByRole("button", { name: "Yesterday 07:03" }));

    expect(within(breakdown()).getByText("Yesterday 07:03")).toBeInTheDocument();
    expect(await within(breakdown()).findByText("Northwind · greenhouse · 0 new jobs · 30 scraped")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yesterday 07:03" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("labels results for companies that were removed since", async () => {
    mockApi(RUNS, {
      "GET /runs/r3/companies": () => json(200, [result("z1", "gone", "ok", 4, null, undefined, 2)]),
    });
    render(<RunsScreen />);

    expect(await screen.findByText("Removed company · 2 new jobs · 4 scraped")).toBeInTheDocument();
  });

  it("marks Single-company runs and names the company from the breakdown", async () => {
    const single = run("r4", "2026-10-02T08:00:00Z", {
      trigger: "manual",
      scope: "company",
      company_id: "c1",
      jobs_found: 3,
    });
    mockApi([single, ...RUNS], {
      "GET /runs/r4/companies": () => json(200, [{ ...result("s1", "c1", "ok", 3), run_id: "r4" }]),
    });
    render(<RunsScreen />);

    const row = (await screen.findByRole("button", { name: "Today 08:00" })).closest("tr")!;
    expect(within(row).getByText("Single company")).toBeInTheDocument();
    expect(await within(row).findByText("Northwind")).toBeInTheDocument();
    const full = screen.getByRole("button", { name: "Today 07:04" }).closest("tr")!;
    expect(within(full).queryByText("Single company")).not.toBeInTheDocument();
  });

  it("still names a Single-company run whose company was deleted", async () => {
    const single = run("r4", "2026-10-02T08:00:00Z", {
      trigger: "manual",
      scope: "company",
      company_id: "gone",
    });
    mockApi([single, ...RUNS], {
      "GET /runs/r4/companies": () =>
        json(200, [{ ...result("s1", "gone", "ok", 2, null, "Closedco"), run_id: "r4" }]),
    });
    render(<RunsScreen />);

    const row = (await screen.findByRole("button", { name: "Today 08:00" })).closest("tr")!;
    expect(await within(row).findByText("Closedco")).toBeInTheDocument();
  });

  it("shows the breakdown error without hiding the history", async () => {
    mockApi(RUNS, { "GET /runs/r3/companies": () => json(500, { detail: "boom" }) });
    render(<RunsScreen />);

    const region = await screen.findByRole("region", { name: "Per-company breakdown" });
    expect(await within(region).findByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("region", { name: "History" })).toBeInTheDocument();
  });

  it("shows an empty state before the first run", async () => {
    mockApi([]);
    render(<RunsScreen />);

    expect(await screen.findByText("No runs yet", { selector: "h2" })).toBeInTheDocument();
    expect(within(card("Scraped last run")).getByText("—")).toBeInTheDocument();
  });

  it("shows an alert when runs can't be loaded", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(500, { detail: "boom" }));
    render(<RunsScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("starts a run and selects it", async () => {
    const started = run("r4", "2026-10-02T09:59:00Z", {
      status: "running",
      finished_at: null,
      trigger: "manual",
    });
    mockApi(RUNS, {
      "POST /runs": () => json(202, started),
      "GET /runs/r4/companies": () => json(200, []),
    });
    const user = userEvent.setup();
    render(<RunsScreen />);

    await user.click(await screen.findByRole("button", { name: "Run now" }));
    await user.click(screen.getByRole("button", { name: "Start run" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Run started.");
    const first = within(screen.getByRole("region", { name: "History" })).getAllByRole("row")[1];
    expect(within(first).getByText("Today 09:59")).toBeInTheDocument();
    expect(within(first).getByText("Running")).toBeInTheDocument();
    expect(within(first).getByText("Manual")).toBeInTheDocument();
    expect(within(breakdown()).getByText("Today 09:59")).toBeInTheDocument();
    expect(await within(breakdown()).findByText("Running · 0 companies")).toBeInTheDocument();
  });

  it("asks before a Full run and starts nothing on Cancel", async () => {
    const spy = mockApi(RUNS, { "POST /runs": () => json(202, RUNS[0]) });
    const user = userEvent.setup();
    render(<RunsScreen />);

    await user.click(await screen.findByRole("button", { name: "Run now" }));
    const dialog = screen.getByRole("dialog", { name: "Run now?" });
    expect(dialog).toHaveTextContent("every active company");

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(spy.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Run now" })).toHaveFocus();
  });

  it("says so when a run is already in progress", async () => {
    mockApi(RUNS, { "POST /runs": () => json(409, { detail: "Run in progress" }) });
    const user = userEvent.setup();
    render(<RunsScreen />);

    await user.click(await screen.findByRole("button", { name: "Run now" }));
    await user.click(screen.getByRole("button", { name: "Start run" }));

    expect(await screen.findByRole("status")).toHaveTextContent("A run is already in progress.");
  });
});

describe("RunsScreen · Need attention", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function attentionCard() {
    const button = await screen.findByRole("button", { name: /Need attention/ });
    await vi.waitFor(() => expect(button).toBeEnabled());
    return button;
  }

  it("opens an inline list of the companies that need attention, with reasons", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<RunsScreen />);

    const button = await attentionCard();
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("region", { name: "Need attention" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "NorthstarFailed — selector miss",
      "FernwellReturned 1 job",
    ]);
    expect(within(list).getByRole("link", { name: "Northstar" })).toHaveAttribute(
      "href",
      "https://c2.example",
    );
  });

  it("collapses again on a second click", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<RunsScreen />);

    const button = await attentionCard();
    await user.click(button);
    await user.click(button);

    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "Need attention" })).not.toBeInTheDocument();
  });

  it("is disabled when nothing needs attention", async () => {
    mockApi(RUNS, {
      "GET /runs/r3/companies": () => json(200, [result("x1", "c1", "ok", 34)]),
    });
    render(<RunsScreen />);

    const button = await screen.findByRole("button", { name: /Need attention/ });

    await vi.waitFor(() => expect(button).toHaveTextContent("0"));
    expect(button).toBeDisabled();
  });

  it("confirms before a Single-company run, then posts the company id", async () => {
    const spy = mockApi(RUNS, {
      "POST /runs": () => json(202, run("r5", "2026-10-02T09:59:00Z", { status: "running", finished_at: null })),
    });
    const user = userEvent.setup();
    render(<RunsScreen />);
    await user.click(await attentionCard());

    await user.click(screen.getByRole("button", { name: "Run Northstar now" }));
    const dialog = screen.getByRole("dialog", { name: "Run Northstar now?" });
    expect(spy.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: "Start run" }));

    expect(await screen.findByText("Run started for Northstar.")).toBeInTheDocument();
    const post = spy.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(post[1]?.body))).toEqual({ company_id: "c2" });
  });

  it("starts nothing when the confirm is cancelled", async () => {
    const spy = mockApi();
    const user = userEvent.setup();
    render(<RunsScreen />);
    await user.click(await attentionCard());

    await user.click(screen.getByRole("button", { name: "Run Northstar now" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    expect(spy.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("disables Run now for a paused company", async () => {
    mockApi(RUNS, {
      "GET /runs/r3/companies": () => json(200, [result("x4", "c4", "ok", 0)]),
    });
    const user = userEvent.setup();
    render(<RunsScreen />);
    await user.click(await attentionCard());

    const run = screen.getByRole("button", { name: "Run Vela now" });
    expect(run).toBeDisabled();
    expect(run).toHaveAttribute("title", "Resume this company to run it");
  });
});

