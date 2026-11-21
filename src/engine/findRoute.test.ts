import fc from "fast-check";
import { Graph, UnknownStationError } from "./Graph";
import { findRoute } from "./findRoute";
import type { Edge, Network } from "./types";

/** Builds a network from bidirectional line segments: [line, stations, minutes per hop]. */
function makeNetwork(segments: [line: string, stations: string[], minutes: number][]): Network {
  const ids = new Set(segments.flatMap(([, stations]) => stations));
  const lines = new Set(segments.map(([line]) => line));
  const edges: Edge[] = [];
  for (const [line, stations, minutes] of segments) {
    for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i] as string;
      const b = stations[i + 1] as string;
      edges.push({ from: a, to: b, line, direction: "Out", minutes });
      edges.push({ from: b, to: a, line, direction: "Back", minutes });
    }
  }
  return {
    lines: [...lines].map((id) => ({ id, name: id, colour: "#000" })),
    stations: [...ids].map((id, i) => ({ id, name: id.toUpperCase(), x: i, y: 0 })),
    edges,
  };
}

describe("findRoute", () => {
  it("returns an empty route when origin and destination are the same", () => {
    const graph = new Graph(makeNetwork([["a", ["x", "y"], 1]]));
    expect(findRoute(graph, "x", "x")).toEqual({
      from: "x",
      to: "x",
      stations: ["x"],
      legs: [],
      rides: [],
      travelMinutes: 0,
      interchanges: 0,
    });
  });

  it("throws for unknown stations", () => {
    const graph = new Graph(makeNetwork([["a", ["x", "y"], 1]]));
    expect(() => findRoute(graph, "x", "nowhere")).toThrow(UnknownStationError);
    expect(() => findRoute(graph, "nowhere", "x")).toThrow(UnknownStationError);
  });

  it("rejects a negative or non-finite interchange penalty", () => {
    const graph = new Graph(makeNetwork([["a", ["x", "y"], 1]]));
    expect(() => findRoute(graph, "x", "y", { interchangePenalty: -1 })).toThrow(RangeError);
    expect(() => findRoute(graph, "x", "y", { interchangePenalty: Infinity })).toThrow(RangeError);
  });

  it("returns null when the destination is unreachable", () => {
    const graph = new Graph(
      makeNetwork([
        ["a", ["x", "y"], 1],
        ["b", ["p", "q"], 1],
      ]),
    );
    expect(findRoute(graph, "x", "q")).toBeNull();
  });

  it("chooses the faster of two paths", () => {
    const graph = new Graph(
      makeNetwork([
        ["slow", ["s", "m1", "t"], 2],
        ["fast", ["s", "m2", "t"], 1.5],
      ]),
    );
    const route = findRoute(graph, "s", "t");
    expect(route?.stations).toEqual(["s", "m2", "t"]);
    expect(route?.travelMinutes).toBeCloseTo(3);
  });

  it("reports the line actually used when two lines share a section", () => {
    // Regression: the original UI showed the first connection between two
    // stations, not the one the algorithm chose.
    const graph = new Graph(
      makeNetwork([
        ["slow", ["a", "b"], 5],
        ["fast", ["a", "b"], 2],
      ]),
    );
    const route = findRoute(graph, "a", "b");
    expect(route?.legs).toHaveLength(1);
    expect(route?.legs[0]?.line).toBe("fast");
    expect(route?.travelMinutes).toBe(2);
  });

  it("groups consecutive legs on one line into a single ride", () => {
    const graph = new Graph(
      makeNetwork([
        ["red", ["a", "b", "c"], 1],
        ["green", ["c", "d"], 1],
      ]),
    );
    const route = findRoute(graph, "a", "d");
    expect(route?.rides).toEqual([
      {
        line: "red",
        direction: "Out",
        terminus: "c",
        from: "a",
        to: "c",
        stops: ["b", "c"],
        minutes: 2,
      },
      {
        line: "green",
        direction: "Out",
        terminus: "d",
        from: "c",
        to: "d",
        stops: ["d"],
        minutes: 1,
      },
    ]);
    expect(route?.interchanges).toBe(1);
  });

  describe("interchange penalty", () => {
    // x -> z: red+green with one change takes 2 min; blue direct takes 3 min.
    const graph = new Graph(
      makeNetwork([
        ["red", ["x", "y"], 1],
        ["green", ["y", "z"], 1],
        ["blue", ["x", "w", "z"], 1.5],
      ]),
    );

    it("takes the fastest route when there is no penalty", () => {
      const route = findRoute(graph, "x", "z");
      expect(route?.stations).toEqual(["x", "y", "z"]);
      expect(route?.interchanges).toBe(1);
    });

    it("avoids a change when the penalty outweighs the time saved", () => {
      const route = findRoute(graph, "x", "z", { interchangePenalty: 2 });
      expect(route?.stations).toEqual(["x", "w", "z"]);
      expect(route?.interchanges).toBe(0);
      expect(route?.travelMinutes).toBeCloseTo(3);
    });
  });

  it("prefers fewer changes when two routes take the same time", () => {
    const graph = new Graph(
      makeNetwork([
        ["red", ["x", "y"], 1],
        ["green", ["y", "z"], 1],
        ["blue", ["x", "w", "z"], 1],
      ]),
    );
    const route = findRoute(graph, "x", "z");
    expect(route?.interchanges).toBe(0);
  });
});

