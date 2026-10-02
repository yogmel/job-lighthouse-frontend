import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "@/lib/api/config";
import { ScheduleTab } from "./schedule-tab";

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

function mockApi(
  config: Config = CONFIG,
  put: (body: unknown) => Response = (body) => json(200, { ...config, ...(body as object) }),
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const key = `${init?.method ?? "GET"} ${String(input).replace("http://api.test", "")}`;
    if (key === "GET /config") return json(200, config);
    if (key === "PUT /config") return put(JSON.parse(String(init?.body)));
    throw new Error(`Unexpected request: ${key}`);
  });
}

const nextRun = () => screen.getByText(/Next run:/).textContent ?? "";

describe("ScheduleTab", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-02T05:00:00Z") });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("loads the saved schedule as a preset and estimates the next run", async () => {
    mockApi();
    render(<ScheduleTab />);

    expect(await screen.findByLabelText("Frequency")).toHaveValue("daily");
    expect(screen.getByLabelText("Time (UTC)")).toHaveValue("07:00");
    expect(screen.getByText("0 7 * * *")).toBeInTheDocument();
    expect(nextRun()).toMatch(/2026/);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("opens an unrecognised cron in the raw editor", async () => {
    mockApi({ ...CONFIG, cron: "15 8 1,15 * *" });
    render(<ScheduleTab />);

    expect(await screen.findByLabelText("Frequency")).toHaveValue("custom");
    expect(screen.getByLabelText("Cron expression")).toHaveValue("15 8 1,15 * *");
  });

  it("saves a preset via PUT /config, keeping the other fields", async () => {
    const put = vi.fn((body: unknown) => json(200, { ...CONFIG, ...(body as object) }));
    mockApi(CONFIG, put);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ScheduleTab />);

    await user.selectOptions(await screen.findByLabelText("Frequency"), "weekdays");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Schedule saved");
    expect(put).toHaveBeenCalledWith({
      keywords_include: ["frontend"],
      keywords_exclude: ["intern"],
      location: "Berlin",
      cron: "0 7 * * 1-5",
      profile: "# Profile",
    });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("updates the next-run estimate as the schedule changes", async () => {
    mockApi();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ScheduleTab />);

    await user.selectOptions(await screen.findByLabelText("Frequency"), "hours");
    expect(screen.getByText("0 */6 * * *")).toBeInTheDocument();
    const sixHourly = nextRun();

    await user.selectOptions(screen.getByLabelText("Hours between runs"), "12");
    expect(screen.getByText("0 */12 * * *")).toBeInTheDocument();
    expect(nextRun()).not.toBe(sixHourly);
  });

  it("saves a raw cron override", async () => {
    const put = vi.fn((body: unknown) => json(200, { ...CONFIG, ...(body as object) }));
    mockApi(CONFIG, put);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ScheduleTab />);

    await user.selectOptions(await screen.findByLabelText("Frequency"), "custom");
    const raw = screen.getByLabelText("Cron expression");
    expect(raw).toHaveValue("0 7 * * *");
    await user.clear(raw);
    await user.type(raw, "30 6 * * 1");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByRole("status");
    expect(put).toHaveBeenCalledWith(expect.objectContaining({ cron: "30 6 * * 1" }));
  });

  it("blocks saving an invalid cron", async () => {
    const put = vi.fn();
    mockApi(CONFIG, put);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ScheduleTab />);

    await user.selectOptions(await screen.findByLabelText("Frequency"), "custom");
    const raw = screen.getByLabelText("Cron expression");
    await user.clear(raw);
    await user.type(raw, "99 * * * *");

    expect(screen.getByText(/Enter 5 fields/)).toBeInTheDocument();
    expect(raw).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(put).not.toHaveBeenCalled();
  });

  it("shows a server validation error on the cron field", async () => {
    mockApi(CONFIG, () =>
      json(422, { detail: [{ loc: ["body", "cron"], msg: "Runs too often" }] }),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ScheduleTab />);

    await user.selectOptions(await screen.findByLabelText("Frequency"), "custom");
    const raw = screen.getByLabelText("Cron expression");
    await user.clear(raw);
    await user.type(raw, "* * * * *");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Runs too often")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows an error when the schedule can't be loaded", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(500, { detail: "boom" }));
    render(<ScheduleTab />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });
});
