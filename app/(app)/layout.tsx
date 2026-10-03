import { AppHeader } from "./app-header";
import { RunProvider } from "./run-context";

/** Signed-in screens: shared header and tabs. The (auth) pages and /setup sit outside. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RunProvider>
      <AppHeader />
      {children}
    </RunProvider>
  );
}
