import type { Edge, Line, LineId, Network, Station, StationId } from "./types";

export class UnknownStationError extends Error {
  constructor(readonly stationId: StationId) {
    super(`Unknown station: ${stationId}`);
    this.name = "UnknownStationError";
  }
}

/**
 * Immutable, indexed view of a network, built once and shared by all queries.
 */
export class Graph {
  readonly stations: ReadonlyMap<StationId, Station>;
  readonly lines: ReadonlyMap<LineId, Line>;
  readonly edges: readonly Edge[];
  private readonly outgoing: ReadonlyMap<StationId, readonly Edge[]>;
  private readonly terminusCache = new Map<string, StationId | null>();

  constructor(network: Network) {
    this.stations = new Map(network.stations.map((s) => [s.id, s]));
    this.lines = new Map(network.lines.map((l) => [l.id, l]));
    this.edges = network.edges;

    const outgoing = new Map<StationId, Edge[]>();
    for (const id of this.stations.keys()) outgoing.set(id, []);
    for (const edge of network.edges) {
      const list = outgoing.get(edge.from);
      if (!list) throw new UnknownStationError(edge.from);
      if (!this.stations.has(edge.to)) throw new UnknownStationError(edge.to);
      list.push(edge);
    }
    this.outgoing = outgoing;
  }

  station(id: StationId): Station {
    const station = this.stations.get(id);
    if (!station) throw new UnknownStationError(id);
    return station;
  }

  edgesFrom(id: StationId): readonly Edge[] {
    return this.outgoing.get(id) ?? [];
  }

  /**
   * The station a train on `line`/`direction` runs to after `from`.
   * Returns null when the line loops back on itself or branches, where a
   * single terminus is not meaningful.
   */
  terminus(line: LineId, direction: string, from: StationId): StationId | null {
    const key = `${line}|${direction}|${from}`;
    const cached = this.terminusCache.get(key);
    if (cached !== undefined) return cached;

    const visited = new Set<StationId>([from]);
    let current = from;
    let result: StationId | null = null;
    for (;;) {
      const next = this.edgesFrom(current).filter(
        (e) => e.line === line && e.direction === direction,
      );
      if (next.length === 0) {
        result = current;
        break;
      }
      const only = next.length === 1 ? next[0] : undefined;
      if (!only || visited.has(only.to)) break; // branch or loop
      visited.add(only.to);
      current = only.to;
    }
    this.terminusCache.set(key, result);
    return result;
  }
}
