import { render, screen } from "@testing-library/react";
import { RouteDetails } from "./RouteDetails";
import { Graph, findRoute } from "../engine";

const loop = new Graph({
  lines: [{ id: "circle", name: "Circle", colour: "#ff0" }],
  stations: ["p", "q", "r"].map((id) => ({ id, name: id.toUpperCase(), x: 0, y: 0 })),
  edges: [
    { from: "p", to: "q", line: "circle", direction: "Inner", minutes: 1 },
    { from: "q", to: "r", line: "circle", direction: "Inner", minutes: 1 },
    { from: "r", to: "p", line: "circle", direction: "Inner", minutes: 1 },
  ],
});

describe("RouteDetails", () => {
  it("describes loop lines by rail instead of terminus", () => {
    render(<RouteDetails graph={loop} route={findRoute(loop, "p", "r")!} />);
    expect(screen.getByText("Circle line (inner rail)")).toBeInTheDocument();
    expect(screen.getByText("2 stops · 2 min")).toBeInTheDocument();
    expect(screen.getByText("Show stops")).toBeInTheDocument();
  });
});
