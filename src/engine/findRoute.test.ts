import fc from "fast-check";
import { Graph, UnknownStationError } from "./Graph";
import { DEFAULT_CHANGE_MINUTES, findRoute } from "./findRoute";
import { makeNetwork } from "./testNetwork";
import type { Network } from "./types";

/** Both directions of a line as two patterns. */
const both = (line: string, stops: string[], minutes: number): [string, string[], number][] => [
  [line, stops, minutes],
  [line, [...stops].reverse(), minutes],
];

describe("findRoute", () => {
  it("returns an empty route when origin and destination are the same", () => {
    const graph = new Graph(makeNetwork(both("a", ["x", "y"], 1)));
    const route = findRoute(graph, "x", "x");
    expect(route).toMatchObject({
      segments: [],
      interchanges: 0,
      totalMinutes: 0,
      stations: ["x"],
    });
  });

  it("throws for unknown places", () => {
    const graph = new Graph(makeNetwork(both("a", ["x", "y"], 1)));
    expect(() => findRoute(graph, "x", "nowhere")).toThrow(UnknownStationError);
    expect(() => findRoute(graph, "nowhere", "x")).toThrow(UnknownStationError);
  });

  it("rejects negative or non-finite options", () => {
    const graph = new Graph(makeNetwork(both("a", ["x", "y"], 1)));
    expect(() => findRoute(graph, "x", "y", { changePenalty: -1 })).toThrow(RangeError);
    expect(() => findRoute(graph, "x", "y", { changeMinutes: Infinity })).toThrow(RangeError);
  });

  it("returns null when the destination is unreachable", () => {
    const graph = new Graph(
      makeNetwork([...both("a", ["x", "y"], 1), ...both("b", ["p", "q"], 1)]),
    );
    expect(findRoute(graph, "x", "q")).toBeNull();
  });

  it("respects direction: one-way patterns can't be ridden backwards", () => {
    const graph = new Graph(makeNetwork([["a", ["x", "y"], 1]]));
    expect(findRoute(graph, "x", "y")).not.toBeNull();
    expect(findRoute(graph, "y", "x")).toBeNull();
  });

  it("chooses the faster of two paths", () => {
    const graph = new Graph(
      makeNetwork([...both("slow", ["s", "m1", "t"], 2), ...both("fast", ["s", "m2", "t"], 1.5)]),
    );
    const route = findRoute(graph, "s", "t");
    expect(route?.stations).toEqual(["s", "m2", "t"]);
    expect(route?.totalMinutes).toBeCloseTo(3);
  });

  it("reports the line actually used when two lines share a section", () => {
    const graph = new Graph(
      makeNetwork([...both("slow", ["a", "b"], 5), ...both("fast", ["a", "b"], 2)]),
    );
    const route = findRoute(graph, "a", "b");
    expect(route?.segments).toHaveLength(1);
    expect(route?.segments[0]).toMatchObject({ kind: "ride", line: "fast", minutes: 2 });
  });

  it("groups hops on one train into a ride and counts the change allowance", () => {
    const graph = new Graph(
      makeNetwork([...both("red", ["a", "b", "c"], 1), ...both("green", ["c", "d"], 1)]),
    );
    const route = findRoute(graph, "a", "d");
    expect(route?.segments).toEqual([
      {
        kind: "ride",
        line: "red",
        from: "a",
        to: "c",
        stops: ["b", "c"],
        towards: ["c"],
        minutes: 2,
        estimated: false,
      },
      {
        kind: "ride",
        line: "green",
        from: "c",
        to: "d",
        stops: ["d"],
        towards: ["d"],
        minutes: 1,
        estimated: false,
      },
    ]);
    expect(route).toMatchObject({
      interchanges: 1,
      rideMinutes: 3,
      changeMinutes: DEFAULT_CHANGE_MINUTES,
      totalMinutes: 3 + DEFAULT_CHANGE_MINUTES,
    });
  });

  it("treats switching between branches of one line as a change", () => {
    // Like the Northern line: two patterns meet at j. Getting from x to w means
    // leaving the x->y train at j and boarding the z->w train.
    const graph = new Graph(
      makeNetwork([
        ["n", ["x", "j", "y"], 1],
        ["n", ["z", "j", "w"], 1],
      ]),
    );
    const route = findRoute(graph, "x", "w");
    expect(route?.interchanges).toBe(1);
    expect(route?.segments.map((s) => s.kind === "ride" && s.towards)).toEqual([["y"], ["w"]]);
  });

  it("stays on one train through a shared section and lists every usable terminus", () => {
    const graph = new Graph(
      makeNetwork([
        ["n", ["a", "b", "c", "d"], 1],
        ["n", ["a", "b", "c", "e"], 1],
      ]),
    );
    expect(findRoute(graph, "a", "d")?.interchanges).toBe(0);
    const route = findRoute(graph, "a", "c");
    expect(route?.segments[0]).toMatchObject({ kind: "ride", towards: ["d", "e"] });
  });

  it("walks between stations and counts boarding after a walk as a change", () => {
    const graph = new Graph(
      makeNetwork([...both("red", ["a", "b"], 2), ...both("blue", ["c", "d"], 2)], {
        walks: [
          { from: "b", to: "c", minutes: 4 },
          { from: "c", to: "b", minutes: 4 },
        ],
      }),
    );
    const route = findRoute(graph, "a", "d", { changeMinutes: 1 });
    expect(route?.segments.map((s) => s.kind)).toEqual(["ride", "walk", "ride"]);
    expect(route).toMatchObject({ interchanges: 1, walkMinutes: 4, totalMinutes: 2 + 4 + 2 + 1 });
  });

  it("starts from whichever station in the origin place is best", () => {
    const graph = new Graph(
      makeNetwork([...both("slow", ["o1", "t"], 10), ...both("fast", ["o2", "t"], 2)], {
        places: { origin: ["o1", "o2"] },
      }),
    );
    const route = findRoute(graph, "origin", "t");
    expect(route?.stations).toEqual(["o2", "t"]);
    expect(route?.walkMinutes).toBe(0);
  });

  describe("change penalty", () => {
    // x -> z: red then green takes 2 min plus a change; blue direct takes 3 min.
    const graph = new Graph(
      makeNetwork([
        ...both("red", ["x", "y"], 1),
        ...both("green", ["y", "z"], 1),
        ...both("blue", ["x", "w", "z"], 1.5),
      ]),
    );

    it("takes the fastest route when changes are quick", () => {
      const route = findRoute(graph, "x", "z", { changeMinutes: 0.5 });
      expect(route?.stations).toEqual(["x", "y", "z"]);
      expect(route?.totalMinutes).toBeCloseTo(2.5);
    });

    it("avoids a change when the penalty outweighs the time saved", () => {
      const route = findRoute(graph, "x", "z", { changeMinutes: 0.5, changePenalty: 2 });
      expect(route?.stations).toEqual(["x", "w", "z"]);
      expect(route?.interchanges).toBe(0);
      // The penalty steers the choice but is not added to the journey time.
      expect(route?.totalMinutes).toBeCloseTo(3);
    });
  });

  it("prefers fewer changes when two routes cost the same", () => {
    const graph = new Graph(
      makeNetwork([
        ...both("red", ["x", "y"], 1),
        ...both("green", ["y", "z"], 1),
        ...both("blue", ["x", "w", "z"], 1),
      ]),
    );
    expect(findRoute(graph, "x", "z", { changeMinutes: 0 })?.interchanges).toBe(0);
  });
});

