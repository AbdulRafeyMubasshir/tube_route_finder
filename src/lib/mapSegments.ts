import type { Graph, LineId, StationId } from "../engine";

export interface Segment {
  key: string;
  line: LineId;
  a: StationId;
  b: StationId;
  /** Perpendicular offset so lines sharing a section are drawn side by side. */
  offset: number;
}

const LINE_GAP = 6;
export const pairKey = (a: StationId, b: StationId) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** One drawable segment per line per pair of adjacent stations. */
export function buildSegments(graph: Graph): Segment[] {
  const byPair = new Map<string, Set<LineId>>();
  for (const edge of graph.edges) {
    const key = pairKey(edge.from, edge.to);
    const lines = byPair.get(key) ?? new Set<LineId>();
    lines.add(edge.line);
    byPair.set(key, lines);
  }
  const segments: Segment[] = [];
  for (const [pair, lines] of byPair) {
    const [a, b] = pair.split("|") as [StationId, StationId];
    [...lines].sort().forEach((line, i, all) => {
      segments.push({
        key: `${pair}|${line}`,
        line,
        a,
        b,
        offset: (i - (all.length - 1) / 2) * LINE_GAP,
      });
    });
  }
  return segments;
}
