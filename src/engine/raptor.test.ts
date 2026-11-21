import fc from "fast-check";
import { Graph } from "./Graph";
import { DAY_TYPES, Timetable, planJourneys, type TimetableData } from "./raptor";
import { makeNetwork } from "./testNetwork";
import type { Network, Walk } from "./types";

type RouteSpec = { line: string; stops: string[]; times: number[]; departures: number[] };

/** Builds a graph and timetable where every day type has the same departures. */
function setup(routes: RouteSpec[], walks: Walk[] = []) {
  const network: Network = makeNetwork(
    routes.map((r) => [r.line, r.stops, 1]),
    { walks },
  );
  const graph = new Graph(network);
  const data: TimetableData = {
    routes: routes.map((r) => {
      const sorted = [...r.departures].sort((a, b) => a - b);
      const deltas = sorted.map((t, i) => t - (i ? (sorted[i - 1] as number) : 0));
      return {
        line: r.line,
        stops: r.stops,
        times: r.times,
        trips: Object.fromEntries(DAY_TYPES.map((d) => [d, deltas])),
      };
    }),
  };
  return { graph, timetable: new Timetable(graph, data) };
}

const plan = (t: Timetable, from: string, to: string, departAt: number, changeMinutes = 2) =>
  planJourneys(t, from, to, { departAt, day: "weekday", changeMinutes });

