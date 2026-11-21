import { findRoute } from "../engine";
import { network, tubeGraph } from "./network";

describe("bundled network data", () => {
  it("has unique ids and positive run times", () => {
    const placeIds = network.places.map((p) => p.id);
    expect(new Set(placeIds).size).toBe(placeIds.length);
    for (const hop of network.hops) expect(hop.minutes).toBeGreaterThan(0);
    for (const walk of network.walks) expect(walk.minutes).toBeGreaterThan(0);
  });

  it("covers the full network", () => {
    expect(network.lines.length).toBeGreaterThanOrEqual(19);
    expect(network.places.length).toBeGreaterThan(400);
  });

  it("connects every place to every other place", () => {
    // Every place from a spread of origins; the build pipeline checks the rest.
    const ids = [...tubeGraph.places.keys()];
    const origins = ids.filter((_, i) => i % 40 === 0);
    for (const from of origins) {
      for (const to of ids) {
        expect(findRoute(tubeGraph, from, to), `${from} -> ${to}`).not.toBeNull();
      }
    }
  }, 60_000);
});

/**
 * Golden journeys: sanity checks on real data. Times come from TfL timetables
 * (or estimates), so they are asserted as ranges; the shape of each journey is
 * asserted exactly.
 */
describe("golden journeys", () => {
  const ridesOf = (from: string, to: string, options = {}) => {
    const route = findRoute(tubeGraph, from, to, options);
    if (!route) throw new Error(`no route ${from} -> ${to}`);
    const rides = route.segments.flatMap((s) =>
      s.kind === "ride"
        ? [[s.line, tubeGraph.station(s.from).place, tubeGraph.station(s.to).place]]
        : [],
    );
    return { route, rides };
  };

  it("Brixton to Stanmore: Victoria then Jubilee at Green Park", () => {
    const { route, rides } = ridesOf("brixton", "stanmore");
    expect(rides).toEqual([
      ["victoria", "brixton", "green-park"],
      ["jubilee", "green-park", "stanmore"],
    ]);
    expect(route.totalMinutes).toBeGreaterThan(38);
    expect(route.totalMinutes).toBeLessThan(55);
  });

  it("Morden to High Barnet stays on one Northern line train", () => {
    const { route, rides } = ridesOf("morden", "high-barnet");
    expect(rides).toEqual([["northern", "morden", "high-barnet"]]);
    expect(route.interchanges).toBe(0);
  });

  it("Euston to Bank takes a southbound Northern line train via Bank", () => {
    const { route } = ridesOf("euston", "bank");
    const ride = route.segments[0];
    expect(ride?.kind === "ride" && ride.line).toBe("northern");
    expect(ride?.kind === "ride" && ride.towards.map((id) => tubeGraph.station(id).name)).toContain(
      "Morden",
    );
  });

  it("Heathrow Terminal 5 to Canary Wharf is direct on the Elizabeth line", () => {
    const { rides } = ridesOf("heathrow-airport-terminal-5", "canary-wharf");
    expect(rides).toEqual([["elizabeth", "heathrow-airport-terminal-5", "canary-wharf"]]);
  });

  it("preferring fewer changes never adds changes", () => {
    for (const [from, to] of [
      ["brixton", "stanmore"],
      ["wimbledon", "stratford"],
      ["morden", "canary-wharf"],
    ] as const) {
      const fast = ridesOf(from, to).route;
      const simple = ridesOf(from, to, { changePenalty: 8 }).route;
      expect(simple.interchanges).toBeLessThanOrEqual(fast.interchanges);
      expect(simple.totalMinutes).toBeGreaterThanOrEqual(fast.totalMinutes - 1e-9);
    }
  });
});
