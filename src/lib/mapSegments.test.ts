import { Graph } from "../engine";
import { makeNetwork } from "../engine/testNetwork";
import { boundsOf, buildSegments } from "./mapSegments";

describe("buildSegments", () => {
  it("draws one segment per line per station pair, ignoring direction and pattern", () => {
    const graph = new Graph(
      makeNetwork([
        ["red", ["a", "b", "c"], 1],
        ["red", ["c", "b", "a"], 1],
        ["red", ["a", "b"], 1],
        ["blue", ["a", "b"], 1],
      ]),
    );
    expect(
      buildSegments(graph)
        .map((s) => s.key)
        .sort(),
    ).toEqual(["a|b|blue", "a|b|red", "b|c|red"]);
  });
});

describe("boundsOf", () => {
  it("pads the bounding box", () => {
    expect(
      boundsOf(
        [
          { x: 0, y: 5 },
          { x: 10, y: -5 },
        ],
        1,
      ),
    ).toEqual({ minX: -1, minY: -6, maxX: 11, maxY: 6 });
  });
});
