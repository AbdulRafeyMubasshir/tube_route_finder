import { MinHeap } from "./MinHeap";
import type { Graph } from "./Graph";
import type { Edge, PatternId, PlaceId, Route, RouteOptions, Segment, StationId } from "./types";

export const DEFAULT_CHANGE_MINUTES = 3;
const EPSILON = 1e-9;

interface Entry {
  state: number;
  cost: number;
  interchanges: number;
}

/** Order by cost, then by fewer interchanges among equal-cost routes. */
const compareEntries = (a: Entry, b: Entry): number => {
  const diff = a.cost - b.cost;
  if (Math.abs(diff) > EPSILON) return diff;
  return a.interchanges - b.interchanges;
};

/**
 * Finds the cheapest route between two places.
 *
 * Dijkstra's algorithm over a state graph with two kinds of state: *at a
 * station* (not yet boarded, or on the platform after a train) and *on a
 * train* (a position along one service pattern). From a train you can stay on
 * it or alight; from a station you can board any departing train or walk.
 * Boarding after having already travelled is a change and costs
 * `changeMinutes + changePenalty`; staying on a train is free. Modelling
 * patterns rather than lines means switching branches of one line (e.g. on the
 * Northern line) is correctly a change.
 *
 * Separating "at a station" from "on a train" keeps the work per state
 * constant on a train and linear in departures at a station (instead of
 * quadratic at busy interchanges), and the states are integer-indexed so the
 * search runs on typed arrays (see StateIndex).
 *
 * Complexity: O((S + E) log S) for S states and E transitions, binary heap.
 *
 * @returns the route, or null if the destination cannot be reached.
 * @throws UnknownStationError if either place id is not in the graph.
 */
export function findRoute(
  graph: Graph,
  from: PlaceId,
  to: PlaceId,
  options: RouteOptions = {},
): Route | null {
  const origin = graph.place(from);
  const destination = graph.place(to);
  const changeMinutes = options.changeMinutes ?? DEFAULT_CHANGE_MINUTES;
  const changePenalty = options.changePenalty ?? 0;
  for (const [name, value] of [
    ["changeMinutes", changeMinutes],
    ["changePenalty", changePenalty],
  ] as const) {
    if (value < 0 || !Number.isFinite(value)) {
      throw new RangeError(`${name} must be a finite number >= 0`);
    }
  }
  const changeCost = changeMinutes + changePenalty;

  if (from === to)
    return buildRoute(graph, from, to, [origin.stations[0] as StationId], [], changeMinutes);

  const ix = graph.index;
  const n = ix.stationCount;
  const cost = new Float64Array(ix.stateCount).fill(Infinity);
  const changes = new Int32Array(ix.stateCount);
  const prevState = new Int32Array(ix.stateCount).fill(-1);
  const prevEdge = new Int32Array(ix.stateCount).fill(-1);
  const settled = new Uint8Array(ix.stateCount);
  const isTarget = new Uint8Array(n);
  for (const id of destination.stations) isTarget[ix.stationIndex.get(id) as number] = 1;
  const heap = new MinHeap<Entry>(compareEntries);

  const relax = (from: number, to: number, newCost: number, newChanges: number, edge: number) => {
    if (settled[to]) return;
    const diff = newCost - (cost[to] as number);
    if (diff > EPSILON || (Math.abs(diff) <= EPSILON && newChanges >= (changes[to] as number)))
      return;
    cost[to] = newCost;
    changes[to] = newChanges;
    prevState[to] = from;
    prevEdge[to] = edge;
    heap.push({ state: to, cost: newCost, interchanges: newChanges });
  };

  for (const id of origin.stations) {
    const s = ix.stationIndex.get(id) as number;
    cost[s] = 0;
    heap.push({ state: s, cost: 0, interchanges: 0 });
  }

  let goal = -1;
  while (heap.size > 0) {
    const { state } = heap.pop() as Entry;
    if (settled[state]) continue; // stale heap entry
    settled[state] = 1;
    const c = cost[state] as number;
    const k = changes[state] as number;
    const station = ix.stationOf[state] as number;

    if (isTarget[station]) {
      goal = state;
      break;
    }

    if (state < 2 * n) {
      // At a station: board a train, or walk. Boarding from the platform is a change.
      const isChange = state >= n;
      const extra = isChange ? changeCost : 0;
      for (
        let i = ix.boardStart[station] as number;
        i < (ix.boardStart[station + 1] as number);
        i++
      ) {
        relax(
          state,
          ix.boardTarget[i] as number,
          c + (ix.boardMinutes[i] as number) + extra,
          k + (isChange ? 1 : 0),
          ix.boardEdge[i] as number,
        );
      }
      for (
        let i = ix.walkStart[station] as number;
        i < (ix.walkStart[station + 1] as number);
        i++
      ) {
        const target = (ix.walkTarget[i] as number) + (isChange ? n : 0);
        relax(state, target, c + (ix.walkMinutes[i] as number), k, ix.walkEdge[i] as number);
      }
    } else {
      // On a train: stay on it, or alight onto the platform.
      const t = state - 2 * n;
      const next = ix.nextState[t] as number;
      if (next >= 0)
        relax(state, next, c + (ix.nextMinutes[t] as number), k, ix.nextEdge[t] as number);
      relax(state, n + station, c, k, -1);
    }
  }

  if (goal < 0) return null;

  const edges: Edge[] = [];
  for (let s = goal; prevState[s] !== -1; s = prevState[s] as number) {
    const e = prevEdge[s] as number;
    if (e >= 0) edges.push(graph.edges[e] as Edge);
  }
  edges.reverse();
  const start = edges[0]?.from ?? (ix.stationIds[ix.stationOf[goal] as number] as StationId);
  return buildRoute(graph, from, to, [start, ...edges.map((e) => e.to)], edges, changeMinutes);
}

/** Assembles a Route from its edges, grouping consecutive hops on one train into a ride. */
export function buildRoute(
  graph: Graph,
  from: PlaceId,
  to: PlaceId,
  stations: StationId[],
  edges: Edge[],
  changeMinutes: number,
): Route {
  const segments: Segment[] = [];
  let lastPattern: PatternId | null = null;
  for (const edge of edges) {
    const segment = segments.at(-1);
    if (edge.kind === "walk") {
      segments.push({ kind: "walk", from: edge.from, to: edge.to, minutes: edge.minutes });
      lastPattern = null;
    } else if (segment?.kind === "ride" && lastPattern === edge.pattern) {
      segment.to = edge.to;
      segment.stops.push(edge.to);
      segment.minutes += edge.minutes;
      segment.estimated ||= edge.estimated;
    } else {
      segments.push({
        kind: "ride",
        line: edge.line,
        from: edge.from,
        to: edge.to,
        stops: [edge.to],
        towards: [],
        minutes: edge.minutes,
        estimated: edge.estimated,
      });
      lastPattern = edge.pattern;
    }
  }
  for (const segment of segments) {
    if (segment.kind === "ride")
      segment.towards = graph.towards(segment.line, segment.from, segment.to);
  }

  const rides = segments.filter((s) => s.kind === "ride");
  const interchanges = Math.max(0, rides.length - 1);
  const rideMinutes = rides.reduce((sum, s) => sum + s.minutes, 0);
  const walkMinutes = segments.reduce((sum, s) => (s.kind === "walk" ? sum + s.minutes : sum), 0);
  return {
    from,
    to,
    stations,
    edges,
    segments,
    interchanges,
    rideMinutes,
    walkMinutes,
    changeMinutes: interchanges * changeMinutes,
    totalMinutes: rideMinutes + walkMinutes + interchanges * changeMinutes,
  };
}
