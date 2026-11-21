import type { Network, Pattern, Place, Station, Hop, Walk, Line } from "../../src/engine/types";
import type { TflSource } from "./types";

/** Approximate public line colours. */
export const LINE_COLOURS: Record<string, string> = {
  bakerloo: "#B36305",
  central: "#E32017",
  circle: "#FFD300",
  district: "#00782A",
  "hammersmith-city": "#F3A9BB",
  jubilee: "#A0A5A9",
  metropolitan: "#9B0056",
  northern: "#000000",
  piccadilly: "#003688",
  victoria: "#0098D4",
  "waterloo-city": "#95CDBA",
  dlr: "#00A4A7",
  elizabeth: "#6950A1",
  liberty: "#61686B",
  lioness: "#FAA61A",
  mildmay: "#0077AD",
  suffragette: "#18A95D",
  weaver: "#893B67",
  windrush: "#DC241F",
};

export const MODE_LABELS: Record<string, string> = {
  tube: "Underground",
  dlr: "DLR",
  overground: "Overground",
  "elizabeth-line": "Elizabeth line",
};

/** Typical average speeds (km/h, including dwell) used where no timetable exists. */
const MODE_SPEED_KMH: Record<string, number> = {
  tube: 33,
  dlr: 30,
  overground: 38,
  "elizabeth-line": 55,
};
const DWELL_MINUTES = 0.5;
const MIN_HOP_MINUTES = 0.5;
const ROUTE_DETOUR = 1.2; // track is longer than the straight line between stations
const WALK_METRES_PER_MIN = 75;
const WALK_DETOUR = 1.4;
const MIN_WALK_MINUTES = 2;
/** Stations in different places closer than this get a walking link. */
const WALK_LINK_MAX_METRES = 350;

/** Map projection: equirectangular around central London, 1° latitude = 10,000 units. */
const LAT0 = 51.5;
const LON0 = -0.12;
const SCALE = 10_000;
const COS_LAT0 = Math.cos((LAT0 * Math.PI) / 180);
export const project = (lat: number, lon: number) => ({
  x: Math.round((lon - LON0) * COS_LAT0 * SCALE * 10) / 10,
  y: Math.round((LAT0 - lat) * SCALE * 10) / 10,
});

