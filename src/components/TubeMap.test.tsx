import { fireEvent, render, screen } from "@testing-library/react";
import { TubeMap } from "./TubeMap";
import { Graph, findRoute } from "../engine";
import { makeNetwork } from "../engine/testNetwork";

const graph = new Graph(
  makeNetwork([
    ["red", ["a", "b", "c"], 1],
    ["blue", ["c", "d"], 1],
  ]),
);

describe("TubeMap", () => {
  it("renders places, handles clicks and zoom controls", () => {
    const onPlaceClick = vi.fn();
    const { container } = render(
      <TubeMap graph={graph} route={null} from={null} to={null} onPlaceClick={onPlaceClick} />,
    );
    expect(screen.getByRole("img", { name: /Network map/ })).toBeInTheDocument();
    fireEvent.click(container.querySelector('[data-place="b"]')!);
    expect(onPlaceClick).toHaveBeenCalledWith("b");
    // Zoom buttons should not throw in a DOM without layout.
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(screen.getByRole("button", { name: "Central London" }));
  });

  it("highlights the route and fades other stations", () => {
    const route = findRoute(graph, "a", "c");
    const { container } = render(
      <TubeMap graph={graph} route={route} from="a" to="c" onPlaceClick={() => {}} />,
    );
    expect(screen.getAllByTestId("route-segment")).toHaveLength(2);
    expect(container.querySelector('[data-place="d"]')).toHaveClass("faded");
    expect(container.querySelector('[data-place="a"]')).toHaveClass("endpoint");
  });
});
