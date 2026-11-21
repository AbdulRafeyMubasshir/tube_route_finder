import { normaliseForSearch } from "./format";

const MAX_SUGGESTIONS = 8;

export interface Searchable {
  id: string;
  name: string;
}

/** Ranks prefix matches (on any word) above other substring matches. */
export function searchStations<T extends Searchable>(items: readonly T[], query: string): T[] {
  const q = normaliseForSearch(query);
  if (!q) return [];
  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    const name = normaliseForSearch(item.name);
    const index = name.indexOf(q);
    if (index === -1) continue;
    const score = index === 0 ? 0 : name.includes(` ${q}`) ? 1 : 2;
    scored.push({ item, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name))
    .slice(0, MAX_SUGGESTIONS)
    .map((s) => s.item);
}
