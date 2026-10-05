import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Company } from "@/lib/api/companies";
import type { Job } from "@/lib/api/jobs";
import type { Run } from "@/lib/api/runs";
import { RunProvider, useRuns } from "../run-context";
import { JobsScreen } from "./jobs-screen";

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
  ...HALDEN,
  id: "c2",
  name: "Northstar",
  tier: 3,
  website_url: "https://northstar.example",
  source: { kind: "board", board: "lever", board_id: "northstar" },
};

function job(overrides: Partial<Job>): Job {
  return {
    id: "j1",
    user_id: "u1",
    title: "Frontend Engineer",
    url: "https://halden.example/jobs/1",
    location: "Berlin",
    description: "",
    company_id: HALDEN.id,
    company: HALDEN.name,
    match_score: 0,
    match_description: "",
    profile_version: 0,
    date: "2026-09-20T12:00:00Z",
    notified_at: null,
    active: true,
    ...overrides,
  };
}

const FRONTEND = job({});
const PLATFORM = job({
  id: "j2",
  title: "Platform Engineer",
  url: "https://northstar.example/jobs/2",
  company_id: NORTHSTAR.id,
  company: NORTHSTAR.name,
});
const CLOSED = job({ id: "j3", title: "Data Engineer", url: "https://halden.example/jobs/3", active: false });

const RUN: Run = {
  id: "r1",
  user_id: "u1",
  started_at: "2026-09-30T12:00:00Z",
  finished_at: null,
  status: "running",
  trigger: "manual",
  jobs_found: 0,
  error: null,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Answers calls by "METHOD /path"; `GET /jobs` may return a new list per call. */
function mockApi(
  jobs: Job[] | (() => Job[]),
  companies: Company[],
  routes: Record<string, () => Response> = {},
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = String(input).replace("http://api.test", "");
    const key = `${init?.method ?? "GET"} ${path}`;
    if (key === "GET /jobs") return json(200, typeof jobs === "function" ? jobs() : jobs);
    if (key === "GET /companies") return json(200, companies);
    const route = routes[key];
    if (!route) throw new Error(`Unexpected request: ${key}`);
    return route();
  });
}

/** Serves `GET /jobs` pages by cursor ("" = first page); `next` becomes `X-Next-Cursor`. */
function mockPages(pages: Record<string, { jobs: Job[]; next?: string }>, companies: Company[]) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/companies") return json(200, companies);
    const page = pages[url.searchParams.get("cursor") ?? ""];
    if (url.pathname !== "/jobs" || !page) throw new Error(`Unexpected request: ${input}`);
    return new Response(JSON.stringify(page.jobs), {
      status: 200,
      headers: { "Content-Type": "application/json", ...(page.next && { "X-Next-Cursor": page.next }) },
    });
  });
}

function jobRequests(spy: ReturnType<typeof mockApi>): string[] {
  return spy.mock.calls
    .map(([input]) => String(input).replace("http://api.test", ""))
    .filter((path) => path.startsWith("/jobs"));
}

function calls(spy: ReturnType<typeof mockApi>, key: string): number {
  return spy.mock.calls.filter(
    ([input, init]) => `${init?.method ?? "GET"} ${String(input).replace("http://api.test", "")}` === key,
  ).length;
}

