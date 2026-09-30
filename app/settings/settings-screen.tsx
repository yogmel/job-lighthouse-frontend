import { ProfileTab } from "./profile-tab";

/**
 * Settings shell. Only the Profile tab exists so far; Filters, Schedule,
 * Notifications and Account arrive with their own tickets.
 */
export function SettingsScreen() {
  return (
    <>
      <h1 className="font-heading text-3xl">Settings</h1>
      <div className="grid gap-6 sm:grid-cols-[172px_1fr]">
        <nav aria-label="Settings">
          <ul className="flex gap-1 sm:flex-col">
            <li>
              <span
                aria-current="page"
                className="block rounded-full bg-surface px-3 py-2 text-sm font-semibold text-accent-strong"
              >
                Profile
              </span>
            </li>
          </ul>
        </nav>
        <ProfileTab />
      </div>
    </>
  );
}
