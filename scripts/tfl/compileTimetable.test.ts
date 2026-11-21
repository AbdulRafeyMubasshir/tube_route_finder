import { compileTimetable, dayTypesFor } from "./compileTimetable";
import { compileNetwork } from "./compileNetwork";
import { stringifyCompact } from "./stringify";
import { tripsFromTimetable } from "./fetchSource";
import type { TflSource } from "./types";

const decode = (deltas: number[] = []) => {
  let t = 0;
  return deltas.map((d) => (t += d));
};

const source = (): TflSource => ({
  fetchedAt: "2026-01-01T00:00:00Z",
  lines: [
    { id: "victoria", name: "Victoria", mode: "tube" },
    { id: "weaver", name: "Weaver", mode: "overground" },
  ],
  stops: [
    { id: "A", name: "A Underground Station", placeId: "A", lat: 51.5, lon: -0.1, zone: "1" },
    { id: "B", name: "B Underground Station", placeId: "B", lat: 51.51, lon: -0.1, zone: "1" },
    { id: "C", name: "C Rail Station", placeId: "C", lat: 51.52, lon: -0.1, zone: "2" },
  ],
  places: [],
  patterns: [
    { line: "victoria", direction: "outbound", name: "A-B", stops: ["A", "B"] },
    { line: "victoria", direction: "inbound", name: "B-A", stops: ["B", "A"] },
    { line: "weaver", direction: "outbound", name: "B-C", stops: ["B", "C"] },
    { line: "weaver", direction: "inbound", name: "C-B", stops: ["C", "B"] },
  ],
  hops: [{ line: "victoria", from: "A", to: "B", minutes: 2, samples: 1 }],
  timetables: [
    {
      line: "victoria",
      direction: "outbound",
      origin: "A",
      routes: [
        { stops: ["A", "B"], times: [0, 2] },
        { stops: ["A", "B"], times: [0, 5] },
        { stops: ["A", "GHOST"], times: [0, 1] },
      ],
      schedules: [
        { name: "Monday - Friday", departures: [600, 610, 620, 630], routes: [0, 0, 1, 2] },
        { name: "Saturday (also Good Friday)", departures: [700], routes: [0] },
        { name: "Bank Holiday", departures: [800], routes: [0] },
      ],
    },
  ],
});

describe("dayTypesFor", () => {
  it("maps TfL schedule names to day types", () => {
    expect(dayTypesFor("Monday - Thursday")).toEqual(["weekday"]);
    expect(dayTypesFor("Monday - Friday")).toEqual(["weekday", "friday"]);
    expect(dayTypesFor("Friday")).toEqual(["friday"]);
    expect(dayTypesFor("Saturday (also Good Friday)")).toEqual(["saturday"]);
    expect(dayTypesFor("Saturdays and Public Holidays")).toEqual(["saturday"]);
    expect(dayTypesFor("Sunday")).toEqual(["sunday"]);
  });
});

describe("compileTimetable", () => {
  const compile = () => {
    const s = source();
    return compileTimetable(s, compileNetwork(s).network);
  };

  it("groups trips by route and day type, delta-encoded", () => {
    const { timetable } = compile();
    const fast = timetable.routes.find((r) => r.line === "victoria" && r.times[1] === 2);
    expect(decode(fast?.trips.weekday)).toEqual([600, 610]);
    expect(decode(fast?.trips.friday)).toEqual([600, 610]);
    expect(decode(fast?.trips.saturday)).toEqual([700]);
    expect(fast?.trips.sunday).toBeUndefined();
    const slow = timetable.routes.find((r) => r.line === "victoria" && r.times[1] === 5);
    expect(decode(slow?.trips.weekday)).toEqual([620]);
  });

  it("skips unknown stops, warns on unknown schedules, and synthesises untimetabled lines", () => {
    const { timetable, warnings, stats } = compile();
    expect(timetable.routes.some((r) => r.stops.includes("GHOST"))).toBe(false);
    expect(warnings).toContain('unrecognised schedule "Bank Holiday"');
    // Victoria inbound and both Weaver directions have no timetable.
    const synthetic = timetable.routes.filter((r) => r.estimated);
    expect(synthetic.map((r) => `${r.line}:${r.stops.join("-")}`).sort()).toEqual([
      "victoria:B-A",
      "weaver:B-C",
      "weaver:C-B",
    ]);
    const weaver = synthetic.find((r) => r.line === "weaver");
    const weekday = decode(weaver?.trips.weekday);
    expect(weekday[1]! - weekday[0]!).toBe(15);
    expect(stats.estimatedRoutes).toBe(3);
  });

  it("drops routes whose run times go backwards", () => {
    const s = source();
    s.timetables[0]!.routes[0] = { stops: ["A", "B"], times: [5, 2] };
    const { warnings } = compileTimetable(s, compileNetwork(s).network);
    expect(warnings.join("\n")).toMatch(/run times go backwards/);
  });
});

describe("tripsFromTimetable", () => {
  it("reads routes and departures per schedule", () => {
    const result = tripsFromTimetable("v", "outbound", "A", {
      timetable: {
        routes: [
          {
            stationIntervals: [
              { id: "0", intervals: [{ stopId: "B", timeToArrival: 2 }] },
              { id: "1", intervals: [{ stopId: "C", timeToArrival: 4 }] },
            ],
            schedules: [
              {
                name: "Sunday",
                knownJourneys: [
                  { hour: "25", minute: "05", intervalId: 1 },
                  { hour: "7", minute: "30", intervalId: 0 },
                  { hour: "8", minute: "00", intervalId: 9 },
                ],
              },
            ],
          },
        ],
      },
    });
    expect(result).toEqual({
      line: "v",
      direction: "outbound",
      origin: "A",
      routes: [
        { stops: ["A", "B"], times: [0, 2] },
        { stops: ["A", "C"], times: [0, 4] },
      ],
      schedules: [{ name: "Sunday", departures: [450, 1505], routes: [0, 1] }],
    });
    expect(tripsFromTimetable("v", "outbound", "A", {})).toBeNull();
  });
});

describe("stringifyCompact", () => {
  it("keeps numeric arrays on one line", () => {
    expect(stringifyCompact({ a: [1, 2.5, -3], b: ["x"] })).toBe(
      '{\n "a": [1,2.5,-3],\n "b": [\n  "x"\n ]\n}',
    );
  });
});