describe("JobsScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists open jobs grouped by company tier, hiding closed ones by default", async () => {
    mockApi([FRONTEND, PLATFORM, CLOSED], [HALDEN, NORTHSTAR]);
    render(<JobsScreen />);

    const tier1 = await screen.findByRole("region", { name: "Tier 1" });
    const link = within(tier1).getByRole("link", { name: "Frontend Engineer" });
    expect(link).toHaveAttribute("href", "https://halden.example/jobs/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(within(tier1).getByText("Halden · Berlin")).toBeInTheDocument();
    expect(within(tier1).getByText("20 Sept")).toBeInTheDocument();

    const tier3 = screen.getByRole("region", { name: "Tier 3" });
    expect(within(tier3).getByText("Platform Engineer")).toBeInTheDocument();

    expect(screen.queryByText("Data Engineer")).not.toBeInTheDocument();
    expect(screen.getByText("2 open")).toBeInTheDocument();
  });

  it("shows closed jobs when the status filter allows them", async () => {
    mockApi([FRONTEND, CLOSED], [HALDEN]);
    const user = userEvent.setup();
    render(<JobsScreen />);

    await user.selectOptions(await screen.findByLabelText("Status"), "closed");

    const row = screen.getByText("Data Engineer").closest("li")!;
    expect(within(row).getByText("Closed")).toBeInTheDocument();
    expect(screen.queryByText("Frontend Engineer")).not.toBeInTheDocument();
  });

  it("filters by company id", async () => {
    mockApi([FRONTEND, PLATFORM], [HALDEN, NORTHSTAR]);
    const user = userEvent.setup();
    render(<JobsScreen />);

    await user.selectOptions(await screen.findByLabelText("Company"), "Northstar");

    expect(screen.getByText("Platform Engineer")).toBeInTheDocument();
    expect(screen.queryByText("Frontend Engineer")).not.toBeInTheDocument();
  });

  it("filters by tier, resolved through the job's current company", async () => {
    // Northstar was moved to Tier 1 after its job was scraped.
    mockApi([FRONTEND, PLATFORM], [HALDEN, { ...NORTHSTAR, tier: 1, name: "Northstar AI" }]);
    const user = userEvent.setup();
    render(<JobsScreen />);

    await user.selectOptions(await screen.findByLabelText("Tier"), "Tier 1");

    const tier1 = screen.getByRole("region", { name: "Tier 1" });
    expect(within(tier1).getByText("Frontend Engineer")).toBeInTheDocument();
    expect(within(tier1).getByText("Platform Engineer")).toBeInTheDocument();
    expect(within(tier1).getByText("Northstar AI · Berlin")).toBeInTheDocument();
  });

  it("shows an empty state when no jobs match, and clears the filters", async () => {
    mockApi([FRONTEND, PLATFORM], [HALDEN, NORTHSTAR]);
    const user = userEvent.setup();
    render(<JobsScreen />);

    await user.selectOptions(await screen.findByLabelText("Status"), "closed");

    expect(screen.getByText("No jobs match these filters")).toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toHaveValue("active");
  });

  it("offers closed jobs when none are open under the default filters", async () => {
    mockApi([CLOSED], [HALDEN]);
    const user = userEvent.setup();
    render(<JobsScreen />);

    await user.click(await screen.findByRole("button", { name: "Show closed jobs" }));

    expect(screen.getByText("Data Engineer")).toBeInTheDocument();
  });

  it("shows a first-run empty state when there are no jobs at all", async () => {
    mockApi([], [HALDEN]);
    render(<JobsScreen />);

    expect(await screen.findByText("No jobs yet")).toBeInTheDocument();
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
  });

  it("does not link out to non-http job URLs", async () => {
    mockApi([job({ url: "javascript:alert(1)" })], [HALDEN]);
    render(<JobsScreen />);

    expect(await screen.findByText("Frontend Engineer")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows an alert when jobs can't be loaded", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    render(<JobsScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/can't reach the server/i);
  });
});

