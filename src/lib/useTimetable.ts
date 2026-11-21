import { useEffect, useState } from "react";
import type { Graph } from "../engine";
import { Timetable, type TimetableData } from "../engine/raptor";

/**
 * Loads the timetable (a separate ~20 kB gzipped chunk) after first render, so
 * the page is usable immediately with typical journey times.
 */
const loadBundledTimetable = () =>
  import("../data/timetable.json").then((m) => m.default as TimetableData);

export function useTimetable(
  graph: Graph,
  load: () => Promise<TimetableData> = loadBundledTimetable,
): Timetable | null {
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setTimetable(new Timetable(graph, data));
      })
      .catch((error: unknown) => console.error("Could not load timetable", error));
    return () => {
      cancelled = true;
    };
  }, [graph, load]);
  return timetable;
}
