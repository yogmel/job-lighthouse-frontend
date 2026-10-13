import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Company } from "@/lib/api/companies";
import type { Job } from "@/lib/api/jobs";
import type { Run } from "@/lib/api/runs";
import { RunProvider, useRuns } from "../run-context";
import { TimeZoneProvider } from "../time-zone-context";
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
    company_active: true,
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
  scope: "full",
  company_id: null,
  jobs_found: 0,
  error: null,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** An in-memory URL standing in for the App Router. */
const nav = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    search: "",
    listeners,
    replace(url: string) {
      nav.search = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
      listeners.forEach((l) => l());
    },
  };
});

vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  const subscribe = (l: () => void) => {
    nav.listeners.add(l);
    return () => nav.listeners.delete(l);
  };
  return {
    usePathname: () => "/jobs",
    useRouter: () => ({ replace: nav.replace }),
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => nav.search)),
  };
});

beforeEach(() => {
  nav.search = "";
});

type User = ReturnType<typeof userEvent.setup>;

async function pickCompany(user: User, combobox: HTMLElement, name: string) {
  await user.click(combobox);
  await user.click(within(screen.getByRole("listbox")).getByRole("option", { name }));
}

/** What `GET /jobs` does with `company_id`, `tier` and `active`. */
function serverFilter(jobs: Job[], companies: Company[], path: string): Job[] {
  const q = new URL(path, "http://api.test").searchParams;
  return jobs.filter((j) => {
    if (q.has("company_id") && j.company_id !== q.get("company_id")) return false;
    if (q.has("tier") && String(companies.find((c) => c.id === j.company_id)?.tier) !== q.get("tier")) {
      return false;
    }
    if (q.has("active") && String(j.active) !== q.get("active")) return false;
    return true;
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
    if (path.split("?")[0] === "GET /jobs".slice(4) && !init?.method) {
      return json(200, serverFilter(typeof jobs === "function" ? jobs() : jobs, companies, path));
    }
    if (key === "GET /companies") return json(200, companies);
    const route = routes[key];
    if (!route) throw new Error(`Unexpected request: ${key}`);
    return route();
  });
}

/** Serves `GET /jobs` pages by cursor ("" = first page); `next` becomes `X-Next-Cursor`. */
function mockPages(
  pages: Record<string, { jobs: Job[]; next?: string; total?: number }>,
  companies: Company[],
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/companies") return json(200, companies);
    const page = pages[url.searchParams.get("cursor") ?? ""];
    if (url.pathname !== "/jobs" || !page) throw new Error(`Unexpected request: ${input}`);
    return new Response(JSON.stringify(page.jobs), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...(page.next && { "X-Next-Cursor": page.next }),
        ...(page.total !== undefined && { "X-Total-Count": String(page.total) }),
      },
    });
  });
}

/** Stands in for the header's Run now. */
function TriggerButton() {
  const { trigger } = useRuns();
  return (
    <button type="button" onClick={() => trigger().catch(() => {})}>
      Trigger
    </button>
  );
}

function jobRequests(spy: ReturnType<typeof mockApi>): string[] {
  return spy.mock.calls
    .map(([input]) => String(input).replace("http://api.test", ""))
    .filter((path) => path.startsWith("/jobs"));
}

