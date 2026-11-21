import { fireEvent, render, screen } from "@testing-library/react";
import { TubeMap } from "./TubeMap";
import { buildSegments } from "../lib/mapSegments";
import { Graph } from "../engine";

const graph = new Graph({
  lines: [
    { id: "red", name: "Red", colour: "#f00" },
    { id: "blue", name: "Blue", colour: "#00f" },
  ],
  stations: [
    { id: "a", name: "A", x: 0, y: 0 },
    { id: "b", name: "B", x: 100, y: 0 },
  ],
  edges: [
    { from: "a", to: "b", line: "red", direction: "E", minutes: 1 },
    { from: "b", to: "a", line: "red", direction: "W", minutes: 1 },
    { from: "a", to: "b", line: "blue", direction: "E", minutes: 1 },
  ],
});

describe("buildSegments", () => {
  it("draws one segment per line per station pair, side by side", () => {
    const segments = buildSegments(graph);
    expect(segments).toHaveLength(2);
    expect(segments.map((s) => s.offset).sort()).toEqual([-3, 3]);
  });
});

describe("TubeMap", () => {
  it("renders stations and zoom controls", () => {
    const onStationClick = vi.fn();
    const { container } = render(
      <TubeMap graph={graph} route={null} from={null} to={null} onStationClick={onStationClick} />,
    );
    expect(screen.getByRole("img", { name: /Network map/ })).toBeInTheDocument();
    fireEvent.click(container.querySelector('[data-station="b"]')!);
    expect(onStationClick).toHaveBeenCalledWith("b");
    // Zoom buttons should not throw in a DOM without layout.
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  });
});
