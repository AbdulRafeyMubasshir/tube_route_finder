import { Graph } from "../engine";
import { DAY_TYPES, Timetable, type Journey } from "../engine/raptor";
import { makeNetwork } from "../engine/testNetwork";
import {
  dayTypeOf,
  formatClock,
  londonNow,
  paretoFront,
  parseClock,
  planAcrossServiceDays,
} from "./serviceTime";

describe("clock helpers", () => {
  it("formats and parses times", () => {
    expect(formatClock(9 * 60 + 5)).toBe("09:05");
    expect(formatClock(24 * 60 + 30)).toBe("00:30 (+1)");
    expect(formatClock(-30)).toBe("23:30");
    expect(parseClock("07:45")).toBe(465);
    expect(parseClock("25:00")).toBeNull();
    expect(parseClock("soon")).toBeNull();
  });

  it("maps weekdays to timetable day types", () => {
    expect(["mon", "thu", "fri", "sat", "sun"].map((d) => dayTypeOf(d as never))).toEqual([
      "weekday",
      "weekday",
      "friday",
      "saturday",
      "sunday",
    ]);
  });

  it("reads London time across daylight saving", () => {
    expect(londonNow(new Date("2026-07-06T08:00:00Z"))).toEqual({ weekday: "mon", minutes: 540 });
    expect(londonNow(new Date("2026-12-07T08:00:00Z"))).toEqual({ weekday: "mon", minutes: 480 });
  });
});

describe("paretoFront", () => {
  const j = (rides: number, arrival: number) =>
    ({
      arrival,
      segments: Array.from({ length: rides }, () => ({ kind: "ride" })),
    }) as unknown as Journey;
  it("keeps only options where more trains arrive earlier", () => {
    const front = paretoFront([j(2, 100), j(1, 110), j(1, 105), j(3, 100), j(3, 90)]);
    expect(front.map((x) => x.arrival)).toEqual([105, 100, 90]);
  });
});

describe("planAcrossServiceDays", () => {
  const graph = new Graph(makeNetwork([["red", ["a", "b"], 5]]));
  // Trains at 23:50 and 00:20 (as 24:20) on the previous service day, and 05:30 the next morning.
  const trips = (times: number[]) => {
    const deltas = times.map((t, i) => t - (i ? (times[i - 1] as number) : 0));
    return Object.fromEntries(DAY_TYPES.map((d) => [d, deltas]));
  };
  const timetable = new Timetable(graph, {
    routes: [{ line: "red", stops: ["a", "b"], times: [0, 5], trips: trips([330, 1430, 1460]) }],
  });

  it("uses the previous service day's late trains after midnight", () => {
    const { journeys, nextMorning } = planAcrossServiceDays(timetable, "a", "b", "tue", 10);
    expect(nextMorning).toBe(false);
    expect(journeys[0]?.departure).toBe(20); // 00:20, shifted from 24:20
  });

  it("catches a train running past midnight on the same service day", () => {
    const { journeys } = planAcrossServiceDays(timetable, "a", "b", "tue", 1439);
    expect(journeys[0]?.departure).toBe(1460);
  });

  it("falls back to the next morning after the last train", () => {
    const early = new Timetable(graph, {
      routes: [{ line: "red", stops: ["a", "b"], times: [0, 5], trips: trips([330, 1430]) }],
    });
    const { journeys, nextMorning } = planAcrossServiceDays(early, "a", "b", "tue", 1435);
    expect(nextMorning).toBe(true);
    expect(journeys[0]?.departure).toBe(1440 + 330);
  });

  it("finds the first train when asked before services start", () => {
    const { journeys } = planAcrossServiceDays(timetable, "a", "b", "tue", 60);
    expect(journeys[0]?.departure).toBe(330);
  });
});
