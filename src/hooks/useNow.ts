import { useEffect, useState } from "react";

/** The current time, refreshed every second. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** Seconds until `at`, counting down. */
export function useRemaining(at: Date): number {
  return Math.floor((at.getTime() - useNow()) / 1000);
}
