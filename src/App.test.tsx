import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { Graph, findRoute } from "./engine";
import { tubeGraph } from "./data/network";
import { formatMinutes } from "./lib/format";

async function chooseStation(label: "From" | "To", query: string, option: string) {
  const user = userEvent.setup();
  await user.type(screen.getByRole("combobox", { name: label }), query);
  await user.click(screen.getByRole("option", { name: option }));
}

describe("App", () => {
  beforeEach(() => window.history.replaceState(null, "", "/"));

  it("shows a prompt before any stations are chosen", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "London Underground Route Finder" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Choose two stations/)).toBeInTheDocument();
  });

  it("plans a journey and shows each ride", async () => {
    render(<App />);
    await chooseStation("From", "brix", "Brixton");
    await chooseStation("To", "stan", "Stanmore");

    const details = screen.getByRole("region", { name: "Journey details" });
    expect(within(details).getByText(/^\d+ min$/)).toHaveTextContent(
      formatMinutes(findRoute(tubeGraph, "brixton", "stanmore")!.travelMinutes),
    );
    expect(within(details).getByText(/1 change$/)).toBeInTheDocument();
    expect(within(details).getByText("Victoria line towards Walthamstow")).toBeInTheDocument();
    expect(within(details).getByText("Jubilee line towards Stanmore")).toBeInTheDocument();
    expect(within(details).getByText("Change at Green Park")).toBeInTheDocument();
    expect(window.location.search).toBe("?from=brixton&to=stanmore");
  });

  it("highlights only the segments the route uses", async () => {
    render(<App />);
    await chooseStation("From", "brix", "Brixton");
    await chooseStation("To", "stan", "Stanmore");
    // 20 hops from Brixton to Stanmore.
    expect(screen.getAllByTestId("route-segment")).toHaveLength(20);
  });

  it("restores a journey from the URL and swaps direction", async () => {
    window.history.replaceState(null, "", "/?from=walthamstow&to=waterloo");
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("combobox", { name: "From" })).toHaveValue("Walthamstow");
    expect(screen.getByText("Victoria line towards Brixton")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Swap origin and destination" }));
    expect(screen.getByRole("combobox", { name: "From" })).toHaveValue("Waterloo");
    expect(screen.getByRole("combobox", { name: "To" })).toHaveValue("Walthamstow");
    expect(screen.getByText("Victoria line towards Walthamstow")).toBeInTheDocument();
  });

  it("ignores unknown station ids in the URL", () => {
    window.history.replaceState(null, "", "/?from=atlantis&to=bank");
    render(<App />);
    expect(screen.getByRole("combobox", { name: "From" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "To" })).toHaveValue("Bank");
  });

  it("sets origin then destination when stations are clicked on the map", () => {
    // fireEvent rather than userEvent: d3-zoom's mousedown handler needs a real window view.
    const { container } = render(<App />);
    const click = (id: string) =>
      fireEvent.click(container.querySelector(`[data-station="${id}"]`)!);

    click("bank");
    expect(screen.getByRole("combobox", { name: "From" })).toHaveValue("Bank");
    click("bank"); // clicking the origin again does nothing
    expect(screen.getByRole("combobox", { name: "To" })).toHaveValue("");
    click("euston");
    expect(screen.getByRole("combobox", { name: "To" })).toHaveValue("Euston");
    click("victoria"); // a third click starts a new journey
    expect(screen.getByRole("combobox", { name: "From" })).toHaveValue("Victoria");
    expect(screen.getByRole("combobox", { name: "To" })).toHaveValue("");
  });

  it("can prefer fewer changes", async () => {
    window.history.replaceState(null, "", "/?from=hammersmith-handc&to=stratford");
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("checkbox", { name: "Prefer fewer changes" }));
    expect(window.location.search).toContain("prefer=fewer-changes");
    expect(screen.getByRole("region", { name: "Journey details" })).toBeInTheDocument();
  });

  it("tells the user when two stations are the same", () => {
    window.history.replaceState(null, "", "/?from=bank&to=bank");
    render(<App />);
    expect(screen.getByText(/already there/)).toBeInTheDocument();
  });

  it("reports when no route exists", () => {
    const graph = new Graph({
      lines: [{ id: "a", name: "A", colour: "#000" }],
      stations: [
        { id: "x", name: "X", x: 0, y: 0 },
        { id: "y", name: "Y", x: 10, y: 0 },
      ],
      edges: [],
    });
    window.history.replaceState(null, "", "/?from=x&to=y");
    render(<App graph={graph} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No route found");
  });
});
