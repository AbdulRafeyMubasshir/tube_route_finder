import { MinHeap } from "./MinHeap";
import { Graph } from "./Graph";
import type { Edge, LineId, Ride, Route, RouteOptions, StationId } from "./types";

const EPSILON = 1e-9;

/** A search state: being at a station, having arrived on a given line. */
interface Label {
  key: string;
  station: StationId;
  line: LineId | null;
  cost: number;
  interchanges: number;
}

const stateKey = (station: StationId, line: LineId | null) => `${station}|${line ?? ""}`;

/** Order by cost, then by fewer interchanges among equal-cost routes. */
const compareLabels = (a: Label, b: Label): number => {
  const diff = a.cost - b.cost;
  if (Math.abs(diff) > EPSILON) return diff;
  return a.interchanges - b.interchanges;
};

/**
 * Finds the cheapest route between two stations.
 *
 * Dijkstra's algorithm over a state-expanded graph in which each state is a
 * (station, line) pair. Tracking the arrival line lets a change of line carry
 * a cost (`interchangePenalty`), which a plain station graph cannot express.
 * Ties in cost are broken by fewer interchanges.
 *
 * Complexity: O((S + E) log S) where S is the number of (station, line) states
 * and E the number of edges, using a binary heap.
 *
 * @returns the route, or null if `to` cannot be reached from `from`.
 * @throws UnknownStationError if either station id is not in the graph.
 */
export function findRoute(
  graph: Graph,
  from: StationId,
  to: StationId,
  options: RouteOptions = {},
): Route | null {
  graph.station(from);
  graph.station(to);
  const penalty = options.interchangePenalty ?? 0;
  if (penalty < 0 || !Number.isFinite(penalty)) {
    throw new RangeError("interchangePenalty must be a finite number >= 0");
  }

  if (from === to) {
    return { from, to, stations: [from], legs: [], rides: [], travelMinutes: 0, interchanges: 0 };
  }

  const best = new Map<string, Label>();
  const via = new Map<string, { edge: Edge; prev: string }>();
  const settled = new Set<string>();
  const heap = new MinHeap<Label>(compareLabels);

  const start: Label = {
    key: stateKey(from, null),
    station: from,
    line: null,
    cost: 0,
    interchanges: 0,
  };
  best.set(start.key, start);
  heap.push(start);

  let goal: Label | undefined;
  while (heap.size > 0) {
    const current = heap.pop() as Label;
    if (settled.has(current.key)) continue; // stale heap entry
    settled.add(current.key);

    if (current.station === to) {
      goal = current;
      break;
    }

    for (const edge of graph.edgesFrom(current.station)) {
      const changing = current.line !== null && current.line !== edge.line;
      const next: Label = {
        key: stateKey(edge.to, edge.line),
        station: edge.to,
        line: edge.line,
        cost: current.cost + edge.minutes + (changing ? penalty : 0),
        interchanges: current.interchanges + (changing ? 1 : 0),
      };
      if (settled.has(next.key)) continue;
      const known = best.get(next.key);
      if (known && compareLabels(next, known) >= 0) continue;
      best.set(next.key, next);
      via.set(next.key, { edge, prev: current.key });
      heap.push(next);
    }
  }

  if (!goal) return null;

  const legs: Edge[] = [];
  for (let key = goal.key; key !== start.key;) {
    const step = via.get(key);
    if (!step) throw new Error("Internal error: broken route back-pointer");
    legs.push(step.edge);
    key = step.prev;
  }
  legs.reverse();

  return buildRoute(graph, from, to, legs);
}

/** Assembles a Route from its legs, grouping consecutive legs into rides. */
export function buildRoute(graph: Graph, from: StationId, to: StationId, legs: Edge[]): Route {
  const rides: Ride[] = [];
  for (const leg of legs) {
    const ride = rides.at(-1);
    if (ride && ride.line === leg.line && ride.direction === leg.direction) {
      ride.to = leg.to;
      ride.stops.push(leg.to);
      ride.minutes += leg.minutes;
    } else {
      rides.push({
        line: leg.line,
        direction: leg.direction,
        terminus: graph.terminus(leg.line, leg.direction, leg.from),
        from: leg.from,
        to: leg.to,
        stops: [leg.to],
        minutes: leg.minutes,
      });
    }
  }

  const lineChanges = rides.reduce(
    (count, ride, i) => (i > 0 && rides[i - 1]?.line !== ride.line ? count + 1 : count),
    0,
  );

  return {
    from,
    to,
    stations: [from, ...legs.map((leg) => leg.to)],
    legs,
    rides,
    travelMinutes: legs.reduce((sum, leg) => sum + leg.minutes, 0),
    interchanges: lineChanges,
  };
}