describe("planJourneys (RAPTOR)", () => {
  it("waits for the next train and reports clock times", () => {
    const { timetable } = setup([
      { line: "red", stops: ["a", "b", "c"], times: [0, 4, 10], departures: [600, 610, 620] },
    ]);
    const [journey] = plan(timetable, "a", "c", 603);
    expect(journey).toMatchObject({
      departure: 610,
      arrival: 620,
      totalMinutes: 10,
      interchanges: 0,
    });
    expect(journey?.times).toEqual([{ start: 610, end: 620 }]);
    expect(journey?.segments[0]).toMatchObject({ kind: "ride", line: "red", stops: ["b", "c"] });
  });

  it("returns nothing after the last train", () => {
    const { timetable } = setup([
      { line: "red", stops: ["a", "b"], times: [0, 5], departures: [600] },
    ]);
    expect(plan(timetable, "a", "b", 601)).toEqual([]);
    expect(plan(timetable, "a", "a", 600)).toEqual([]);
  });

  it("respects the minimum change time", () => {
    const { timetable } = setup([
      { line: "red", stops: ["a", "b"], times: [0, 5], departures: [600] },
      // Departs b at 606 and 615. Arriving at 605 with a 2-minute change catches 615, not 606.
      { line: "blue", stops: ["b", "c"], times: [0, 5], departures: [606, 615] },
    ]);
    const [journey] = plan(timetable, "a", "c", 600);
    expect(journey?.arrival).toBe(620);
    expect(plan(timetable, "a", "c", 600, 0)[0]?.arrival).toBe(611);
  });

  it("returns the Pareto set of arrival time against changes", () => {
    const { timetable } = setup([
      { line: "slow", stops: ["a", "z"], times: [0, 30], departures: [600] },
      { line: "red", stops: ["a", "m"], times: [0, 5], departures: [600] },
      { line: "blue", stops: ["m", "z"], times: [0, 5], departures: [610] },
    ]);
    const journeys = plan(timetable, "a", "z", 600);
    expect(journeys.map((j) => [j.interchanges, j.arrival])).toEqual([
      [0, 630],
      [1, 615],
    ]);
  });

  it("walks between stations, including walk-only journeys", () => {
    const { timetable } = setup(
      [
        { line: "red", stops: ["a", "b"], times: [0, 5], departures: [600] },
        { line: "blue", stops: ["c", "d"], times: [0, 5], departures: [610] },
      ],
      [
        { from: "b", to: "c", minutes: 3 },
        { from: "d", to: "e", minutes: 4 },
      ],
    );
    const [journey] = plan(timetable, "a", "e", 600);
    expect(journey?.segments.map((s) => s.kind)).toEqual(["ride", "walk", "ride", "walk"]);
    expect(journey?.times).toEqual([
      { start: 600, end: 605 },
      { start: 605, end: 608 },
      { start: 610, end: 615 },
      { start: 615, end: 619 },
    ]);
    expect(journey?.arrival).toBe(619);

    const [walkOnly] = plan(timetable, "d", "e", 700);
    expect(walkOnly).toMatchObject({ interchanges: 0, arrival: 704, segments: [{ kind: "walk" }] });
  });

  it("boards an earlier trip further along the route when one becomes reachable", () => {
    const { timetable } = setup([
      { line: "feeder", stops: ["a", "b"], times: [0, 1], departures: [600] },
      // Origin x: 600 and 630 trips; reaching b at 601 (+2 change) catches the 600 trip at b (605).
      { line: "main", stops: ["x", "b", "z"], times: [0, 5, 10], departures: [600, 630] },
    ]);
    expect(plan(timetable, "a", "z", 600)[0]?.arrival).toBe(610);
  });

  it("lets you walk on from a stop reached by train, even if walking there was as quick", () => {
    // Regression found by the property test: walks can't chain, so the train
    // arrival at m matters even though the walk to m is just as fast.
    const { timetable } = setup(
      [{ line: "red", stops: ["a", "m"], times: [0, 1], departures: [0] }],
      [
        { from: "a", to: "m", minutes: 1 },
        { from: "m", to: "z", minutes: 1 },
      ],
    );
    expect(plan(timetable, "a", "z", 0, 0)[0]?.arrival).toBe(2);
  });

  it("doesn't chain walks through a stop whose arrival improved by walking", () => {
    // Regression: the walk m->x improved x, which must not then be walked from in the same round.
    const { timetable } = setup(
      [{ line: "red", stops: ["a", "m", "x"], times: [0, 1, 6], departures: [0] }],
      [
        { from: "m", to: "x", minutes: 1 },
        { from: "x", to: "z", minutes: 1 },
      ],
    );
    expect(plan(timetable, "a", "z", 0, 0)[0]?.arrival).toBe(7);
  });

  it("rebuilds a walk from the train arrival it started from, not a walk-improved one", () => {
    // Regression: x was reached by train at 10 and by walking at 2. The walk
    // x->z started from the train arrival, so the journey must not show a
    // chain of two walks.
    const { timetable } = setup(
      [{ line: "red", stops: ["a", "m", "x"], times: [0, 1, 10], departures: [0] }],
      [
        { from: "m", to: "x", minutes: 1 },
        { from: "x", to: "z", minutes: 1 },
      ],
    );
    const [journey] = plan(timetable, "a", "z", 0, 0);
    expect(journey?.segments.map((s) => `${s.kind}:${s.from}-${s.to}`)).toEqual([
      "ride:a-x",
      "walk:x-z",
    ]);
    expect(journey?.times.at(-1)?.end).toBe(11);
  });

  it("avoids closed sections and slows delayed lines", () => {
    const { timetable } = setup([
      { line: "red", stops: ["a", "b", "c"], times: [0, 5, 10], departures: [600] },
      { line: "blue", stops: ["a", "c"], times: [0, 20], departures: [600] },
    ]);
    const normal = plan(timetable, "a", "c", 600);
    expect(normal.at(-1)?.arrival).toBe(610);

    const closed = {
      closedHops: new Set(["red|b|c", "red|c|b"]),
      delayFactor: new Map([["blue", 1.5]]),
    };
    const [rerouted] = planJourneys(timetable, "a", "c", {
      departAt: 600,
      day: "weekday",
      conditions: closed,
    });
    expect(rerouted?.segments).toMatchObject([{ kind: "ride", line: "blue", minutes: 30 }]);
    expect(rerouted?.arrival).toBe(630);
    // The open part of the red line still works.
    expect(
      planJourneys(timetable, "a", "b", { departAt: 600, day: "weekday", conditions: closed })[0]
        ?.arrival,
    ).toBe(605);
  });

  it("rejects timetables with unknown stations", () => {
    const graph = new Graph(makeNetwork([["red", ["a", "b"], 1]]));
    expect(
      () =>
        new Timetable(graph, {
          routes: [{ line: "red", stops: ["a", "ghost"], times: [0, 1], trips: {} }],
        }),
    ).toThrow(/unknown station/);
  });
});

// ---- Property test against a simple time-dependent Dijkstra -----------------

/**
 * Earliest arrival by a plain time-dependent Dijkstra over states "at a
 * station (start | platform, and whether we just walked)" and "on trip t at
 * position i". Unlimited trains. Like RAPTOR, walks don't chain: the pipeline
 * makes walking links transitively closed instead.
 */
