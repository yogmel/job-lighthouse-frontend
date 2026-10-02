import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Run } from "@/lib/api/runs";
import { AppHeader } from "./app-header";
import { RunProvider } from "./run-context";
import { RunsScreen } from "./runs/runs-screen";

const nav = vi.hoisted(() => ({ pathname: "/jobs", search: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const NOW = new Date("2026-10-02T10:00:00Z");

const run = (id: string, started_at: string, patch: Partial<Run> = {}): Run => ({
  id,
  user_id: "u1",
  started_at,
  finished_at: started_at,
  status: "success",
  trigger: "cron",
  jobs_found: 0,
  error: null,
  ...patch,
});

const RUNS = [run("r1", "2026-10-01T07:03:00Z"), run("r2", "2026-10-02T07:04:00Z")];
const STARTED = run("r3", "2026-10-02T09:59:00Z", {
  status: "running",
  finished_at: null,
  trigger: "manual",
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Answers calls by "METHOD /path"; `routes` override the defaults. */
function mockApi(routes: Record<string, () => Response> = {}) {
  const defaults: Record<string, () => Response> = {
    "GET /jobs": () => json(200, [{ id: "j1" }, { id: "j2" }, { id: "j3" }]),
    "GET /companies": () => json(200, [{ id: "c1" }, { id: "c2" }]),
    "GET /runs": () => json(200, RUNS),
    "GET /config": () => json(200, { cron: "0 7,14 * * *" }),
  };
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const key = `${init?.method ?? "GET"} ${String(input).replace("http://api.test", "")}`;
    const route = routes[key] ?? defaults[key];
    if (!route) throw new Error(`Unexpected request: ${key}`);
    return route();
  });
}

function renderHeader() {
  return render(
    <RunProvider>
      <AppHeader />
    </RunProvider>,
  );
}

function tab(name: RegExp) {
  return within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name });
}

describe("AppHeader", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
    nav.pathname = "/jobs";
    nav.search = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("links the logo to Jobs and the gear to Settings", () => {
    mockApi();
    renderHeader();

    expect(screen.getByRole("link", { name: "Job Lighthouse" })).toHaveAttribute("href", "/jobs");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(tab(/^Profile/)).toHaveAttribute("href", "/settings?tab=profile");
  });

  it("shows job and company counts", async () => {
    mockApi();
    renderHeader();

    expect(await screen.findByRole("link", { name: "Jobs 3" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Companies 2" })).toBeInTheDocument();
  });

  it("hides a count whose request failed, keeping the rest", async () => {
    mockApi({ "GET /jobs": () => json(500, { detail: "boom" }) });
    renderHeader();

    expect(await screen.findByRole("link", { name: "Companies 2" })).toBeInTheDocument();
    expect(tab(/^Jobs/)).toHaveAccessibleName("Jobs");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    ["/companies/new", "", /^Companies/],
    ["/runs", "", /^Runs/],
    ["/settings", "?tab=profile", /^Profile/],
  ])("marks the active tab on %s%s", (pathname, search, name) => {
    nav.pathname = pathname;
    nav.search = search;
    mockApi();
    renderHeader();

    expect(tab(name)).toHaveAttribute("aria-current", "page");
    expect(within(screen.getByRole("navigation", { name: "Main" })).getAllByRole("link").filter(
      (link) => link.getAttribute("aria-current") === "page",
    )).toHaveLength(1);
  });

  it("shows the last run and the time to the next", async () => {
    mockApi();
    renderHeader();

    expect(await screen.findByText("Last run today 07:04 · next in 4h")).toBeInTheDocument();
  });

  it("shows No runs yet without history", async () => {
    mockApi({ "GET /runs": () => json(200, []) });
    renderHeader();

    expect(await screen.findByText(/^No runs yet/)).toBeInTheDocument();
  });

  it("starts a run and shows Running…", async () => {
    const spy = mockApi({ "POST /runs": () => json(202, STARTED) });
    const user = userEvent.setup();
    renderHeader();
    await screen.findByText(/^Last run/);

    await user.click(screen.getByRole("button", { name: "Run now" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Run started.");
    expect(screen.getByText("Running…")).toBeInTheDocument();
    expect(spy.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("treats a 409 as a run already in progress", async () => {
    mockApi({ "POST /runs": () => json(409, { detail: "Run in progress" }) });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Run now" }));

    expect(await screen.findByRole("status")).toHaveTextContent("A run is already in progress.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the error when the run failed", async () => {
    mockApi({
      "POST /runs": () => json(200, { ...STARTED, status: "failed", error: "lock timeout" }),
    });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "Run now" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Run failed: lock timeout");
  });

  it("puts a header-started run on the Runs screen without a reload", async () => {
    nav.pathname = "/runs";
    mockApi({
      "POST /runs": () => json(202, STARTED),
      "GET /runs/r2/companies": () => json(200, []),
      "GET /runs/r3/companies": () => json(200, []),
    });
    const user = userEvent.setup();
    render(
      <RunProvider>
        <AppHeader />
        <RunsScreen />
      </RunProvider>,
    );
    const history = await screen.findByRole("region", { name: "History" });

    // The header's Run now comes first in the document.
    await user.click(screen.getAllByRole("button", { name: "Run now" })[0]);

    const first = await vi.waitFor(() => {
      const row = within(history).getAllByRole("row")[1];
      expect(within(row).getByText("Today 09:59")).toBeInTheDocument();
      return row;
    });
    expect(within(first).getByText("Manual")).toBeInTheDocument();
  });
});
