import type {
  Edge,
  Line,
  LineId,
  Network,
  Pattern,
  PatternId,
  Place,
  PlaceId,
  Station,
  StationId,
} from "./types";

import { buildStateIndex, type StateIndex } from "./StateIndex";

export class UnknownStationError extends Error {
  constructor(readonly id: string) {
    super(`Unknown station or place: ${id}`);
    this.name = "UnknownStationError";
  }
}

/**
 * Immutable, indexed view of a network, built once and shared by all queries.
 *
 * Ride edges are expanded per service pattern: if three patterns serve the
 * same hop there are three edges. That lets the search tell "stay on this
 * train" apart from "change to another train on the same line", which
 * matters on branching lines such as the Northern line.
 */
export class Graph {
  readonly stations: ReadonlyMap<StationId, Station>;
  readonly places: ReadonlyMap<PlaceId, Place>;
  readonly lines: ReadonlyMap<LineId, Line>;
  readonly patterns: ReadonlyMap<PatternId, Pattern>;
  readonly edges: readonly Edge[];
  private readonly outgoing: ReadonlyMap<StationId, readonly Edge[]>;
  /** Patterns per line, with each stop's index for fast "does it run from A to B" checks. */
  private readonly patternIndex: ReadonlyMap<
    LineId,
    { pattern: Pattern; index: Map<StationId, number> }[]
  >;

  constructor(network: Network) {
    this.stations = new Map(network.stations.map((s) => [s.id, s]));
    this.places = new Map(network.places.map((p) => [p.id, p]));
    this.lines = new Map(network.lines.map((l) => [l.id, l]));
    this.patterns = new Map(network.patterns.map((p) => [p.id, p]));

    for (const place of network.places) {
      for (const id of place.stations) this.station(id);
    }

    const hopTimes = new Map(network.hops.map((h) => [`${h.line}|${h.from}|${h.to}`, h]));
    const edges: Edge[] = [];
    const patternIndex = new Map<LineId, { pattern: Pattern; index: Map<StationId, number> }[]>();
    for (const pattern of network.patterns) {
      const index = new Map<StationId, number>();
      pattern.stops.forEach((id, i) => {
        this.station(id);
        if (!index.has(id)) index.set(id, i);
      });
      const list = patternIndex.get(pattern.line) ?? [];
      list.push({ pattern, index });
      patternIndex.set(pattern.line, list);

      for (let i = 0; i < pattern.stops.length - 1; i++) {
        const from = pattern.stops[i] as StationId;
        const to = pattern.stops[i + 1] as StationId;
        const hop = hopTimes.get(`${pattern.line}|${from}|${to}`);
        if (!hop) throw new Error(`No run time for ${pattern.line} ${from} -> ${to}`);
        edges.push({
          kind: "ride",
          from,
          to,
          line: pattern.line,
          pattern: pattern.id,
          minutes: hop.minutes,
          estimated: hop.estimated ?? false,
        });
      }
    }
    for (const walk of network.walks) {
      this.station(walk.from);
      this.station(walk.to);
      edges.push({ kind: "walk", ...walk });
    }

    const outgoing = new Map<StationId, Edge[]>();
    for (const edge of edges) {
      const list = outgoing.get(edge.from);
      if (list) list.push(edge);
      else outgoing.set(edge.from, [edge]);
    }
    this.edges = edges;
    this.outgoing = outgoing;
    this.patternIndex = patternIndex;
  }

  private stateIndex: StateIndex | undefined;

  /** Integer-indexed search structure, built on first use. */
  get index(): StateIndex {
    this.stateIndex ??= buildStateIndex(this);
    return this.stateIndex;
  }

  station(id: StationId): Station {
    const station = this.stations.get(id);
    if (!station) throw new UnknownStationError(id);
    return station;
  }

  place(id: PlaceId): Place {
    const place = this.places.get(id);
    if (!place) throw new UnknownStationError(id);
    return place;
  }

  edgesFrom(id: StationId): readonly Edge[] {
    return this.outgoing.get(id) ?? [];
  }

  /**
   * Termini of every pattern on `line` that calls at `from` and later at `to`,
   * i.e. every train you could board for this ride.
   */
  towards(line: LineId, from: StationId, to: StationId): StationId[] {
    const termini = new Set<StationId>();
    for (const { pattern, index } of this.patternIndex.get(line) ?? []) {
      const a = index.get(from);
      const b = pattern.stops.lastIndexOf(to);
      if (a !== undefined && b > a) termini.add(pattern.stops.at(-1) as StationId);
    }
    return [...termini].sort();
  }
}