describe("Graph.terminus", () => {
  it("follows a line to its end", () => {
    const graph = new Graph(makeNetwork([["a", ["p", "q", "r"], 1]]));
    expect(graph.terminus("a", "Out", "p")).toBe("r");
    expect(graph.terminus("a", "Back", "r")).toBe("p");
  });

  it("returns null on a loop", () => {
    const network = makeNetwork([["loop", ["p", "q", "r"], 1]]);
    network.edges.push({ from: "r", to: "p", line: "loop", direction: "Out", minutes: 1 });
    expect(new Graph(network).terminus("loop", "Out", "p")).toBeNull();
  });

  it("returns null where the line branches", () => {
    const network = makeNetwork([["a", ["p", "q", "r"], 1]]);
    network.stations.push({ id: "s", name: "S", x: 0, y: 0 });
    network.edges.push({ from: "q", to: "s", line: "a", direction: "Out", minutes: 1 });
    expect(new Graph(network).terminus("a", "Out", "p")).toBeNull();
  });

  it("rejects edges that reference unknown stations", () => {
    const network = makeNetwork([["a", ["p", "q"], 1]]);
    network.edges.push({ from: "q", to: "ghost", line: "a", direction: "Out", minutes: 1 });
    expect(() => new Graph(network)).toThrow(UnknownStationError);
  });
});

/**
 * Reference solver: Bellman-Ford over the same (station, line) state space.
 * Slow but simple enough to trust, so it serves as an oracle for Dijkstra.
 */
function referenceCost(network: Network, from: string, to: string, penalty: number): number {
  if (from === to) return 0;
  const cost = new Map<string, number>([[`${from}|`, 0]]);
  const stateCount = network.stations.length * (network.lines.length + 1);
  for (let i = 0; i < stateCount; i++) {
    let changed = false;
    for (const [key, c] of [...cost]) {
      const [station, line] = key.split("|");
      for (const e of network.edges.filter((edge) => edge.from === station)) {
        const next = c + e.minutes + (line && line !== e.line ? penalty : 0);
        const nextKey = `${e.to}|${e.line}`;
        if (next < (cost.get(nextKey) ?? Infinity) - 1e-9) {
          cost.set(nextKey, next);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  let best = Infinity;
  for (const [key, c] of cost) if (key.startsWith(`${to}|`)) best = Math.min(best, c);
  return best;
}

const randomNetwork = fc
  .record({
    stationCount: fc.integer({ min: 2, max: 8 }),
    lineCount: fc.integer({ min: 1, max: 3 }),
  })
  .chain(({ stationCount, lineCount }) =>
    fc.record({
      stationCount: fc.constant(stationCount),
      lineCount: fc.constant(lineCount),
      edges: fc.array(
        fc.record({
          from: fc.integer({ min: 0, max: stationCount - 1 }),
          to: fc.integer({ min: 0, max: stationCount - 1 }),
          line: fc.integer({ min: 0, max: lineCount - 1 }),
          minutes: fc.double({ min: 0.1, max: 10, noNaN: true }),
        }),
        { maxLength: 24 },
      ),
      from: fc.integer({ min: 0, max: stationCount - 1 }),
      to: fc.integer({ min: 0, max: stationCount - 1 }),
      penalty: fc.oneof(fc.constant(0), fc.double({ min: 0, max: 5, noNaN: true })),
    }),
  )
  .map(({ stationCount, lineCount, edges, from, to, penalty }) => {
    const network: Network = {
      lines: Array.from({ length: lineCount }, (_, i) => ({
        id: `L${i}`,
        name: `L${i}`,
        colour: "#000",
      })),
      stations: Array.from({ length: stationCount }, (_, i) => ({
        id: `S${i}`,
        name: `S${i}`,
        x: 0,
        y: 0,
      })),
      edges: edges
        .filter((e) => e.from !== e.to)
        .map((e) => ({
          from: `S${e.from}`,
          to: `S${e.to}`,
          line: `L${e.line}`,
          direction: "d",
          minutes: e.minutes,
        })),
    };
    return { network, from: `S${from}`, to: `S${to}`, penalty };
  });

describe("findRoute properties", () => {
  it("matches the reference solver's optimal cost on random networks", () => {
    fc.assert(
      fc.property(randomNetwork, ({ network, from, to, penalty }) => {
        const route = findRoute(new Graph(network), from, to, { interchangePenalty: penalty });
        const expected = referenceCost(network, from, to, penalty);
        if (expected === Infinity) {
          expect(route).toBeNull();
          return;
        }
        expect(route).not.toBeNull();
        const cost = (route?.travelMinutes ?? 0) + (route?.interchanges ?? 0) * penalty;
        expect(cost).toBeCloseTo(expected, 6);
      }),
      { numRuns: 500 },
    );
  });

  it("always returns a connected path made of real edges", () => {
    fc.assert(
      fc.property(randomNetwork, ({ network, from, to, penalty }) => {
        const route = findRoute(new Graph(network), from, to, { interchangePenalty: penalty });
        if (!route) return;
        expect(route.stations[0]).toBe(from);
        expect(route.stations.at(-1)).toBe(to);
        route.legs.forEach((leg, i) => {
          expect(network.edges).toContainEqual(leg);
          expect(leg.from).toBe(route.stations[i]);
          expect(leg.to).toBe(route.stations[i + 1]);
        });
        const rideMinutes = route.rides.reduce((sum, ride) => sum + ride.minutes, 0);
        expect(rideMinutes).toBeCloseTo(route.travelMinutes, 9);
      }),
      { numRuns: 500 },
    );
  });
});
