import type { Graph, LineId, StationId } from "../engine";

export interface Segment {
  key: string;
  line: LineId;
  a: StationId;
  b: StationId;
  /** Screen-pixel offset, perpendicular to the segment, so shared sections sit side by side. */
  ox: number;
  oy: number;
}

/** Gap between lines that share a section, in screen pixels. */
export const LINE_GAP_PX = 4;

export const pairKey = (a: StationId, b: StationId) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * One drawable segment per line per pair of adjacent stations, whatever the
 * direction. Where several lines share a pair (e.g. Circle, District and
 * Hammersmith & City), each gets a perpendicular offset so they're drawn side
 * by side, like a schematic map.
 */
export function buildSegments(graph: Graph): Segment[] {
  const byPair = new Map<string, { a: StationId; b: StationId; lines: Set<LineId> }>();
  for (const edge of graph.edges) {
    if (edge.kind !== "ride") continue;
    const pair = pairKey(edge.from, edge.to);
    const [a, b] = pair.split("|") as [StationId, StationId];
    const entry = byPair.get(pair) ?? { a, b, lines: new Set<LineId>() };
    entry.lines.add(edge.line);
    byPair.set(pair, entry);
  }
  const segments: Segment[] = [];
  for (const [pair, { a, b, lines }] of byPair) {
    const from = graph.station(a);
    const to = graph.station(b);
    const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const nx = -(to.y - from.y) / length;
    const ny = (to.x - from.x) / length;
    const sorted = [...lines].sort();
    sorted.forEach((line, i) => {
      const shift = (i - (sorted.length - 1) / 2) * LINE_GAP_PX;
      segments.push({
        key: `${pair}|${line}`,
        line,
        a,
        b,
        ox: nx * shift || 0,
        oy: ny * shift || 0,
      });
    });
  }
  return segments;
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
