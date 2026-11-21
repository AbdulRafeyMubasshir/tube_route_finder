import { findRoute } from "../engine";
import { network, tubeGraph } from "./network";

describe("bundled network data", () => {
  it("has unique station ids and valid edges", () => {
    const ids = network.stations.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const lineIds = new Set(network.lines.map((l) => l.id));
    for (const edge of network.edges) {
      expect(tubeGraph.stations.has(edge.from)).toBe(true);
      expect(tubeGraph.stations.has(edge.to)).toBe(true);
      expect(lineIds.has(edge.line)).toBe(true);
      expect(edge.minutes).toBeGreaterThan(0);
    }
  });

  it("connects every station to every other station", () => {
    const ids = [...tubeGraph.stations.keys()];
    for (const from of ids) {
      for (const to of ids) {
        expect(findRoute(tubeGraph, from, to), `${from} -> ${to}`).not.toBeNull();
      }
    }
  });
});

/**
 * Golden journeys: known-good answers on the bundled data. A change here means
 * the engine or the data changed behaviour and should be reviewed.
 */
describe("golden journeys", () => {
  const cases: {
    from: string;
    to: string;
    minutes: number;
    rides: [line: string, from: string, to: string][];
  }[] = [
    {
      from: "brixton",
      to: "stanmore",
      minutes: 40.5,
      rides: [
        ["victoria", "brixton", "green-park"],
        ["jubilee", "green-park", "stanmore"],
      ],
    },
    {
      from: "walthamstow",
      to: "waterloo",
      minutes: 24.83,
      rides: [
        ["victoria", "walthamstow", "green-park"],
        ["jubilee", "green-park", "waterloo"],
      ],
    },
    {
      from: "kings-cross-st-pancras",
      to: "south-kensington",
      minutes: 11.2,
      rides: [
        ["victoria", "kings-cross-st-pancras", "green-park"],
        ["piccadilly", "green-park", "south-kensington"],
      ],
    },
    {
      from: "hammersmith-handc",
      to: "stratford",
      minutes: 41.86,
      rides: [
        ["circle", "hammersmith-handc", "baker-street"],
        ["jubilee", "baker-street", "stratford"],
      ],
    },
  ];

  it.each(cases)("$from -> $to", ({ from, to, minutes, rides }) => {
    const route = findRoute(tubeGraph, from, to);
    expect(route?.travelMinutes).toBeCloseTo(minutes, 2);
    expect(route?.rides.map((r) => [r.line, r.from, r.to])).toEqual(rides);
  });

  it("names the terminus of each ride", () => {
    const route = findRoute(tubeGraph, "brixton", "stanmore");
    expect(route?.rides.map((r) => r.terminus)).toEqual(["walthamstow", "stanmore"]);
  });
});
