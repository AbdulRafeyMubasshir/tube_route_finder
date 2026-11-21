import { useEffect, useState } from "react";

export interface JourneyParams {
  from: string | null;
  to: string | null;
  fewerChanges: boolean;
  /** Planned departure as "HH:MM", or null for "leave now". */
  at: string | null;
  /** Planned weekday ("mon"…"sun"), with `at`. */
  day: string | null;
  /** Whether to route around live disruptions (default true). */
  live: boolean;
  /** With `at`: true to arrive by that time rather than leave at it. */
  arrive: boolean;
}

export function readJourneyParams(search: string): JourneyParams {
  const params = new URLSearchParams(search);
  return {
    from: params.get("from"),
    to: params.get("to"),
    fewerChanges: params.get("prefer") === "fewer-changes",
    at: params.get("at"),
    day: params.get("day"),
    live: params.get("live") !== "off",
    arrive: params.get("by") === "arrive",
  };
}

export function writeJourneyParams({
  from,
  to,
  fewerChanges,
  at,
  day,
  live,
  arrive,
}: JourneyParams): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (fewerChanges) params.set("prefer", "fewer-changes");
  if (at) params.set("at", at);
  if (at && day) params.set("day", day);
  if (at && arrive) params.set("by", "arrive");
  if (!live) params.set("live", "off");
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Journey state mirrored to the URL so routes can be shared and bookmarked. */
export function useJourneyParams(): [JourneyParams, (next: JourneyParams) => void] {
  const [state, setState] = useState(() => readJourneyParams(window.location.search));

  useEffect(() => {
    const url = `${window.location.pathname}${writeJourneyParams(state)}`;
    window.history.replaceState(null, "", url);
  }, [state]);

  return [state, setState];
}
