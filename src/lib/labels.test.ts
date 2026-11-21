import fc from "fast-check";
import { boxFor, placeLabels, type LabelInput } from "./labels";

const label = (id: string, x: number, y: number, priority = 0): LabelInput => ({
  id,
  x,
  y,
  width: 60,
  height: 14,
  priority,
});
const viewport = { width: 800, height: 600 };

describe("placeLabels", () => {
  it("puts boxes on the expected side of the station", () => {
    const l = label("a", 100, 100);
    expect(boxFor(l, "ne").x1).toBeGreaterThan(100);
    expect(boxFor(l, "nw").x2).toBeLessThan(100);
    expect(boxFor(l, "ne").y2).toBeLessThan(100);
    expect(boxFor(l, "se").y1).toBeGreaterThan(100);
  });

  it("places a lone label to the north-east", () => {
    expect(placeLabels([label("a", 100, 100)], viewport)).toEqual(new Map([["a", "ne"]]));
  });

  it("moves a label to another side instead of overlapping", () => {
    const placed = placeLabels([label("a", 100, 100, 1), label("b", 110, 100)], viewport);
    expect(placed.get("a")).toBe("ne");
    expect(placed.get("b")).toBe("se");
  });

  it("drops the lower-priority label when no position is free", () => {
    const crowd = [
      label("hub", 100, 100, 5),
      label("x", 100, 100),
      label("y", 100, 100),
      label("z", 100, 100),
      label("w", 100, 100),
    ];
    const placed = placeLabels(crowd, viewport);
    expect(placed.get("hub")).toBe("ne");
    expect(placed.size).toBe(4);
  });

  it("skips labels far outside the viewport", () => {
    expect(placeLabels([label("a", -500, 100), label("b", 100, 2000)], viewport).size).toBe(0);
  });

  it("never produces overlapping labels", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            x: fc.integer({ min: 0, max: 400 }),
            y: fc.integer({ min: 0, max: 300 }),
            p: fc.integer({ min: 0, max: 3 }),
          }),
          { maxLength: 60 },
        ),
        (points) => {
          const labels = points.map((p, i) => label(`l${i}`, p.x, p.y, p.p));
          const placed = placeLabels(labels, viewport);
          const boxes = [...placed].map(([id, pos]) =>
            boxFor(
              labels.find((x) => x.id === id)!,
              pos,
            ),
          );
          boxes.forEach((a, i) =>
            boxes.slice(i + 1).forEach((b) => {
              expect(a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2).toBe(false);
            }),
          );
        },
      ),
    );
  });
});
