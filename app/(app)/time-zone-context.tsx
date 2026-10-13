"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getConfig } from "@/lib/api/config";
import { DEFAULT_TIME_ZONE } from "@/lib/cron";

type TimeZoneContextValue = {
  /** `Config.timezone`; UTC until the config loads (or if it can't). */
  timeZone: string;
  /** Called after the Schedule tab saves a new zone, so open screens follow. */
  setTimeZone: (timeZone: string) => void;
};

// Without a provider (screens rendered alone, e.g. in tests) dates are UTC.
const TimeZoneContext = createContext<TimeZoneContextValue>({
  timeZone: DEFAULT_TIME_ZONE,
  setTimeZone: () => {},
});

/** Loads `Config.timezone` once and shares it, so every screen formats dates in the same zone. */
export function TimeZoneProvider({ children }: { children: React.ReactNode }) {
  const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE);

  useEffect(() => {
    let cancelled = false;
    getConfig().then(
      (config) => !cancelled && setTimeZone(config.timezone || DEFAULT_TIME_ZONE),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ timeZone, setTimeZone }), [timeZone]);
  return <TimeZoneContext value={value}>{children}</TimeZoneContext>;
}

export function useTimeZone(): TimeZoneContextValue {
  return useContext(TimeZoneContext);
}