/** Counts calls to "METHOD /path", ignoring the query string. */
function calls(spy: ReturnType<typeof mockApi>, key: string): number {
  return spy.mock.calls.filter(
    ([input, init]) =>
      `${init?.method ?? "GET"} ${String(input).replace("http://api.test", "").split("?")[0]}` === key,
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

  it("shows job dates in the configured time zone", async () => {
    // 23:30Z on 20 Sept is already 21 Sept in Berlin.
    mockApi([job({ date: "2026-09-20T23:30:00Z" })], [HALDEN], {
      "GET /config": () => json(200, { cron: "0 7 * * *", timezone: "Europe/Berlin" }),
    });
    render(
      <TimeZoneProvider>
        <JobsScreen />
      </TimeZoneProvider>,
    );

    expect(await screen.findByText("21 Sept")).toBeInTheDocument();
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

  it("marks jobs of a paused company without calling them closed", async () => {
    const paused = job({ id: "j4", title: "SRE", company_active: false });
    mockApi([FRONTEND, paused], [HALDEN]);
    render(<JobsScreen />);

    const row = (await screen.findByText("SRE")).closest("li")!;
    expect(within(row).getByText("Paused")).toBeInTheDocument();
    expect(within(row).queryByText("Closed")).not.toBeInTheDocument();
    const open = screen.getByText("Frontend Engineer").closest("li")!;
    expect(within(open).queryByText("Paused")).not.toBeInTheDocument();
  });

  it("filters by company id", async () => {
    mockApi([FRONTEND, PLATFORM], [HALDEN, NORTHSTAR]);
    const user = userEvent.setup();
    render(<JobsScreen />);

    await pickCompany(user, await screen.findByLabelText("Company"), "Northstar");

    expect(screen.getByText("Platform Engineer")).toBeInTheDocument();
    expect(screen.queryByText("Frontend Engineer")).not.toBeInTheDocument();
  });

  it("narrows the company list as you type, case-insensitively, anywhere in the name", async () => {
    mockApi([FRONTEND, PLATFORM], [HALDEN, NORTHSTAR]);
    const user = userEvent.setup();
    render(<JobsScreen />);

    await user.type(await screen.findByRole("combobox", { name: "Company" }), "THS");

    const options = within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["All companies", "Northstar"]);
  });

  it("keeps All companies first and selectable", async () => {
    mockApi([FRONTEND, PLATFORM], [HALDEN, NORTHSTAR]);
    const user = userEvent.setup();
    render(<JobsScreen />);
    const box = await screen.findByRole("combobox", { name: "Company" });

    await pickCompany(user, box, "Northstar");
    expect(screen.queryByText("Frontend Engineer")).not.toBeInTheDocument();
    await user.click(box);
    const all = within(screen.getByRole("listbox")).getAllByRole("option")[0];
    expect(all).toHaveTextContent("All companies");
    await user.click(all);

    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();
  });

  it("supports the keyboard: arrows move, Enter selects, Esc closes", async () => {
    mockApi([FRONTEND, PLATFORM], [HALDEN, NORTHSTAR]);
    const user = userEvent.setup();
    render(<JobsScreen />);
    const box = await screen.findByRole("combobox", { name: "Company" });

    await user.click(box);
    expect(box).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(box).toHaveAttribute("aria-activedescendant", within(screen.getByRole("listbox")).getAllByRole("option")[2].id);
    await user.keyboard("{Enter}");

    expect(box).toHaveValue("Northstar");
    expect(screen.queryByText("Frontend Engineer")).not.toBeInTheDocument();
    expect(screen.getByText("Platform Engineer")).toBeInTheDocument();
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
    nav.search = "status=all";
    mockApi([], [HALDEN]);
    render(<JobsScreen />);

    expect(await screen.findByText("No jobs yet")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toHaveValue("all");
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
    expect(jobRequests(spy)).toEqual(["/jobs?active=true", "/jobs?active=true&cursor=c1"]);
  });

  it("keeps the job list and Load more inside one scroll box", async () => {
    mockPages({ "": { jobs: [FRONTEND], next: "c1" } }, [HALDEN, NORTHSTAR]);
    render(<JobsScreen />);

    const box = await screen.findByTestId("jobs-scroll");

    expect(box).toHaveClass("overflow-y-auto");
    expect(within(box).getByText("Frontend Engineer")).toBeInTheDocument();
    expect(within(box).getByRole("button", { name: "Load more" })).toBeInTheDocument();
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

  it("starts over from the first page when filters change", async () => {
    const spy = mockPages({ "": { jobs: [FRONTEND], next: "c1" }, c1: { jobs: [PLATFORM] } }, [
      HALDEN,
      NORTHSTAR,
    ]);
    const user = userEvent.setup();
    render(<JobsScreen />);
    await user.click(await screen.findByRole("button", { name: "Load more" }));
    await screen.findByText("Platform Engineer");

    await pickCompany(user, screen.getByLabelText("Company"), "Northstar");

    await vi.waitFor(() =>
      expect(jobRequests(spy)).toEqual([
        "/jobs?active=true",
        "/jobs?active=true&cursor=c1",
        "/jobs?company_id=c2&active=true",
      ]),
    );
  });
});

describe("JobsScreen · total", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows how many jobs are loaded out of the first page's total", async () => {
    mockPages({ "": { jobs: [FRONTEND], next: "c1", total: 312 } }, [HALDEN]);
    render(<JobsScreen />);

    expect(await screen.findByText("1 of 312 jobs")).toBeInTheDocument();
  });

  it("keeps the total from the first page across Load more", async () => {
    mockPages(
      { "": { jobs: [FRONTEND], next: "c1", total: 312 }, c1: { jobs: [PLATFORM] } },
      [HALDEN, NORTHSTAR],
    );
    const user = userEvent.setup();
    render(<JobsScreen />);

    await user.click(await screen.findByRole("button", { name: "Load more" }));

    expect(await screen.findByText("2 of 312 jobs")).toBeInTheDocument();
  });

  it("refreshes the total when a finished run restarts from the first page", async () => {
    let ran = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/companies") return json(200, [HALDEN]);
      if (url.pathname === "/runs") {
        ran = true;
        return json(200, { ...RUN, status: "success", jobs_found: 1 });
      }
      return new Response(JSON.stringify([FRONTEND]), {
        status: 200,
        headers: { "Content-Type": "application/json", "X-Total-Count": ran ? "313" : "312" },
      });
    });
    const user = userEvent.setup();
    render(
      <RunProvider>
        <TriggerButton />
        <JobsScreen />
      </RunProvider>,
    );
    await screen.findByText("1 of 312 jobs");

    await user.click(screen.getByRole("button", { name: "Trigger" }));

    expect(await screen.findByText("1 of 313 jobs")).toBeInTheDocument();
  });

  it("shows the filtered total after a filter change", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/companies") return json(200, [HALDEN, NORTHSTAR]);
      const filtered = url.searchParams.has("company_id");
      return new Response(JSON.stringify(filtered ? [PLATFORM] : [FRONTEND, PLATFORM]), {
        status: 200,
        headers: { "Content-Type": "application/json", "X-Total-Count": filtered ? "1" : "2" },
      });
    });
    const user = userEvent.setup();
    render(<JobsScreen />);
    await screen.findByText("2 of 2 jobs");

    await pickCompany(user, screen.getByLabelText("Company"), "Northstar");

    expect(await screen.findByText("1 of 1 jobs")).toBeInTheDocument();
  });

  it.each([["missing", undefined], ["not a number", "lots"]])(
    "shows no total when the header is %s",
    async (_, header) => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        if (new URL(String(input)).pathname === "/companies") return json(200, [HALDEN]);
        return new Response(JSON.stringify([FRONTEND]), {
          status: 200,
          headers: { "Content-Type": "application/json", ...(header && { "X-Total-Count": header }) },
        });
      });
      render(<JobsScreen />);

      expect(await screen.findByText("Frontend Engineer")).toBeInTheDocument();
      expect(screen.getByText("1 open")).toBeInTheDocument();
      expect(screen.queryByText(/ of /)).not.toBeInTheDocument();
    },
  );
});

