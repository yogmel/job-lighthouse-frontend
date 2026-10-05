import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsScreen, settingsTab } from "./settings-screen";

const nav = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
}));

// The tabs fetch their own data; only which one is open matters here.
vi.mock("./schedule-tab", () => ({ ScheduleTab: () => <p>Schedule panel</p> }));
vi.mock("./profile-tab", () => ({ ProfileTab: () => <p>Profile panel</p> }));
vi.mock("./notifications-tab", () => ({ NotificationsTab: () => <p>Notifications panel</p> }));
vi.mock("./filters-tab", () => ({ FiltersTab: () => <p>Filters panel</p> }));
vi.mock("./account-tab", () => ({ AccountTab: () => <p>Account panel</p> }));

describe("settingsTab", () => {
  it.each([
    ["profile", "profile"],
    ["account", "account"],
    [null, "schedule"],
    ["", "schedule"],
    ["filters", "filters"],
    ["nope", "schedule"],
  ])("?tab=%s → %s", (param, expected) => {
    expect(settingsTab(param)).toBe(expected);
  });
});

describe("SettingsScreen", () => {
  afterEach(() => {
    nav.search = "";
    vi.restoreAllMocks();
  });

  it("opens the tab named in ?tab=", () => {
    nav.search = "?tab=profile";
    render(<SettingsScreen />);

    expect(screen.getByText("Profile panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Profile" })).toHaveAttribute("aria-current", "page");
  });

  it("opens Schedule for a missing or unknown tab", () => {
    nav.search = "?tab=nope";
    render(<SettingsScreen />);

    expect(screen.getByText("Schedule panel")).toBeInTheDocument();
  });

  it("writes the picked tab to the URL", async () => {
    const replace = vi.spyOn(window.history, "replaceState");
    const user = userEvent.setup();
    render(<SettingsScreen />);

    await user.click(screen.getByRole("button", { name: "Account" }));

    expect(replace).toHaveBeenCalledWith(null, "", "?tab=account");
  });
});