function referenceArrival(
  routes: RouteSpec[],
  walks: Walk[],
  from: string,
  to: string,
  t0: number,
  change: number,
) {
  const best = new Map<string, number>([[`${from}|start`, t0]]);
  const queue: [string, number][] = [[`${from}|start`, t0]];
  const settled = new Set<string>();
  let result = Infinity;
  while (queue.length) {
    queue.sort((a, b) => a[1] - b[1]);
    const [key, t] = queue.shift() as [string, number];
    if (settled.has(key)) continue;
    settled.add(key);
    const push = (k: string, time: number) => {
      if (time < (best.get(k) ?? Infinity)) {
        best.set(k, time);
        queue.push([k, time]);
      }
    };
    const parts = key.split("|");
    if (parts[0] === "trip") {
      const [, r, d, i] = parts.map(Number) as [number, number, number, number];
      const route = routes[r] as RouteSpec;
      const station = route.stops[i] as string;
      if (station === to) result = Math.min(result, t);
      push(`${station}|platform`, t);
      if (i + 1 < route.stops.length) {
        push(
          `trip|${r}|${d}|${i + 1}`,
          (route.departures[d] as number) + (route.times[i + 1] as number),
        );
      }
      continue;
    }
    const [station, mode, walked] = parts as [string, string, string | undefined];
    if (station === to) result = Math.min(result, t);
    const ready = t + (mode === "platform" ? change : 0);
    routes.forEach((route, r) => {
      route.stops.forEach((s, i) => {
        if (s !== station || i === route.stops.length - 1) return;
        // Boarding goes straight to the next stop, so you can't "alight" where you boarded.
        route.departures.forEach((dep, d) => {
          if (dep + (route.times[i] as number) >= ready) {
            push(`trip|${r}|${d}|${i + 1}`, dep + (route.times[i + 1] as number));
          }
        });
      });
    });
    if (!walked)
      for (const w of walks) if (w.from === station) push(`${w.to}|${mode}|walked`, t + w.minutes);
  }
  return result;
}

const randomTimetable = fc.integer({ min: 2, max: 6 }).chain((n) => {
  const station = fc.integer({ min: 0, max: n - 1 }).map((i) => `s${i}`);
  return fc.record({
    routes: fc
      .array(
        fc
          .tuple(
            fc.uniqueArray(station, { minLength: 2, maxLength: 4 }),
            fc.array(fc.integer({ min: 1, max: 9 }), { minLength: 3, maxLength: 3 }),
            fc.uniqueArray(fc.integer({ min: 0, max: 60 }), { minLength: 1, maxLength: 4 }),
          )
          .map(([stops, gaps, departures]) => ({
            stops,
            times: stops.map((_, j) => gaps.slice(0, j).reduce((a, b) => a + b, 0)),
            departures,
          })),
        { minLength: 1, maxLength: 5 },
      )
      .map((list) => list.map((r, i) => ({ ...r, line: `L${i}` }))),
    walks: fc.array(
      fc.record({ from: station, to: station, minutes: fc.integer({ min: 1, max: 10 }) }),
      {
        maxLength: 3,
      },
    ),
    from: station,
    to: station,
    t0: fc.integer({ min: 0, max: 40 }),
    change: fc.integer({ min: 0, max: 4 }),
  });
});

describe("planJourneys properties", () => {
  it("finds the same earliest arrival as a time-dependent Dijkstra, with a valid Pareto front", () => {
    fc.assert(
      fc.property(randomTimetable, ({ routes, walks, from, to, t0, change }) => {
        const usedWalks = walks.filter((w) => w.from !== w.to);
        const { graph, timetable } = setup(routes, usedWalks);
        if (!graph.places.has(from) || !graph.places.has(to) || from === to) return;
        const journeys = planJourneys(timetable, from, to, {
          departAt: t0,
          day: "weekday",
          changeMinutes: change,
          maxTrains: 10,
        });
        const expected = referenceArrival(routes, usedWalks, from, to, t0, change);
        const earliest = journeys.at(-1)?.arrival ?? Infinity;
        expect(earliest).toBe(expected);

        // Each extra train must buy a strictly earlier arrival.
        const trains = (j: (typeof journeys)[number]) =>
          j.segments.filter((s) => s.kind === "ride").length;
        for (let i = 1; i < journeys.length; i++) {
          expect(trains(journeys[i]!)).toBeGreaterThan(trains(journeys[i - 1]!));
          expect(journeys[i]!.arrival).toBeLessThan(journeys[i - 1]!.arrival);
        }
        for (const j of journeys) {
          expect(j.departure).toBeGreaterThanOrEqual(t0);
          j.times.forEach((t, i) => {
            expect(t.end).toBeGreaterThanOrEqual(t.start);
            if (i > 0) expect(t.start).toBeGreaterThanOrEqual(j.times[i - 1]!.end);
          });
          expect(j.times.at(-1)?.end).toBe(j.arrival);
        }
      }),
      { numRuns: 1000 },
    );
  });
});
