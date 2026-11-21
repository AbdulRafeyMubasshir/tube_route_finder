import type {
  SourceHop,
  SourceLine,
  SourcePattern,
  SourcePlace,
  SourceStop,
  TflSource,
} from "./types";

/** Fetches a TfL API path, resolving to null on 404. */
export type TflGet = (path: string) => Promise<unknown>;

export const MODES = ["tube", "dlr", "elizabeth-line", "overground"] as const;
/** Modes whose /Timetable endpoint returns data. Others fall back to estimates. */
export const TIMETABLED_MODES = new Set(["tube", "dlr"]);
const DIRECTIONS = ["outbound", "inbound"] as const;

// ---- Minimal shapes of the TfL responses we read --------------------------

interface ApiLine {
  id: string;
  name: string;
  modeName: string;
}
interface ApiMatchedStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  topMostParentId?: string | null;
  zone?: string | null;
}
interface ApiSequence {
  stations: ApiMatchedStop[];
  orderedLineRoutes: { name: string; naptanIds: string[] }[];
}
interface ApiTimetable {
  timetable?: {
    departureStopId?: string;
    routes?: { stationIntervals?: { intervals: { stopId: string; timeToArrival: number }[] }[] }[];
  };
}
interface ApiStopPoint {
  naptanId: string;
  commonName: string;
  lat: number;
  lon: number;
  stopType?: string;
  additionalProperties?: { key: string; value: string }[];
  children?: ApiStopPoint[];
}

const decodeEntities = (s: string) =>
  s
    .replace(/&harr;/g, "↔")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Turns timetable intervals into per-hop run-time samples.
 *
 * Each interval list gives cumulative minutes from the origin to each later
 * stop on one stopping pattern, so the difference between consecutive entries
 * is the run time of that hop.
 */
export function hopSamplesFromTimetable(
  origin: string,
  timetable: ApiTimetable,
): { from: string; to: string; minutes: number }[] {
  const samples: { from: string; to: string; minutes: number }[] = [];
  for (const route of timetable.timetable?.routes ?? []) {
    for (const { intervals } of route.stationIntervals ?? []) {
      let prevStop = origin;
      let prevTime = 0;
      for (const { stopId, timeToArrival } of intervals) {
        if (timeToArrival >= prevTime) {
          samples.push({ from: prevStop, to: stopId, minutes: timeToArrival - prevTime });
        }
        prevStop = stopId;
        prevTime = timeToArrival;
      }
    }
  }
  return samples;
}

/** Averages samples per (line, from, to). */
export function aggregateHops(
  samples: { line: string; from: string; to: string; minutes: number }[],
): SourceHop[] {
  const totals = new Map<string, SourceHop>();
  for (const s of samples) {
    const key = `${s.line}|${s.from}|${s.to}`;
    const hop = totals.get(key) ?? { line: s.line, from: s.from, to: s.to, minutes: 0, samples: 0 };
    hop.minutes += s.minutes;
    hop.samples += 1;
    totals.set(key, hop);
  }
  return [...totals.values()]
    .map((h) => ({ ...h, minutes: Math.round((h.minutes / h.samples) * 100) / 100 }))
    .sort(
      (a, b) =>
        a.line.localeCompare(b.line) || a.from.localeCompare(b.from) || a.to.localeCompare(b.to),
    );
}

const zoneOf = (stop: ApiStopPoint) =>
  stop.additionalProperties?.find((p) => p.key === "Zone")?.value ?? null;

/**
 * Makes sure every stop referenced by a pattern has coordinates and a place.
 *
 * Route sequences list interchanges as hubs (e.g. HUBKGX) while patterns refer
 * to the individual stations inside them (e.g. 940GZZLUKSX). This fetches the
 * hubs, takes their station children, and drops hub entries that no pattern
 * uses. Returns the places: one per hub, plus one per stand-alone station.
 */
