import type { Station } from "../engine";
import { normaliseForSearch } from "./format";

const MAX_SUGGESTIONS = 8;

/** Ranks prefix matches (on any word) above other substring matches. */
export function searchStations(stations: readonly Station[], query: string): Station[] {
  const q = normaliseForSearch(query);
  if (!q) return [];
  const scored: { station: Station; score: number }[] = [];
  for (const station of stations) {
    const name = normaliseForSearch(station.name);
    const index = name.indexOf(q);
    if (index === -1) continue;
    const score = index === 0 ? 0 : name.includes(` ${q}`) ? 1 : 2;
    scored.push({ station, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.station.name.localeCompare(b.station.name))
    .slice(0, MAX_SUGGESTIONS)
    .map((s) => s.station);
}
