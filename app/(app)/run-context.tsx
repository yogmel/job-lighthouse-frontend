"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { triggerRun, type Run } from "@/lib/api/runs";

type RunContextValue = {
  /** The newest run started from any Run now button on this visit. */
  triggered: Run | undefined;
  /** `POST /runs`; rejects like `triggerRun` (409 = already running). */
  trigger: () => Promise<Run>;
};

// Without a provider (screens rendered alone, e.g. in tests) it still triggers.
const RunContext = createContext<RunContextValue>({ triggered: undefined, trigger: triggerRun });

/** Shares manual runs between the header and the screens, so each reflects the other's. */
export function RunProvider({ children }: { children: React.ReactNode }) {
  const [triggered, setTriggered] = useState<Run>();

  const trigger = useCallback(async () => {
    const run = await triggerRun();
    setTriggered(run);
    return run;
  }, []);

  const value = useMemo(() => ({ triggered, trigger }), [triggered, trigger]);
  return <RunContext value={value}>{children}</RunContext>;
}

export function useRuns(): RunContextValue {
  return useContext(RunContext);
}

/**
 * `runs` plus `run` if it's missing, newest first. A copy already in `runs`
 * wins: it was fetched after the trigger, so it's at least as fresh.
 */
export function withRun(runs: Run[], run: Run | undefined): Run[] {
  const merged = run && !runs.some((r) => r.id === run.id) ? [run, ...runs] : runs;
  return [...merged].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
}
