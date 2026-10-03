"use client";

import { useSearchParams } from "next/navigation";
import { AccountTab } from "./account-tab";
import { NotificationsTab } from "./notifications-tab";
import { ProfileTab } from "./profile-tab";
import { ScheduleTab } from "./schedule-tab";

const TABS = [
  { id: "schedule", label: "Schedule" },
  { id: "profile", label: "Profile" },
  { id: "notifications", label: "Notifications" },
  { id: "account", label: "Account" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** `?tab=` value to tab; anything unknown opens Schedule. */
export function settingsTab(param: string | null): TabId {
  return TABS.find(({ id }) => id === param)?.id ?? "schedule";
}

/**
 * Settings shell. The open tab lives in `?tab=` so the header's Profile link
 * can deep-link to it. Filters arrives with its own ticket.
 */
export function SettingsScreen() {
  const tab = settingsTab(useSearchParams().get("tab"));

  // Native history updates sync with useSearchParams without a server round trip.
  function setTab(id: TabId) {
    window.history.replaceState(null, "", `?tab=${id}`);
  }

  return (
    <>
      <h1 className="font-heading text-3xl">Settings</h1>
      <div className="grid gap-6 sm:grid-cols-[172px_1fr]">
        <nav aria-label="Settings">
          <ul className="flex gap-1 sm:flex-col">
            {TABS.map(({ id, label }) => (
              <li key={id}>
                <button
                  type="button"
                  aria-current={tab === id ? "page" : undefined}
                  onClick={() => setTab(id)}
                  className={`block w-full rounded-full px-3 py-2 text-left text-sm ${
                    tab === id
                      ? "bg-surface font-semibold text-accent-strong"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        {tab === "schedule" && <ScheduleTab />}
        {tab === "profile" && <ProfileTab />}
        {tab === "notifications" && <NotificationsTab />}
        {tab === "account" && <AccountTab />}
      </div>
    </>
  );
}