describe("JobsScreen · paging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the next page with the cursor and appends it", async () => {
    const spy = mockPages({ "": { jobs: [FRONTEND], next: "c1" }, c1: { jobs: [PLATFORM] } }, [
      HALDEN,
      NORTHSTAR,
    ]);
    const user = userEvent.setup();
    render(<JobsScreen />);

    await user.click(await screen.findByRole("button", { name: "Load more" }));

    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();
    expect(jobRequests(spy)).toEqual(["/jobs", "/jobs?cursor=c1"]);
  });

  it("stops offering more once the header is absent", async () => {
    const spy = mockPages({ "": { jobs: [FRONTEND], next: "c1" }, c1: { jobs: [PLATFORM] } }, [
      HALDEN,
      NORTHSTAR,
    ]);
    const user = userEvent.setup();
    render(<JobsScreen />);

    await user.click(await screen.findByRole("button", { name: "Load more" }));
    await screen.findByText("Platform Engineer");

    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
    expect(jobRequests(spy)).toHaveLength(2);
  });

  it("has no Load more on a single page", async () => {
    mockPages({ "": { jobs: [FRONTEND] } }, [HALDEN]);
    render(<JobsScreen />);

    expect(await screen.findByText("Frontend Engineer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("doesn't show a job twice when pages overlap", async () => {
    mockPages({ "": { jobs: [FRONTEND], next: "c1" }, c1: { jobs: [FRONTEND, PLATFORM] } }, [
      HALDEN,
      NORTHSTAR,
    ]);
    const user = userEvent.setup();
    render(<JobsScreen />);

    await user.click(await screen.findByRole("button", { name: "Load more" }));

    await screen.findByText("Platform Engineer");
    expect(screen.getAllByText("Frontend Engineer")).toHaveLength(1);
  });

  it("keeps loaded jobs and the button when a page fails, so it can be retried", async () => {
    let fail = true;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/companies") return json(200, [HALDEN, NORTHSTAR]);
      if (!url.searchParams.has("cursor")) {
        return new Response(JSON.stringify([FRONTEND]), {
          status: 200,
          headers: { "Content-Type": "application/json", "X-Next-Cursor": "c1" },
        });
      }
      if (fail) throw new TypeError("Failed to fetch");
      return json(200, [PLATFORM]);
    });
    const user = userEvent.setup();
    render(<JobsScreen />);

    await user.click(await screen.findByRole("button", { name: "Load more" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/can't reach the server/i);
    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();

    fail = false;
    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the loaded pages and cursor when filters change", async () => {
    const spy = mockPages({ "": { jobs: [FRONTEND], next: "c1" }, c1: { jobs: [PLATFORM] } }, [
      HALDEN,
      NORTHSTAR,
    ]);
    const user = userEvent.setup();
    render(<JobsScreen />);
    await screen.findByText("Frontend Engineer");

    await user.selectOptions(screen.getByLabelText("Company"), "Northstar");
    expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
    expect(jobRequests(spy)).toEqual(["/jobs", "/jobs?cursor=c1"]);
  });
});

describe("JobsScreen · runs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Stands in for the header's Run now. */
  function TriggerButton() {
    const { trigger } = useRuns();
    return (
      <button type="button" onClick={() => trigger().catch(() => {})}>
        Trigger
      </button>
    );
  }

  it("has no Run now of its own (the header has it)", async () => {
    mockApi([FRONTEND], [HALDEN]);
    render(<JobsScreen />);

    expect(await screen.findByText("Frontend Engineer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run now" })).not.toBeInTheDocument();
  });

  it("reloads jobs when a run started elsewhere finished synchronously", async () => {
    let jobs = [FRONTEND];
    const spy = mockApi(() => jobs, [HALDEN, NORTHSTAR], {
      "POST /runs": () => {
        jobs = [FRONTEND, PLATFORM];
        return json(200, { ...RUN, status: "success", jobs_found: 1 });
      },
    });
    const user = userEvent.setup();
    render(
      <RunProvider>
        <TriggerButton />
        <JobsScreen />
      </RunProvider>,
    );
    expect(await screen.findByText("Frontend Engineer")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Trigger" }));

    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
    expect(calls(spy, "GET /jobs")).toBe(2);
  });

  it("starts over from the first page when a finished run reloads the list", async () => {
    const NEWEST = job({ id: "j4", title: "Newest Role", url: "https://halden.example/jobs/4" });
    let ran = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/companies") return json(200, [HALDEN, NORTHSTAR]);
      if (url.pathname === "/runs") {
        ran = true;
        return json(200, { ...RUN, status: "success", jobs_found: 1 });
      }
      const cursor = url.searchParams.get("cursor");
      if (cursor) return json(200, [PLATFORM]);
      return new Response(JSON.stringify(ran ? [NEWEST, FRONTEND] : [FRONTEND]), {
        status: 200,
        headers: { "Content-Type": "application/json", "X-Next-Cursor": "c1" },
      });
    });
    const user = userEvent.setup();
    render(
      <RunProvider>
        <TriggerButton />
        <JobsScreen />
      </RunProvider>,
    );
    await user.click(await screen.findByRole("button", { name: "Load more" }));
    await screen.findByText("Platform Engineer");

    await user.click(screen.getByRole("button", { name: "Trigger" }));

    expect(await screen.findByText("Newest Role")).toBeInTheDocument();
    expect(screen.queryByText("Platform Engineer")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument();
  });

  it("doesn't reload jobs for a run that's still going", async () => {
    const spy = mockApi([FRONTEND], [HALDEN], { "POST /runs": () => json(202, RUN) });
    const user = userEvent.setup();
    render(
      <RunProvider>
        <TriggerButton />
        <JobsScreen />
      </RunProvider>,
    );
    expect(await screen.findByText("Frontend Engineer")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Trigger" }));

    await vi.waitFor(() => expect(calls(spy, "POST /runs")).toBe(1));
    expect(calls(spy, "GET /jobs")).toBe(1);
  });
});
