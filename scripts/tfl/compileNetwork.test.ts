import { cleanStationName, compileNetwork, parseZone, slugify } from "./compileNetwork";
import type { TflSource } from "./types";

const source = (): TflSource => ({
  fetchedAt: "2026-01-01T00:00:00Z",
  lines: [
    { id: "victoria", name: "Victoria", mode: "tube" },
    { id: "weaver", name: "Weaver", mode: "overground" },
  ],
  stops: [
    {
      id: "V1",
      name: "Alpha Underground Station",
      placeId: "HUBA",
      lat: 51.5,
      lon: -0.1,
      zone: "1",
    },
    {
      id: "R1",
      name: "Alpha Rail Station",
      placeId: "HUBA",
      lat: 51.5005,
      lon: -0.1005,
      zone: "1",
    },
    {
      id: "V2",
      name: "Beta Underground Station",
      placeId: "V2",
      lat: 51.51,
      lon: -0.1,
      zone: "2+3",
    },
    {
      id: "R2",
      name: "Gamma (London) Rail Station",
      placeId: "R2",
      lat: 51.5,
      lon: -0.12,
      zone: null,
    },
  ],
  places: [{ id: "HUBA", name: "Alpha" }],
  patterns: [
    { line: "victoria", direction: "outbound", name: "A-B", stops: ["V1", "V2"] },
    { line: "victoria", direction: "inbound", name: "B-A", stops: ["V2", "V1"] },
    { line: "victoria", direction: "inbound", name: "dup", stops: ["V2", "V1"] },
    { line: "weaver", direction: "outbound", name: "A-G", stops: ["R1", "R2"] },
    { line: "weaver", direction: "inbound", name: "G-A", stops: ["R2", "R1"] },
  ],
  hops: [{ line: "victoria", from: "V1", to: "V2", minutes: 0, samples: 3 }],
  timetables: [],
});

describe("compileNetwork", () => {
  it("builds places, stations, patterns and hops", () => {
    const { network, errors, stats } = compileNetwork(source());
    expect(errors).toEqual([]);
    expect(network.places.map((p) => [p.id, p.name, p.stations, p.zone, p.lines])).toEqual([
      ["alpha", "Alpha", ["R1", "V1"], 1, ["victoria", "weaver"]],
      ["beta", "Beta", ["V2"], 2, ["victoria"]],
      ["gamma", "Gamma", ["R2"], null, ["weaver"]],
    ]);
    expect(stats.patterns).toBe(4); // duplicate pattern removed
    expect(network.stations.find((s) => s.id === "V1")?.place).toBe("alpha");
  });

  it("floors timetabled times and estimates missing ones", () => {
    const { network } = compileNetwork(source());
    const v = network.hops.find((h) => h.from === "V1" && h.to === "V2");
    expect(v).toMatchObject({ minutes: 0.5 });
    expect(v?.estimated).toBeUndefined();
    const est = network.hops.find((h) => h.line === "weaver");
    expect(est?.estimated).toBe(true);
    expect(est?.minutes).toBeGreaterThan(0.5);
  });

  it("links stations in the same place and nearby places by walking", () => {
    const { network } = compileNetwork(source());
    expect(network.walks).toContainEqual({ from: "V1", to: "R1", minutes: 2 });
    expect(network.walks.some((w) => w.from === "V1" && w.to === "V2")).toBe(false); // 1.1 km apart
  });

  it("reports unknown stops and disconnected places", () => {
    const bad = source();
    bad.patterns.push({
      line: "victoria",
      direction: "outbound",
      name: "ghost",
      stops: ["V1", "NOPE"],
    });
    bad.stops.push({
      id: "ISLAND",
      name: "Island",
      placeId: "ISLAND",
      lat: 52,
      lon: 0,
      zone: null,
    });
    bad.patterns.push({
      line: "weaver",
      direction: "outbound",
      name: "island",
      stops: ["ISLAND", "R2"],
    });
    const { errors } = compileNetwork(bad);
    expect(errors.join("\n")).toMatch(/unknown stops: NOPE/);
    expect(errors.join("\n")).toMatch(/cannot be reached/);
  });

  it("disambiguates places that share a name", () => {
    const s = source();
    s.stops.push({
      id: "R3",
      name: "Beta Rail Station",
      placeId: "R3",
      lat: 51.52,
      lon: -0.12,
      zone: "2",
    });
    s.patterns.push({ line: "weaver", direction: "outbound", name: "x", stops: ["R2", "R3"] });
    s.patterns.push({ line: "weaver", direction: "inbound", name: "y", stops: ["R3", "R2"] });
    const names = compileNetwork(s).network.places.map((p) => p.id);
    expect(names).toContain("beta-underground");
    expect(names).toContain("beta-overground");
  });
});

describe("helpers", () => {
  it("cleans station names", () => {
    expect(cleanStationName("King's Cross St. Pancras Underground Station")).toBe(
      "King's Cross St. Pancras",
    );
    expect(cleanStationName("Paddington (H&C Line)-Underground")).toBe("Paddington (H&C Line)");
    expect(cleanStationName("Battersea Power Station Underground Station")).toBe(
      "Battersea Power Station",
    );
    expect(cleanStationName("Cambridge Heath (London) Rail Station")).toBe("Cambridge Heath");
  });

  it("slugifies names", () => {
    expect(slugify("King's Cross & St Pancras International")).toBe(
      "kings-cross-and-st-pancras-international",
    );
  });

  it("parses zones", () => {
    expect(parseZone("2+3")).toBe(2);
    expect(parseZone(null)).toBeNull();
  });
});
