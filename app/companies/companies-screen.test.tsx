import { render, screen, within } from "@testing-library/react";
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