describe("findRoute with live conditions", () => {
  const graph = new Graph(
    makeNetwork([...both("red", ["a", "b", "c"], 2), ...both("blue", ["a", "c"], 10)]),
  );

  it("routes around a closed section", () => {
    const conditions = { closedHops: new Set(["red|b|c", "red|c|b"]), delayFactor: new Map() };
    const route = findRoute(graph, "a", "c", { conditions });
    expect(route?.segments).toMatchObject([{ kind: "ride", line: "blue" }]);
    expect(findRoute(graph, "a", "b", { conditions })?.segments).toMatchObject([{ line: "red" }]);
  });

  it("stretches run times on delayed lines and reports the delayed times", () => {
    const conditions = { closedHops: new Set<string>(), delayFactor: new Map([["red", 3]]) };
    const route = findRoute(graph, "a", "c", { conditions });
    expect(route?.segments).toMatchObject([{ line: "blue", minutes: 10 }]);
    const viaRed = findRoute(graph, "a", "b", { conditions });
    expect(viaRed?.totalMinutes).toBe(6);
  });

  it("returns null when every route is closed", () => {
    const conditions = {
      closedHops: new Set(["red|a|b", "blue|a|c"]),
      delayFactor: new Map(),
    };
    expect(findRoute(graph, "a", "c", { conditions })).toBeNull();
  });
});

describe("Graph", () => {
  it("rejects patterns that reference unknown stations", () => {
    const network = makeNetwork(both("a", ["p", "q"], 1));
    network.patterns.push({ id: "ghost", line: "a", stops: ["q", "ghost"] });
    expect(() => new Graph(network)).toThrow(UnknownStationError);
  });

  it("rejects patterns with no run time for a hop", () => {
    const network = makeNetwork(both("a", ["p", "q"], 1));
    network.hops = [];
    expect(() => new Graph(network)).toThrow(/No run time/);
  });

  it("looks up places and stations", () => {
    const graph = new Graph(makeNetwork(both("a", ["p", "q"], 1)));
    expect(graph.place("p").stations).toEqual(["p"]);
    expect(() => graph.place("nope")).toThrow(UnknownStationError);
    expect(graph.edgesFrom("nope")).toEqual([]);
  });
});

// ---- Property-based tests against a reference solver -----------------------