export function distanceMetres(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "King's Cross St. Pancras Underground Station" -> "King's Cross St. Pancras" */
export function cleanStationName(name: string): string {
  return name
    .replace(/-Underground$/i, "")
    .replace(/\s+(Underground|DLR|Rail|Overground|Elizabeth line)\s+Station$/i, "")
    .replace(/\s+\(London\)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Lowest zone number in a TfL zone string such as "2+3" or "1". */
export function parseZone(zone: string | null): number | null {
  const numbers = (zone ?? "").match(/\d+/g)?.map(Number) ?? [];
  return numbers.length ? Math.min(...numbers) : null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface CompileResult {
  network: Network;
  errors: string[];
  warnings: string[];
  stats: Record<
    "places" | "stations" | "lines" | "patterns" | "hops" | "estimatedHops" | "walks",
    number
  >;
}

export function compileNetwork(source: TflSource): CompileResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stopById = new Map(source.stops.map((s) => [s.id, s]));
  const lineMode = new Map(source.lines.map((l) => [l.id, l.mode]));

  // ---- Lines ---------------------------------------------------------------
  const lines: Line[] = source.lines.map((l) => {
    const colour = LINE_COLOURS[l.id];
    if (!colour) warnings.push(`no colour for line "${l.id}"`);
    return { id: l.id, name: l.name, mode: l.mode, colour: colour ?? "#666666" };
  });

  // ---- Patterns (deduplicated) ---------------------------------------------
  const patterns: Pattern[] = [];
  const seenPatterns = new Set<string>();
  const usedStops = new Set<string>();
  for (const p of source.patterns) {
    const missing = p.stops.filter((id) => !stopById.has(id));
    if (missing.length) {
      errors.push(
        `pattern "${p.name}" (${p.line}) references unknown stops: ${missing.join(", ")}`,
      );
      continue;
    }
    if (p.stops.length < 2) continue;
    const key = `${p.line}|${p.stops.join(",")}`;
    if (seenPatterns.has(key)) continue;
    seenPatterns.add(key);
    p.stops.forEach((id) => usedStops.add(id));
    patterns.push({
      id: `${p.line}-${patterns.filter((x) => x.line === p.line).length + 1}`,
      line: p.line,
      stops: p.stops,
    });
  }

  // ---- Places and stations ---------------------------------------------------
  const sourcePlaceName = new Map(source.places.map((p) => [p.id, p.name]));
  const stopsByPlace = new Map<string, string[]>();
  for (const id of usedStops) {
    const stop = stopById.get(id) as (typeof source.stops)[number];
    const list = stopsByPlace.get(stop.placeId) ?? [];
    list.push(id);
    stopsByPlace.set(stop.placeId, list);
  }

  const placeIdBySource = new Map<string, string>();
  const usedSlugs = new Set<string>();
  const places: Place[] = [];
  for (const [sourcePlaceId, stopIds] of [...stopsByPlace].sort(([a], [b]) => a.localeCompare(b))) {
    stopIds.sort();
    const firstStop = stopById.get(stopIds[0] as string) as (typeof source.stops)[number];
    const name = cleanStationName(
      stopIds.length > 1 || stopById.has(sourcePlaceId) === false
        ? (sourcePlaceName.get(sourcePlaceId) ?? firstStop.name)
        : firstStop.name,
    );
    let slug = slugify(name);
    for (let n = 2; usedSlugs.has(slug); n++) slug = `${slugify(name)}-${n}`;
    usedSlugs.add(slug);
    placeIdBySource.set(sourcePlaceId, slug);

    const members = stopIds.map((id) => stopById.get(id) as (typeof source.stops)[number]);
    const lat = members.reduce((s, m) => s + m.lat, 0) / members.length;
    const lon = members.reduce((s, m) => s + m.lon, 0) / members.length;
    const zones = members.map((m) => parseZone(m.zone)).filter((z): z is number => z !== null);
    places.push({
      id: slug,
      name,
      stations: stopIds,
      ...project(lat, lon),
      zone: zones.length ? Math.min(...zones) : null,
      lines: [],
    });
  }

  const stations: Station[] = [...usedStops].sort().map((id) => {
    const stop = stopById.get(id) as (typeof source.stops)[number];
    return {
      id,
      name: cleanStationName(stop.name),
      place: placeIdBySource.get(stop.placeId) as string,
      ...project(stop.lat, stop.lon),
    };
  });

  const placeById = new Map(places.map((p) => [p.id, p]));
  const stationPlace = new Map(stations.map((s) => [s.id, s.place]));
  for (const pattern of patterns) {
    for (const id of pattern.stops) {
      const place = placeById.get(stationPlace.get(id) as string) as Place;
      if (!place.lines.includes(pattern.line)) place.lines.push(pattern.line);
    }
  }
  places.forEach((p) => p.lines.sort());

  // Different places that share a name (e.g. the two Bethnal Greens) get the mode added.
  const nameCounts = new Map<string, number>();
  places.forEach((p) => nameCounts.set(p.name, (nameCounts.get(p.name) ?? 0) + 1));
  for (const place of places) {
    if ((nameCounts.get(place.name) ?? 0) < 2) continue;
    const modes = [...new Set(place.lines.map((l) => lineMode.get(l) ?? ""))];
    place.name = `${place.name} (${modes.map((m) => MODE_LABELS[m] ?? m).join(", ")})`;
    const oldId = place.id;
    usedSlugs.delete(oldId);
    place.id = slugify(place.name);
    usedSlugs.add(place.id);
    for (const station of stations) {
      if (station.place === oldId) {
        station.place = place.id;
        stationPlace.set(station.id, place.id);
      }
    }
  }

  // ---- Hops: timetabled where available, otherwise estimated ---------------
  const timed = new Map(source.hops.map((h) => [`${h.line}|${h.from}|${h.to}`, h]));
  const hops = new Map<string, Hop>();
  for (const pattern of patterns) {
    for (let i = 0; i < pattern.stops.length - 1; i++) {
      const from = pattern.stops[i] as string;
      const to = pattern.stops[i + 1] as string;
      const key = `${pattern.line}|${from}|${to}`;
      if (hops.has(key)) continue;
      const a = stopById.get(from) as (typeof source.stops)[number];
      const b = stopById.get(to) as (typeof source.stops)[number];
      const speed = MODE_SPEED_KMH[lineMode.get(pattern.line) ?? ""] ?? 33;
      const estimate = (distanceMetres(a, b) / 1000) * ROUTE_DETOUR * (60 / speed) + DWELL_MINUTES;
      const sample = timed.get(key);
      if (sample) {
        if (sample.minutes > estimate * 4 + 2) {
          warnings.push(
            `${key}: timetabled ${sample.minutes} min looks long (estimate ${round1(estimate)})`,
          );
        }
        hops.set(key, {
          line: pattern.line,
          from,
          to,
          minutes: Math.max(MIN_HOP_MINUTES, sample.minutes),
        });
      } else {
        hops.set(key, {
          line: pattern.line,
          from,
          to,
          minutes: Math.max(MIN_HOP_MINUTES, round1(estimate)),
          estimated: true,
        });
      }
    }
  }

  // ---- Walking links ---------------------------------------------------------
  // Between stations in the same place (e.g. Bank Underground and Bank DLR), and
  // between nearby stations in different places (e.g. Bank and Monument).
  const walks: Walk[] = [];
  const stationList = [...usedStops]
    .sort()
    .map((id) => stopById.get(id) as (typeof source.stops)[number]);
  for (const a of stationList) {
    for (const b of stationList) {
      if (a.id === b.id) continue;
      const samePlace = a.placeId === b.placeId;
      const metres = distanceMetres(a, b);
      if (!samePlace && metres > WALK_LINK_MAX_METRES) continue;
      if (samePlace && metres > 1500)
        warnings.push(`walk ${a.id} -> ${b.id} in one place is ${Math.round(metres)} m`);
      const minutes = Math.max(
        MIN_WALK_MINUTES,
        Math.round((metres * WALK_DETOUR) / WALK_METRES_PER_MIN),
      );
      walks.push({ from: a.id, to: b.id, minutes });
    }
  }

  // Make walking transitively closed (A→B→C implies A→C), as RAPTOR relaxes
  // only one walk at a time. Components are tiny, so Floyd–Warshall is fine.
  const walkMinutes = new Map(walks.map((w) => [`${w.from}|${w.to}`, w.minutes]));
  const walkNodes = [...new Set(walks.flatMap((w) => [w.from, w.to]))];
  for (const k of walkNodes) {
    for (const i of walkNodes) {
      const ik = walkMinutes.get(`${i}|${k}`);
      if (ik === undefined) continue;
      for (const j of walkNodes) {
        const kj = walkMinutes.get(`${k}|${j}`);
        if (kj === undefined || i === j) continue;
        const current = walkMinutes.get(`${i}|${j}`);
        if (current === undefined || ik + kj < current) walkMinutes.set(`${i}|${j}`, ik + kj);
      }
    }
  }
  walks.length = 0;
  for (const [key, minutes] of [...walkMinutes].sort(([a], [b]) => a.localeCompare(b))) {
    const [from, to] = key.split("|") as [string, string];
    walks.push({ from, to, minutes });
  }

  // ---- Connectivity: every place reachable from the first, both ways -------
  const adjacency = new Map<string, Set<string>>(places.map((p) => [p.id, new Set()]));
  const reverse = new Map<string, Set<string>>(places.map((p) => [p.id, new Set()]));
  for (const h of hops.values()) {
    const a = stationPlace.get(h.from) as string;
    const b = stationPlace.get(h.to) as string;
    adjacency.get(a)?.add(b);
    reverse.get(b)?.add(a);
  }
  const reach = (graph: Map<string, Set<string>>, start: string) => {
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      for (const n of graph.get(stack.pop() as string) ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    return seen;
  };
  if (places.length) {
    const start = places[0]?.id as string;
    for (const [label, graph] of [
      ["from", adjacency],
      ["to", reverse],
    ] as const) {
      const seen = reach(graph, start);
      const missing = places.filter((p) => !seen.has(p.id)).map((p) => p.id);
      if (missing.length) {
        errors.push(
          `${missing.length} places cannot be reached ${label} ${start}: ${missing.slice(0, 10).join(", ")}`,
        );
      }
    }
  }

  const hopList = [...hops.values()];
  return {
    network: {
      fetchedAt: source.fetchedAt,
      lines,
      places: places.sort((a, b) => a.name.localeCompare(b.name)),
      stations,
      patterns,
      hops: hopList,
      walks,
    },
    errors,
    warnings,
    stats: {
      places: places.length,
      stations: stations.length,
      lines: lines.length,
      patterns: patterns.length,
      hops: hopList.length,
      estimatedHops: hopList.filter((h) => h.estimated).length,
      walks: walks.length,
    },
  };
}
