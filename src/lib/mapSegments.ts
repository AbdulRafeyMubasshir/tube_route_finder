import type { Graph, LineId, StationId } from "../engine";

export interface Segment {
  key: string;
  line: LineId;
  a: StationId;
  b: StationId;
}

export const pairKey = (a: StationId, b: StationId) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** One drawable segment per line per pair of adjacent stations, whatever the direction. */
export function buildSegments(graph: Graph): Segment[] {
  const segments = new Map<string, Segment>();
  for (const edge of graph.edges) {
    if (edge.kind !== "ride") continue;
    const key = `${pairKey(edge.from, edge.to)}|${edge.line}`;
    if (!segments.has(key)) segments.set(key, { key, line: edge.line, a: edge.from, b: edge.to });
  }
  return [...segments.values()];
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsOf(points: readonly { x: number; y: number }[], padding = 0): Bounds {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs) - padding,
    minY: Math.min(...ys) - padding,
    maxX: Math.max(...xs) + padding,
    maxY: Math.max(...ys) + padding,
  };
}
