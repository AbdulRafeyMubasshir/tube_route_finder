import { aggregateHops, fetchSource, hopSamplesFromTimetable, resolveStops } from "./fetchSource";
import type { SourceStop } from "./types";

describe("hopSamplesFromTimetable", () => {
  it("turns cumulative arrival times into per-hop run times", () => {
    const samples = hopSamplesFromTimetable("A", {
      timetable: {
        routes: [
          {
            stationIntervals: [
              {
                intervals: [
                  { stopId: "B", timeToArrival: 2 },
                  { stopId: "C", timeToArrival: 5 },
                ],
              },
              { intervals: [{ stopId: "B", timeToArrival: 3 }] },
            ],
          },
        ],
      },
    });
    expect(samples).toEqual([
      { from: "A", to: "B", minutes: 2 },
      { from: "B", to: "C", minutes: 3 },
      { from: "A", to: "B", minutes: 3 },
    ]);
  });

  it("skips intervals that go backwards and tolerates empty timetables", () => {
    expect(
      hopSamplesFromTimetable("A", {
        timetable: {
          routes: [{ stationIntervals: [{ intervals: [{ stopId: "B", timeToArrival: -1 }] }] }],
        },
      }),
    ).toEqual([]);
    expect(hopSamplesFromTimetable("A", {})).toEqual([]);
  });
});

describe("aggregateHops", () => {
  it("averages samples per line and hop", () => {
    expect(
      aggregateHops([
        { line: "x", from: "A", to: "B", minutes: 2 },
        { line: "x", from: "A", to: "B", minutes: 3 },
        { line: "y", from: "A", to: "B", minutes: 1 },
      ]),
    ).toEqual([
      { line: "x", from: "A", to: "B", minutes: 2.5, samples: 2 },
      { line: "y", from: "A", to: "B", minutes: 1, samples: 1 },
    ]);
  });
});

/** A fake TfL API answering from a fixed table of paths. */
function fakeApi(responses: Record<string, unknown>) {
  const calls: string[] = [];
  const get = async (path: string) => {
    calls.push(path);
    return path in responses ? responses[path] : null;
  };
  return { get, calls };
}

const hub = {
  naptanId: "HUB1",
  commonName: "Interchange",
  stopType: "TransportInterchange",
  lat: 51.5,
  lon: -0.1,
  children: [
    {
      naptanId: "S1",
      commonName: "Interchange Underground Station",
      lat: 51.5,
      lon: -0.1,
      additionalProperties: [{ key: "Zone", value: "1" }],
    },
    { naptanId: "BUS", commonName: "Interchange / Bus", lat: 51.5, lon: -0.1 },
  ],
};

describe("resolveStops", () => {
  it("replaces hub entries with the stations inside them", async () => {
    const stops = new Map<string, SourceStop>([
      [
        "HUB1",
        { id: "HUB1", name: "Interchange", placeId: "HUB1", lat: 51.5, lon: -0.1, zone: "1" },
      ],
      [
        "S2",
        {
          id: "S2",
          name: "Other Underground Station",
          placeId: "S2",
          lat: 51.6,
          lon: -0.2,
          zone: "2",
        },
      ],
    ]);
    const { get } = fakeApi({ "/StopPoint/HUB1": hub });
    const places = await resolveStops(
      stops,
      [{ line: "l", direction: "outbound", name: "p", stops: ["S1", "S2"] }],
      get,
    );

    expect([...stops.keys()].sort()).toEqual(["S1", "S2"]);
    expect(stops.get("S1")).toMatchObject({ placeId: "HUB1", zone: "1" });
    expect(places).toEqual([
      { id: "HUB1", name: "Interchange" },
      { id: "S2", name: "Other Underground Station" },
    ]);
  });

  it("looks up stops that are still missing and reports any it can't find", async () => {
    const stops = new Map<string, SourceStop>();
    const log: string[] = [];
    const { get } = fakeApi({ "/StopPoint/S1,GHOST": [hub] });
    await resolveStops(
      stops,
      [{ line: "l", direction: "outbound", name: "p", stops: ["S1", "GHOST"] }],
      get,
      (m) => log.push(m),
    );
    expect(stops.has("S1")).toBe(true);
    expect(log.join("\n")).toMatch(/unresolved stops: GHOST/);
  });
});

describe("fetchSource", () => {
  it("assembles lines, patterns, stops and timetabled hops", async () => {
    const { get, calls } = fakeApi({
      "/Line/Mode/tube,dlr,elizabeth-line,overground": [
        { id: "red", name: "Red", modeName: "tube" },
        { id: "rail", name: "Rail", modeName: "overground" },
      ],
      "/Line/red/Route/Sequence/outbound": {
        stations: [
          {
            id: "A",
            name: "A Underground Station",
            lat: 51.5,
            lon: -0.1,
            topMostParentId: "A",
            zone: "1",
          },
          { id: "B", name: "B Underground Station", lat: 51.51, lon: -0.1, zone: "1" },
        ],
        orderedLineRoutes: [{ name: "A &harr; B", naptanIds: ["A", "B"] }],
      },
      "/Line/red/Timetable/A?direction=outbound": {
        timetable: {
          routes: [{ stationIntervals: [{ intervals: [{ stopId: "B", timeToArrival: 2 }] }] }],
        },
      },
      "/Line/rail/Route/Sequence/outbound": {
        stations: [{ id: "C", name: "C Rail Station", lat: 51.52, lon: -0.1 }],
        orderedLineRoutes: [{ name: "B &harr; C", naptanIds: ["B", "C"] }],
      },
    });
    const source = await fetchSource(get);

    expect(source.lines.map((l) => l.id)).toEqual(["rail", "red"]);
    expect(source.patterns).toEqual([
      { line: "rail", direction: "outbound", name: "B ↔ C", stops: ["B", "C"] },
      { line: "red", direction: "outbound", name: "A ↔ B", stops: ["A", "B"] },
    ]);
    expect(source.hops).toEqual([{ line: "red", from: "A", to: "B", minutes: 2, samples: 1 }]);
    expect(source.stops.map((s) => s.id)).toEqual(["A", "B", "C"]);
    // No timetable request for a mode that doesn't publish them.
    expect(calls.some((c) => c.startsWith("/Line/rail/Timetable"))).toBe(false);
  });
});
