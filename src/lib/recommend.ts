import type { Journey } from "../engine/raptor";

/** Extra cost per change when "fewer changes" is on (steers the search; not added to times). */
export const FEWER_CHANGES_PENALTY = 8;
/** Minutes until the next departure beyond which we warn that trains have stopped. */
export const LONG_WAIT = 45;
/** With "fewer changes", accept up to this many minutes' later arrival to save a change. */
const FEWER_CHANGES_TOLERANCE = 10;

/** Picks the journey to show from a Pareto set (fewest changes first). */
export function recommend(journeys: Journey[], fewerChanges: boolean): number {
  if (journeys.length === 0) return -1;
  const fastest = journeys.length - 1;
  if (!fewerChanges) return fastest;
  const limit = (journeys[fastest] as Journey).arrival + FEWER_CHANGES_TOLERANCE;
  return journeys.findIndex((j) => j.arrival <= limit);
}

/** For "arrive by": the latest departure, or the simplest leaving within tolerance of it. */
export function recommendArriveBy(journeys: Journey[], fewerChanges: boolean): number {
  if (journeys.length === 0) return -1;
  const latest = journeys.length - 1;
  if (!fewerChanges) return latest;
  const limit = (journeys[latest] as Journey).departure - FEWER_CHANGES_TOLERANCE;
  return journeys.findIndex((j) => j.departure >= limit);
}
