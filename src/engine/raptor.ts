import type { Graph } from "./Graph";
import type { Edge, LineId, PlaceId, Route, Segment, StationId } from "./types";
import { DEFAULT_CHANGE_MINUTES } from "./findRoute";

export const DAY_TYPES = ["weekday", "friday", "saturday", "sunday"] as const;
export type DayType = (typeof DAY_TYPES)[number];

/** Serialised timetable, as produced by the build pipeline. */
export interface TimetableData {
  routes: {
    line: LineId;
    stops: StationId[];
    /** Minutes from the first stop to each stop (no dwell: arrive = depart). */
    times: number[];
    /** Departure times from the first stop per day type, minutes after midnight, delta-encoded. */
    trips: Partial<Record<DayType, number[]>>;
    /** True when trips are synthesised from an assumed frequency, not a published timetable. */
    estimated?: boolean;
  }[];
}

interface CompiledRoute {
  line: LineId;
  stops: Int32Array;
  times: Float64Array;
  trips: Record<DayType, Float64Array>;
  estimated: boolean;
}

/** Timetable indexed for RAPTOR: integer stops, sorted trips, stop → (route, position) lists. */
export class Timetable {
  readonly routes: CompiledRoute[];
  /** For each station index: routes serving it, as [routeIndex, position] pairs (flattened). */
  readonly stopRoutes: Int32Array[];

  constructor(
    readonly graph: Graph,
    data: TimetableData,
  ) {
    const index = graph.index.stationIndex;
    this.routes = data.routes.map((r) => {
      const trips = {} as Record<DayType, Float64Array>;
      for (const day of DAY_TYPES) {
        let t = 0;
        trips[day] = Float64Array.from(r.trips[day] ?? [], (delta) => (t += delta));
      }
      return {
        line: r.line,
        stops: Int32Array.from(r.stops, (id) => {
          const i = index.get(id);
          if (i === undefined) throw new Error(`Timetable references unknown station ${id}`);
          return i;
        }),
        times: Float64Array.from(r.times),
        trips,
        estimated: r.estimated ?? false,
      };
    });
    const lists: number[][] = Array.from({ length: graph.index.stationCount }, () => []);
    this.routes.forEach((route, r) => route.stops.forEach((s, pos) => lists[s]?.push(r, pos)));
    this.stopRoutes = lists.map((l) => Int32Array.from(l));
  }
}

export interface JourneyOptions {
  /** Departure time, minutes after midnight of the service day. */
  departAt: number;
  day: DayType;
  /** Minimum time to change trains. Default 3. */
  changeMinutes?: number;
  /** Maximum number of trains. Default 6. */
  maxTrains?: number;
}

/** A timed journey: a Route plus clock times. */
export interface Journey extends Route {
  /** When to leave the origin, minutes after midnight (may exceed 1440). */
  departure: number;
  arrival: number;
  /** Time spent waiting on platforms between trains. */
  waitMinutes: number;
  /** Start and end time of each segment, aligned with `segments`. */
  times: { start: number; end: number }[];
}