/**
 * Reference solver: Bellman-Ford over the same states and transition rules
 * (start / platform / on a pattern), written as plainly as possible. Slow, but simple enough to
 * trust, so it serves as an oracle for the Dijkstra implementation.
 */
function referenceCost(network: Network, from: string, to: string, changeCost: number): number {
  const graph = new Graph(network);
  const origin = graph.place(from).stations;
  const targets = new Set(graph.place(to).stations);
  if (from === to) return 0;
  // States: "station|start", "station|platform" or "station|pattern:<id>".
  const cost = new Map<string, number>(origin.map((s) => [`${s}|start`, 0]));
  const update = (key: string, value: number) => {
    if (value < (cost.get(key) ?? Infinity) - 1e-9) {
      cost.set(key, value);
      return true;
    }
    return false;
  };
  for (let round = 0; round < 1000; round++) {
    let changed = false;
    for (const [key, c] of [...cost]) {
      const [station, mode] = key.split("|") as [string, string];
      for (const e of graph.edgesFrom(station)) {
        if (mode === "start" || mode === "platform") {
          if (e.kind === "walk") changed = update(`${e.to}|${mode}`, c + e.minutes) || changed;
          else {
            const extra = mode === "platform" ? changeCost : 0;
            changed = update(`${e.to}|pattern:${e.pattern}`, c + e.minutes + extra) || changed;
          }
        } else if (e.kind === "ride" && mode === `pattern:${e.pattern}`) {
          changed = update(`${e.to}|${mode}`, c + e.minutes) || changed;
        }
      }
      if (mode.startsWith("pattern:")) changed = update(`${station}|platform`, c) || changed;
    }
    if (!changed) break;
  }
  let best = Infinity;
  for (const [key, c] of cost)
    if (targets.has(key.split("|")[0] as string)) best = Math.min(best, c);
  return best;
}

const randomCase = fc
  .integer({ min: 2, max: 7 })
  .chain((stationCount) => {
    const station = fc.integer({ min: 0, max: stationCount - 1 }).map((i) => `s${i}`);
    return fc.record({
      patterns: fc.array(
        fc.tuple(
          fc.constantFrom("L0", "L1", "L2"),
          fc.uniqueArray(station, { minLength: 2, maxLength: 5 }),
          fc.double({ min: 0.1, max: 10, noNaN: true }),
        ),
        { minLength: 1, maxLength: 6 },
      ),
      walks: fc.array(
        fc.record({
          from: station,
          to: station,
          minutes: fc.double({ min: 0.5, max: 8, noNaN: true }),
        }),
        { maxLength: 4 },
      ),
      from: station,
      to: station,
      changeMinutes: fc.double({ min: 0, max: 5, noNaN: true }),
      changePenalty: fc.oneof(fc.constant(0), fc.double({ min: 0, max: 5, noNaN: true })),
    });
  })
  .map(({ patterns, walks, ...rest }) => {
    const network = makeNetwork(patterns, { walks: walks.filter((w) => w.from !== w.to) });
    return { network, ...rest };
  })
  .filter(({ network, from, to }) => {
    const ids = new Set(network.stations.map((s) => s.id));
    return ids.has(from) && ids.has(to);
  });

describe("findRoute properties", () => {
  it("matches the reference solver's optimal cost on random networks", () => {
    fc.assert(
      fc.property(randomCase, ({ network, from, to, changeMinutes, changePenalty }) => {
        const route = findRoute(new Graph(network), from, to, { changeMinutes, changePenalty });
        const expected = referenceCost(network, from, to, changeMinutes + changePenalty);
        if (expected === Infinity) {
          expect(route).toBeNull();
          return;
        }
        expect(route).not.toBeNull();
        const cost = (route?.totalMinutes ?? 0) + (route?.interchanges ?? 0) * changePenalty;
        expect(cost).toBeCloseTo(expected, 6);
      }),
      { numRuns: 400 },
    );
  });

  it("always returns a connected path made of real edges with consistent totals", () => {
    fc.assert(
      fc.property(randomCase, ({ network, from, to, changeMinutes, changePenalty }) => {
        const graph = new Graph(network);
        const route = findRoute(graph, from, to, { changeMinutes, changePenalty });
        if (!route) return;
        expect(graph.place(from).stations).toContain(route.stations[0]);
        expect(graph.place(to).stations).toContain(route.stations.at(-1));
        route.edges.forEach((edge, i) => {
          expect(graph.edges).toContain(edge);
          expect(edge.from).toBe(route.stations[i]);
          expect(edge.to).toBe(route.stations[i + 1]);
        });
        const segmentMinutes = route.segments.reduce((sum, s) => sum + s.minutes, 0);
        expect(segmentMinutes + route.changeMinutes).toBeCloseTo(route.totalMinutes, 9);
        const rides = route.segments.filter((s) => s.kind === "ride").length;
        expect(route.interchanges).toBe(Math.max(0, rides - 1));
      }),
      { numRuns: 400 },
    );
  });
});
