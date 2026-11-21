import { render, screen } from "@testing-library/react";
import { RouteDetails } from "./RouteDetails";
import { Graph, findRoute } from "../engine";
import { makeNetwork } from "../engine/testNetwork";

describe("RouteDetails", () => {
  it("describes rides, walks, changes and estimated times", () => {
    const network = makeNetwork(
      [
        ["red", ["a", "b", "c"], 2],
        ["blue", ["d", "e"], 3],
      ],
      {
        walks: [{ from: "c", to: "d", minutes: 4 }],
      },
    );
    network.hops = network.hops.map((h) => (h.line === "blue" ? { ...h, estimated: true } : h));
    const graph = new Graph(network);
    render(<RouteDetails graph={graph} route={findRoute(graph, "a", "e")!} />);

    expect(screen.getByText("RED line towards C")).toBeInTheDocument();
    expect(screen.getByText("Walk to D · 4 min")).toBeInTheDocument();
    expect(screen.getByText("BLUE line towards E")).toBeInTheDocument();
    expect(screen.getByText(/\(est\.\)/)).toBeInTheDocument();
    expect(screen.getByText("Show stops")).toBeInTheDocument();
    expect(screen.getByText(/Includes 3 min for changes and 4 min walking/)).toBeInTheDocument();
    expect(screen.getByText(/estimated from distance/)).toBeInTheDocument();
  });

  it("names non-tube lines without 'line' and summarises many termini", () => {
    const network = makeNetwork([
      ["dlr", ["a", "b", "t1"], 1],
      ["dlr", ["a", "b", "t2"], 1],
      ["dlr", ["a", "b", "t3"], 1],
      ["dlr", ["a", "b", "t4"], 1],
    ]);
    network.lines = network.lines.map((l) => ({ ...l, name: "DLR", mode: "dlr" }));
    const graph = new Graph(network);
    render(<RouteDetails graph={graph} route={findRoute(graph, "a", "b")!} />);
    expect(screen.getByText("DLR towards T1, T2 or 2 others")).toBeInTheDocument();
    expect(screen.getByText("Excludes waiting for the first train.")).toBeInTheDocument();
  });
});
