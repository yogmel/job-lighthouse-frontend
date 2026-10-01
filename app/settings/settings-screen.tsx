"use client";

import { useState } from "react";
import { NotificationsTab } from "./notifications-tab";
import { ProfileTab } from "./profile-tab";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "notifications", label: "Notifications" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Settings shell. Filters, Schedule and Account arrive with their own
 * tickets.
 */
export function SettingsScreen() {
  const [tab, setTab] = useState<TabId>("profile");

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
        {tab === "profile" ? <ProfileTab /> : <NotificationsTab />}
      </div>
    </>
  );
}