/** First index in a sorted array whose value is >= x. */
function lowerBound(values: Float64Array, x: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((values[mid] as number) < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const NONE = -1;
const RIDE = 1;
const WALK = 2;

/**
 * RAPTOR (Round-bAsed Public Transit Optimized Router; Delling, Pajor and
 * Werneck, 2012) over trip-level timetables.
 *
 * Round k finds the earliest arrival at every station using at most k trains,
 * by scanning each route once in stop order and boarding the earliest trip
 * that can be caught. Walking links are relaxed after each round. Because
 * rounds count trains, the result is the Pareto set of journeys trading
 * arrival time against number of changes, e.g. "arrive 12:41 with 2 changes,
 * or 12:44 with 1".
 *
 * Complexity: O(K × (Σ route lengths + walks)) plus a binary search per
 * boarding, for K rounds.
 *
 * @returns Pareto-optimal journeys, fewest changes first; empty if none.
 */
export function planJourneys(
  timetable: Timetable,
  from: PlaceId,
  to: PlaceId,
  options: JourneyOptions,
): Journey[] {
  const { graph } = timetable;
  const ix = graph.index;
  const n = ix.stationCount;
  const origin = graph.place(from);
  const destination = graph.place(to);
  const change = options.changeMinutes ?? DEFAULT_CHANGE_MINUTES;
  const maxTrains = options.maxTrains ?? 6;
  const t0 = options.departAt;
  if (from === to) return [];

  const rounds = maxTrains + 1;
  const arrival = new Float64Array(rounds * n).fill(Infinity); // arrival[k * n + s]
  const best = new Float64Array(n).fill(Infinity);
  const parentKind = new Int8Array(rounds * n).fill(NONE);
  const parentA = new Int32Array(rounds * n); // ride: route; walk: from station
  const parentB = new Int32Array(rounds * n); // ride: trip index; walk: walk edge index
  const parentC = new Int32Array(rounds * n); // ride: board position
  const parentD = new Int32Array(rounds * n); // ride: alight position
  const targets = destination.stations.map((id) => ix.stationIndex.get(id) as number);
  const isTarget = new Uint8Array(n);
  targets.forEach((s) => (isTarget[s] = 1));
  // Earliest arrival at any destination station so far: anything later can be pruned.
  let targetBound = Infinity;

  let marked = new Uint8Array(n);
  const walkFrom = (k: number, sources: Uint8Array) => {
    for (let s = 0; s < n; s++) {
      if (!sources[s]) continue;
      const base = arrival[k * n + s] as number;
      for (let i = ix.walkStart[s] as number; i < (ix.walkStart[s + 1] as number); i++) {
        const q = ix.walkTarget[i] as number;
        const t = base + (ix.walkMinutes[i] as number);
        if (t < (arrival[k * n + q] as number) && t < (best[q] as number) && t < targetBound) {
          arrival[k * n + q] = t;
          best[q] = t;
          if (isTarget[q]) targetBound = t;
          parentKind[k * n + q] = WALK;
          parentA[k * n + q] = s;
          parentB[k * n + q] = ix.walkEdge[i] as number;
          marked[q] = 1;
        }
      }
    }
  };

  for (const id of origin.stations) {
    const s = ix.stationIndex.get(id) as number;
    arrival[s] = t0;
    best[s] = t0;
    marked[s] = 1;
  }
  const routeStart = new Int32Array(timetable.routes.length);
  const queued: number[] = [];
  walkFrom(0, marked.slice());

  for (let k = 1; k < rounds; k++) {
    // Collect routes serving marked stops, with the earliest marked position on each.
    queued.length = 0;
    routeStart.fill(-1);
    for (let s = 0; s < n; s++) {
      if (!marked[s]) continue;
      const list = timetable.stopRoutes[s] as Int32Array;
      for (let i = 0; i < list.length; i += 2) {
        const r = list[i] as number;
        const pos = list[i + 1] as number;
        const current = routeStart[r] as number;
        if (current < 0) queued.push(r);
        if (current < 0 || pos < current) routeStart[r] = pos;
      }
    }
    marked = new Uint8Array(n);
    let any = false;
    const prev = (k - 1) * n;
    const cur = k * n;
    const slack = k === 1 ? 0 : change;

    for (const r of queued) {
      const start = routeStart[r] as number;
      const route = timetable.routes[r] as CompiledRoute;
      const trips = route.trips[options.day];
      let trip = -1;
      let tripStart = 0;
      let boardPos = -1;
      for (let pos = start; pos < route.stops.length; pos++) {
        const s = route.stops[pos] as number;
        const offset = route.times[pos] as number;
        // Alight here if the current trip improves the arrival.
        if (trip >= 0) {
          const t = tripStart + offset;
          if (t < (best[s] as number) && t < targetBound) {
            arrival[cur + s] = t;
            best[s] = t;
            if (isTarget[s]) targetBound = t;
            parentKind[cur + s] = RIDE;
            parentA[cur + s] = r;
            parentB[cur + s] = trip;
            parentC[cur + s] = boardPos;
            parentD[cur + s] = pos;
            marked[s] = 1;
            any = true;
          }
        }
        // Board (or switch to) an earlier trip if we reached this stop in the previous round.
        const ready = (arrival[prev + s] as number) + slack;
        if (ready < Infinity && (trip < 0 || ready <= tripStart + offset)) {
          const candidate = lowerBound(trips, ready - offset);
          if (candidate < trips.length && (trip < 0 || candidate < trip)) {
            trip = candidate;
            tripStart = trips[candidate] as number;
            boardPos = pos;
          }
        }
      }
    }
    if (!any) break;
    walkFrom(k, marked.slice());
  }

  // Pareto set: each round that improves the arrival at the destination.
  const journeys: Journey[] = [];
  let bestSoFar = Infinity;
  for (let k = 0; k < rounds; k++) {
    let bestStop = -1;
    for (const s of targets) {
      if ((arrival[k * n + s] as number) < bestSoFar - 1e-9) {
        bestSoFar = arrival[k * n + s] as number;
        bestStop = s;
      }
    }
    if (bestStop >= 0) {
      const parents = { parentKind, parentA, parentB, parentC, parentD };
      journeys.push(
        reconstruct(timetable, from, to, k, bestStop, arrival, parents, t0, options.day),
      );
    }
  }
  return journeys;
}

function reconstruct(
  timetable: Timetable,
  from: PlaceId,
  to: PlaceId,
  round: number,
  stop: number,
  arrival: Float64Array,
  p: {
    parentKind: Int8Array;
    parentA: Int32Array;
    parentB: Int32Array;
    parentC: Int32Array;
    parentD: Int32Array;
  },
  t0: number,
  day: DayType,
): Journey {
  const { graph } = timetable;
  const ix = graph.index;
  const n = ix.stationCount;
  const id = (s: number) => ix.stationIds[s] as StationId;

  type Leg =
    | { kind: "ride"; route: number; trip: number; board: number; alight: number }
    | { kind: "walk"; from: number; to: number; edge: number };
  const legs: Leg[] = [];
  let k = round;
  let s = stop;
  while (k >= 0) {
    const at = k * n + s;
    const kind = p.parentKind[at];
    if (kind === WALK) {
      legs.push({
        kind: "walk",
        from: p.parentA[at] as number,
        to: s,
        edge: p.parentB[at] as number,
      });
      s = p.parentA[at] as number;
    } else if (kind === RIDE) {
      const route = timetable.routes[p.parentA[at] as number] as CompiledRoute;
      legs.push({
        kind: "ride",
        route: p.parentA[at] as number,
        trip: p.parentB[at] as number,
        board: p.parentC[at] as number,
        alight: p.parentD[at] as number,
      });
      s = route.stops[p.parentC[at] as number] as number;
      k -= 1;
    } else {
      break; // reached an origin station
    }
  }
  legs.reverse();

  const segments: Segment[] = [];
  const times: { start: number; end: number }[] = [];
  const edges: Edge[] = [];
  const stations: StationId[] = [id(s)];
  let departure = t0;
  let rideMinutes = 0;
  let walkMinutes = 0;
  for (const leg of legs) {
    if (leg.kind === "walk") {
      const edge = graph.edges[leg.edge] as Edge;
      segments.push({ kind: "walk", from: id(leg.from), to: id(leg.to), minutes: edge.minutes });
      times.push({ start: NaN, end: NaN }); // filled in below
      edges.push(edge);
      stations.push(id(leg.to));
      walkMinutes += edge.minutes;
      continue;
    }
    const route = timetable.routes[leg.route] as CompiledRoute;
    const stops: StationId[] = [];
    for (let pos = leg.board + 1; pos <= leg.alight; pos++) {
      const a = id(route.stops[pos - 1] as number);
      const b = id(route.stops[pos] as number);
      const minutes = (route.times[pos] as number) - (route.times[pos - 1] as number);
      edges.push({
        kind: "ride",
        from: a,
        to: b,
        line: route.line,
        pattern: `route-${leg.route}`,
        minutes,
        estimated: route.estimated,
      });
      stops.push(b);
      stations.push(b);
    }
    const minutes = (route.times[leg.alight] as number) - (route.times[leg.board] as number);
    const tripStart = route.trips[day][leg.trip] as number;
    times.push({
      start: tripStart + (route.times[leg.board] as number),
      end: tripStart + (route.times[leg.alight] as number),
    });
    rideMinutes += minutes;
    const fromId = id(route.stops[leg.board] as number);
    const toId = id(route.stops[leg.alight] as number);
    segments.push({
      kind: "ride",
      line: route.line,
      from: fromId,
      to: toId,
      stops,
      towards: graph.towards(route.line, fromId, toId),
      minutes,
      estimated: route.estimated,
    });
  }

  // Leave as late as possible: back-date the departure to just catch the first train.
  const arrivalTime = arrival[round * n + stop] as number;
  const firstRide = legs.find((l) => l.kind === "ride");
  if (firstRide && firstRide.kind === "ride") {
    const walkBefore = segments
      .slice(
        0,
        segments.findIndex((seg) => seg.kind === "ride"),
      )
      .reduce((sum, seg) => sum + seg.minutes, 0);
    const route = timetable.routes[firstRide.route] as CompiledRoute;
    const boardTime =
      (route.trips[day][firstRide.trip] as number) + (route.times[firstRide.board] as number);
    departure = boardTime - walkBefore;
  }
  // Walks happen straight after the previous segment (or at the departure time).
  let clock = departure;
  times.forEach((t, i) => {
    if (Number.isNaN(t.start)) {
      t.start = clock;
      t.end = clock + (segments[i] as Segment).minutes;
    }
    clock = t.end;
  });

  const rides = segments.filter((seg) => seg.kind === "ride").length;
  const interchanges = Math.max(0, rides - 1);
  const totalMinutes = arrivalTime - departure;
  return {
    from,
    to,
    stations,
    edges,
    segments,
    interchanges,
    rideMinutes,
    walkMinutes,
    changeMinutes: Math.max(0, totalMinutes - rideMinutes - walkMinutes),
    totalMinutes,
    departure,
    arrival: arrivalTime,
    waitMinutes: Math.max(0, totalMinutes - rideMinutes - walkMinutes),
    times,
  };
}
