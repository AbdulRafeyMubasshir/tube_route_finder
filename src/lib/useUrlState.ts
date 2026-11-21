import { useEffect, useState } from "react";

export interface JourneyParams {
  from: string | null;
  to: string | null;
  fewerChanges: boolean;
}

export function readJourneyParams(search: string): JourneyParams {
  const params = new URLSearchParams(search);
  return {
    from: params.get("from"),
    to: params.get("to"),
    fewerChanges: params.get("prefer") === "fewer-changes",
  };
}

export function writeJourneyParams({ from, to, fewerChanges }: JourneyParams): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (fewerChanges) params.set("prefer", "fewer-changes");
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
