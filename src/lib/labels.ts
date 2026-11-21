/** A label to place, in screen pixels. */
export interface LabelInput {
  id: string;
  /** Anchor point (the station dot). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Higher priorities are placed first. */
  priority: number;
}

/** Where the label sits relative to its station. */
export type LabelPosition = "ne" | "se" | "nw" | "sw";

const POSITIONS: LabelPosition[] = ["ne", "se", "nw", "sw"];
/**
 * Offsets matching how TubeMap draws labels (12px font, dx ±0.7em, dy -0.5em
 * above or 1.2em below the station): horizontal gap, and the top of the text
 * box relative to the station for labels above and below.
 */
const GAP_X = 8.5;
const TOP_ABOVE = -17;
const TOP_BELOW = 3.5;
const CELL = 64;

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** The screen box a label occupies in a given position. */
export function boxFor(label: LabelInput, position: LabelPosition): Box {
  const east = position === "ne" || position === "se";
  const north = position === "ne" || position === "nw";
  const x1 = east ? label.x + GAP_X : label.x - GAP_X - label.width;
  const y1 = label.y + (north ? TOP_ABOVE : TOP_BELOW);
  return { x1, y1, x2: x1 + label.width, y2: y1 + label.height };
}

const overlaps = (a: Box, b: Box) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;

/**
 * Greedy label placement: in priority order, try four positions around each
 * station and keep the first that overlaps no label already placed. Labels
 * outside the viewport are skipped. A uniform grid makes each overlap check
 * look only at nearby labels, so a pass over ~400 labels takes well under a
 * millisecond.
 */
export function placeLabels(
  labels: readonly LabelInput[],
  viewport: { width: number; height: number },
): Map<string, LabelPosition> {
  const placed = new Map<string, LabelPosition>();
  const grid = new Map<string, Box[]>();
  const cells = (box: Box) => {
    const keys: string[] = [];
    for (let cx = Math.floor(box.x1 / CELL); cx <= Math.floor(box.x2 / CELL); cx++) {
      for (let cy = Math.floor(box.y1 / CELL); cy <= Math.floor(box.y2 / CELL); cy++) {
        keys.push(`${cx},${cy}`);
      }
    }
    return keys;
  };

  const ordered = [...labels].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  for (const label of ordered) {
    if (label.x < -label.width || label.y < -label.height) continue;
    if (label.x > viewport.width + label.width || label.y > viewport.height + label.height)
      continue;
    for (const position of POSITIONS) {
      const box = boxFor(label, position);
      const keys = cells(box);
      if (keys.some((key) => grid.get(key)?.some((other) => overlaps(box, other)))) continue;
      keys.forEach((key) => grid.set(key, [...(grid.get(key) ?? []), box]));
      placed.set(label.id, position);
      break;
    }
  }
  return placed;
}