export async function resolveStops(
  stops: Map<string, SourceStop>,
  patterns: SourcePattern[],
  get: TflGet,
  log: (message: string) => void = () => {},
): Promise<SourcePlace[]> {
  const needed = new Set(patterns.flatMap((p) => p.stops));
  const places = new Map<string, SourcePlace>();

  const absorb = (node: ApiStopPoint, hubId: string | null, depth = 0) => {
    if (depth === 0 && node.stopType === "TransportInterchange") {
      places.set(node.naptanId, { id: node.naptanId, name: node.commonName });
      hubId = node.naptanId;
    }
    if (needed.has(node.naptanId) && !stops.has(node.naptanId)) {
      stops.set(node.naptanId, {
        id: node.naptanId,
        name: node.commonName,
        placeId: hubId ?? node.naptanId,
        lat: node.lat,
        lon: node.lon,
        zone: zoneOf(node),
      });
    }
    if (depth < 3) node.children?.forEach((child) => absorb(child, hubId, depth + 1));
  };

  const fetchBatch = async (ids: string[]) => {
    for (let i = 0; i < ids.length; i += 20) {
      const result = (await get(`/StopPoint/${ids.slice(i, i + 20).join(",")}`)) as
        ApiStopPoint | ApiStopPoint[] | null;
      for (const node of Array.isArray(result) ? result : result ? [result] : [])
        absorb(node, null);
    }
  };

  // 1. Expand hubs that appeared in route sequences.
  const hubIds = [...stops.keys()].filter((id) => !needed.has(id));
  await fetchBatch(hubIds);
  // 2. Look up anything still missing directly (the API may answer with its hub).
  const missing = [...needed].filter((id) => !stops.has(id));
  if (missing.length) await fetchBatch(missing);
  const unresolved = [...needed].filter((id) => !stops.has(id));
  if (unresolved.length) log(`  unresolved stops: ${unresolved.join(", ")}`);

  for (const id of hubIds) stops.delete(id);
  for (const stop of stops.values()) {
    if (!places.has(stop.placeId)) places.set(stop.placeId, { id: stop.placeId, name: stop.name });
  }
  log(`${stops.size} stops in ${places.size} places`);
  return [...places.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Downloads lines, service patterns, stops, hubs and timetabled run times for
 * the given modes and returns them in the compact TflSource format.
 */
export async function fetchSource(
  get: TflGet,
  log: (message: string) => void = () => {},
): Promise<TflSource> {
  const apiLines = (await get(`/Line/Mode/${MODES.join(",")}`)) as ApiLine[];
  const lines: SourceLine[] = apiLines
    .map((l) => ({ id: l.id, name: l.name, mode: l.modeName }))
    .sort((a, b) => a.id.localeCompare(b.id));
  log(`${lines.length} lines`);

  const stops = new Map<string, SourceStop>();
  const patterns: SourcePattern[] = [];
  const samples: { line: string; from: string; to: string; minutes: number }[] = [];

  for (const line of lines) {
    for (const direction of DIRECTIONS) {
      const sequence = (await get(
        `/Line/${line.id}/Route/Sequence/${direction}`,
      )) as ApiSequence | null;
      if (!sequence) {
        log(`  ${line.id} ${direction}: no sequence`);
        continue;
      }
      for (const s of sequence.stations) {
        if (!stops.has(s.id)) {
          stops.set(s.id, {
            id: s.id,
            name: s.name,
            placeId: s.topMostParentId || s.id,
            lat: s.lat,
            lon: s.lon,
            zone: s.zone ?? null,
          });
        }
      }
      for (const route of sequence.orderedLineRoutes) {
        patterns.push({
          line: line.id,
          direction,
          name: decodeEntities(route.name),
          stops: route.naptanIds,
        });
      }

      if (!TIMETABLED_MODES.has(line.mode)) continue;
      const origins = new Set(
        sequence.orderedLineRoutes.map((r) => r.naptanIds[0]).filter(Boolean),
      );
      for (const origin of origins) {
        const timetable = (await get(
          `/Line/${line.id}/Timetable/${origin}?direction=${direction}`,
        )) as ApiTimetable | null;
        if (!timetable) {
          log(`  ${line.id} ${direction} from ${origin}: no timetable`);
          continue;
        }
        for (const s of hopSamplesFromTimetable(origin as string, timetable)) {
          samples.push({ line: line.id, ...s });
        }
      }
    }
    log(`  ${line.id}: ${patterns.filter((p) => p.line === line.id).length} patterns`);
  }

  const places = await resolveStops(stops, patterns, get, log);

  return {
    fetchedAt: new Date().toISOString(),
    lines,
    stops: [...stops.values()].sort((a, b) => a.id.localeCompare(b.id)),
    places,
    patterns,
    hops: aggregateHops(samples),
  };
}