describe("JobsScreen · runs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

describe("JobsScreen · server-side filters", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("asks the server for open jobs by default", async () => {
    const spy = mockApi([FRONTEND], [HALDEN]);
    render(<JobsScreen />);
    await screen.findByText("Frontend Engineer");

    expect(jobRequests(spy)).toEqual(["/jobs?active=true"]);
  });

  it("sends company, tier and status as params and writes them to the URL", async () => {
    const spy = mockApi([FRONTEND, PLATFORM, CLOSED], [HALDEN, NORTHSTAR]);
    const user = userEvent.setup();
    render(<JobsScreen />);

    await user.selectOptions(await screen.findByLabelText("Status"), "closed");
    await user.selectOptions(screen.getByLabelText("Tier"), "Tier 1");
    await pickCompany(user, screen.getByLabelText("Company"), "Halden");

    expect(await screen.findByText("Data Engineer")).toBeInTheDocument();
    expect(jobRequests(spy).at(-1)).toBe("/jobs?company_id=c1&tier=1&active=false");
    expect(new URLSearchParams(nav.search).toString()).toBe("status=closed&company=c1&tier=1");
  });

  it("omits active for All and keeps the URL clean for the default view", async () => {
    const spy = mockApi([FRONTEND, CLOSED], [HALDEN]);
    const user = userEvent.setup();
    render(<JobsScreen />);

    await user.selectOptions(await screen.findByLabelText("Status"), "all");
    expect(await screen.findByText("Data Engineer")).toBeInTheDocument();
    expect(jobRequests(spy).at(-1)).toBe("/jobs");
    expect(nav.search).toBe("status=all");

    await user.selectOptions(screen.getByLabelText("Status"), "active");
    await vi.waitFor(() => expect(nav.search).toBe(""));
  });

  it("reads the filters from the URL on load", async () => {
    nav.search = "status=closed&company=c1&tier=1";
    const spy = mockApi([FRONTEND, CLOSED], [HALDEN, NORTHSTAR]);
    render(<JobsScreen />);

    expect(await screen.findByText("Data Engineer")).toBeInTheDocument();
    expect(jobRequests(spy)).toEqual(["/jobs?company_id=c1&tier=1&active=false"]);
    expect(screen.getByLabelText("Status")).toHaveValue("closed");
    expect(screen.getByLabelText("Tier")).toHaveValue("1");
    expect(screen.getByRole("combobox", { name: "Company" })).toHaveValue("Halden");
  });

  it("falls back to the defaults for unknown or malformed URL values", async () => {
    nav.search = "status=nope&tier=abc";
    const spy = mockApi([FRONTEND], [HALDEN]);
    render(<JobsScreen />);
    await screen.findByText("Frontend Engineer");

    expect(jobRequests(spy)).toEqual(["/jobs?active=true"]);
  });

  it("never lets a slow response for old filters overwrite a newer one", async () => {
    const resolvers: Record<string, () => void> = {};
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/companies") return json(200, [HALDEN, NORTHSTAR]);
      const mine = url.searchParams.get("company_id") === "c2" ? [PLATFORM] : [FRONTEND];
      if (url.searchParams.get("company_id") === "c2") return json(200, mine);
      // The first, unfiltered request answers only when released.
      await new Promise<void>((resolve) => (resolvers.first = resolve));
      return json(200, mine);
    });
    const user = userEvent.setup();
    render(<JobsScreen />);
    await vi.waitFor(() => expect(resolvers.first).toBeDefined());

    nav.replace("/jobs?company=c2");
    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
    resolvers.first();
    await user.click(document.body);

    await vi.waitFor(() => expect(screen.queryByText("Frontend Engineer")).not.toBeInTheDocument());
    expect(screen.getByText("Platform Engineer")).toBeInTheDocument();
  });

  it("shows an alert and keeps the filters when a filtered fetch fails", async () => {
    let fail = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/companies") return json(200, [HALDEN, NORTHSTAR]);
      if (fail) throw new TypeError("Failed to fetch");
      return json(200, [FRONTEND]);
    });
    const user = userEvent.setup();
    render(<JobsScreen />);
    await screen.findByText("Frontend Engineer");

    fail = true;
    await user.selectOptions(screen.getByLabelText("Tier"), "Tier 3");

    expect(await screen.findByRole("alert")).toHaveTextContent(/can't reach the server/i);
    expect(screen.getByLabelText("Tier")).toHaveValue("3");
  });
});
