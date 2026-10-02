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

const nextRun = () => screen.getByText(/Next run/).textContent ?? "";
const freq = (name: string) => screen.getByRole("radio", { name });

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

    expect(await screen.findByRole("radio", { name: "Daily" })).toBeChecked();
    expect(screen.getByLabelText("Time (UTC)")).toHaveValue("07:00");
    expect(screen.getByLabelText("Cron expression")).toHaveValue("0 7 * * *");
    expect(nextRun()).toBe("Next run Fri 2 Oct, 07:00 UTC — about 2h from now.");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("opens an unrecognised cron as Custom cron", async () => {
    mockApi({ ...CONFIG, cron: "15 8 1,15 * *" });
    render(<ScheduleTab />);

    expect(await screen.findByRole("radio", { name: "Custom cron" })).toBeChecked();
    expect(screen.getByLabelText("Cron expression")).toHaveValue("15 8 1,15 * *");
    expect(screen.queryByLabelText("Time (UTC)")).not.toBeInTheDocument();
  });

  it("recognises a weekly schedule", async () => {
    mockApi({ ...CONFIG, cron: "30 6 * * 3" });
    render(<ScheduleTab />);

    expect(await screen.findByRole("radio", { name: "Weekly" })).toBeChecked();
    expect(screen.getByLabelText("Day")).toHaveValue("3");
    expect(screen.getByLabelText("Time (UTC)")).toHaveValue("06:30");
  });

  it("saves a preset via PUT /config, keeping the other fields", async () => {
    const put = vi.fn((body: unknown) => json(200, { ...CONFIG, ...(body as object) }));
    mockApi(CONFIG, put);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ScheduleTab />);

    await user.click(await screen.findByRole("radio", { name: "Weekdays" }));
    expect(screen.getByLabelText("Cron expression")).toHaveValue("0 7 * * 1-5");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Schedule saved");
    expect(put).toHaveBeenCalledWith({
      keywords_include: ["frontend"],
      keywords_exclude: ["intern"],
      location: "Berlin",
      cron: "0 7 * * 1-5",
      profile: "# Profile",
    });
    expect(freq("Weekdays")).toBeChecked();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("updates the cron and next-run estimate as the schedule changes", async () => {
    mockApi();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ScheduleTab />);

    await user.click(await screen.findByRole("radio", { name: "Weekly" }));
    await user.selectOptions(screen.getByLabelText("Day"), "1");
    expect(screen.getByLabelText("Cron expression")).toHaveValue("0 7 * * 1");
    expect(nextRun()).toMatch(/Mon 5 Oct, 07:00 UTC/);
  });

  it("saves a raw cron override typed into the cron field", async () => {
    const put = vi.fn((body: unknown) => json(200, { ...CONFIG, ...(body as object) }));
    mockApi(CONFIG, put);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ScheduleTab />);

    const raw = await screen.findByLabelText("Cron expression");
    await user.clear(raw);
    await user.type(raw, "30 6 * * 2");
    expect(freq("Custom cron")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByRole("status");
    expect(put).toHaveBeenCalledWith(expect.objectContaining({ cron: "30 6 * * 2" }));
    // 30 6 * * 2 is a valid weekly schedule, so it reopens as one.
    expect(freq("Weekly")).toBeChecked();
  });

  it("blocks saving an invalid cron", async () => {
    const put = vi.fn();
    mockApi(CONFIG, put);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ScheduleTab />);

    const raw = await screen.findByLabelText("Cron expression");
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

    const raw = await screen.findByLabelText("Cron expression");
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
