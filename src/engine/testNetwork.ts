import type { Hop, Network, Walk } from "./types";

/**
 * Builds a small network for tests. Every station is its own place unless
 * `places` groups them. Each pattern is [line, stops, minutes per hop].
 */
export function makeNetwork(
  patterns: [line: string, stops: string[], minutes: number][],
  options: { walks?: Walk[]; places?: Record<string, string[]> } = {},
): Network {
  const stationIds = [...new Set(patterns.flatMap(([, stops]) => stops))];
  for (const walk of options.walks ?? []) {
    for (const id of [walk.from, walk.to]) if (!stationIds.includes(id)) stationIds.push(id);
  }
  const grouped = options.places ?? {};
  const placeOf = new Map<string, string>();
  for (const [place, members] of Object.entries(grouped))
    members.forEach((m) => placeOf.set(m, place));
  const placeIds = [...new Set(stationIds.map((id) => placeOf.get(id) ?? id))];

  const hops = new Map<string, Hop>();
  patterns.forEach(([line, stops, minutes]) => {
    for (let i = 0; i < stops.length - 1; i++) {
      const key = `${line}|${stops[i]}|${stops[i + 1]}`;
      if (!hops.has(key)) {
        hops.set(key, { line, from: stops[i] as string, to: stops[i + 1] as string, minutes });
      }
    }
  });

  return {
    lines: [...new Set(patterns.map(([line]) => line))].map((id) => ({
      id,
      name: id.toUpperCase(),
      mode: "tube",
      colour: "#000000",
    })),
    places: placeIds.map((id, i) => ({
      id,
      name: id.toUpperCase(),
      stations: stationIds.filter((s) => (placeOf.get(s) ?? s) === id),
      x: i * 10,
      y: 0,
      zone: 1,
      lines: [],
    })),
    stations: stationIds.map((id, i) => ({
      id,
      name: id.toUpperCase(),
      place: placeOf.get(id) ?? id,
      x: i * 10,
      y: 0,
    })),
    patterns: patterns.map(([line, stops], i) => ({ id: `${line}-${i}`, line, stops })),
    hops: [...hops.values()],
    walks: options.walks ?? [],
  };
}
