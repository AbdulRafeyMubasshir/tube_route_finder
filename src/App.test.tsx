import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { recommend, recommendArriveBy } from "./lib/recommend";
import { Timetable, type Journey, type TimetableData } from "./engine/raptor";
import timetableData from "./data/timetable.json";
import { Graph, findRoute } from "./engine";
import { makeNetwork } from "./engine/testNetwork";
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
    render(<App timetable={null} liveStatus={null} />);
    expect(
      screen.getByRole("heading", { name: "London Underground Route Finder" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Choose two stations/)).toBeInTheDocument();
  });

  it("plans a journey and shows each ride", async () => {
    render(<App timetable={null} liveStatus={null} />);
    await chooseStation("From", "brix", "Brixton");
    await chooseStation("To", "stanm", "Stanmore");

    const details = screen.getByRole("region", { name: "Journey details" });
    const expected = findRoute(tubeGraph, "brixton", "stanmore")!;
    expect(within(details).getByText(formatMinutes(expected.totalMinutes))).toBeInTheDocument();
    expect(within(details).getByText(/1 change · typical time$/)).toBeInTheDocument();
    expect(
      within(details).getByText("Victoria line towards Walthamstow Central"),
    ).toBeInTheDocument();
    expect(within(details).getByText("Jubilee line towards Stanmore")).toBeInTheDocument();
    expect(within(details).getByText("Change at Green Park")).toBeInTheDocument();
    expect(window.location.search).toBe("?from=brixton&to=stanmore");
  });

  it("highlights only the segments the route uses", async () => {
    window.history.replaceState(null, "", "/?from=brixton&to=stanmore");
    render(<App timetable={null} liveStatus={null} />);
    const hops = findRoute(tubeGraph, "brixton", "stanmore")!.edges.length;
    expect(screen.getAllByTestId("route-segment")).toHaveLength(hops);
  });

  it("restores a journey from the URL and swaps direction", async () => {
    window.history.replaceState(null, "", "/?from=walthamstow-central&to=brixton");
    const user = userEvent.setup();
    render(<App timetable={null} liveStatus={null} />);
    expect(screen.getByRole("combobox", { name: "From" })).toHaveValue("Walthamstow Central");
    expect(screen.getByText("Victoria line towards Brixton")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Swap origin and destination" }));
    expect(screen.getByRole("combobox", { name: "From" })).toHaveValue("Brixton");
    expect(screen.getByRole("combobox", { name: "To" })).toHaveValue("Walthamstow Central");
    expect(screen.getByText("Victoria line towards Walthamstow Central")).toBeInTheDocument();
  });

  it("ignores unknown place ids in the URL", () => {
    window.history.replaceState(null, "", "/?from=atlantis&to=bank");
    render(<App timetable={null} liveStatus={null} />);
    expect(screen.getByRole("combobox", { name: "From" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "To" })).toHaveValue("Bank");
  });

  it("sets origin then destination when stations are clicked on the map", () => {
    // fireEvent rather than userEvent: d3-zoom's mousedown handler needs a real window view.
    const { container } = render(<App timetable={null} liveStatus={null} />);
    const click = (id: string) => fireEvent.click(container.querySelector(`[data-place="${id}"]`)!);

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
    window.history.replaceState(null, "", "/?from=brixton&to=stanmore");
    const user = userEvent.setup();
    render(<App timetable={null} liveStatus={null} />);
    await user.click(screen.getByRole("checkbox", { name: "Prefer fewer changes" }));
    expect(window.location.search).toContain("prefer=fewer-changes");
    expect(screen.getByRole("region", { name: "Journey details" })).toBeInTheDocument();
  });

  it("tells the user when two stations are the same", () => {
    window.history.replaceState(null, "", "/?from=bank&to=bank");
    render(<App timetable={null} liveStatus={null} />);
    expect(screen.getByText(/already there/)).toBeInTheDocument();
  });

  it("reports when no route exists", () => {
    const graph = new Graph(
      makeNetwork([
        ["a", ["x", "y"], 1],
        ["b", ["p", "q"], 1],
      ]),
    );
    window.history.replaceState(null, "", "/?from=x&to=q");
    render(<App graph={graph} timetable={null} liveStatus={null} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No route found");
  });
});

describe("App with timetables", () => {
  const timetable = new Timetable(tubeGraph, timetableData as TimetableData);
  // Monday 2026-11-23 09:00 in London (GMT).
  const monday9am = () => new Date("2026-11-23T09:00:00Z");

  beforeEach(() => window.history.replaceState(null, "", "/?from=brixton&to=stanmore"));

  it("shows clock times from the timetable when leaving now", () => {
    render(<App timetable={timetable} now={monday9am} liveStatus={null} />);
    const details = screen.getByRole("region", { name: "Journey details" });
    expect(within(details).getByText(/^09:\d\d → 09:\d\d$/)).toBeInTheDocument();
    expect(within(details).getByText(/Times from TfL timetables/)).toBeInTheDocument();
    expect(
      within(details).getByText("Victoria line towards Walthamstow Central"),
    ).toBeInTheDocument();
  });

  it("plans for a chosen day and time from the URL", () => {
    window.history.replaceState(null, "", "/?from=brixton&to=stanmore&at=07:30&day=sat");
    render(<App timetable={timetable} now={monday9am} liveStatus={null} />);
    expect(screen.getByRole("combobox", { name: "When to travel" })).toHaveValue("at");
    expect(screen.getByRole("combobox", { name: "Day" })).toHaveValue("sat");
    expect(screen.getByText(/^07:\d\d → 08:\d\d$/)).toBeInTheDocument();
  });

  it("switches between leaving now and a planned time", async () => {
    const user = userEvent.setup();
    render(<App timetable={timetable} now={monday9am} liveStatus={null} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "When to travel" }), "at");
    expect(window.location.search).toMatch(/at=\d\d%3A\d\d&day=\w{3}/);
    await user.selectOptions(screen.getByRole("combobox", { name: "Day" }), "sun");
    expect(window.location.search).toContain("day=sun");
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "10:15" } });
    expect(window.location.search).toContain("at=10%3A15");
    await user.selectOptions(screen.getByRole("combobox", { name: "When to travel" }), "now");
    expect(window.location.search).not.toContain("at=");
  });

  it("plans to arrive by a time", async () => {
    window.history.replaceState(null, "", "/?from=brixton&to=stanmore&at=09:30&day=wed&by=arrive");
    const user = userEvent.setup();
    render(<App timetable={timetable} now={monday9am} liveStatus={null} />);
    expect(screen.getByRole("combobox", { name: "When to travel" })).toHaveValue("arrive");
    const clock = screen.getByText(/^0\d:\d\d → 0\d:\d\d$/);
    const [, arrival] = clock.textContent!.split(" → ");
    expect(arrival! <= "09:30").toBe(true);
    expect(screen.queryByText(/No trains for a while/)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "When to travel" }), "at");
    expect(window.location.search).not.toContain("by=arrive");
  });

  it("shows the next morning's first journey late at night", () => {
    window.history.replaceState(null, "", "/?from=morden&to=high-barnet&at=02:30&day=tue");
    render(<App timetable={timetable} now={monday9am} liveStatus={null} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      /No trains for a while: the next journey leaves at 0[45]:\d\d/,
    );
  });

  it("lets you pick between journey options", async () => {
    const network = makeNetwork([
      ["slow", ["a", "z"], 30],
      ["red", ["a", "m"], 5],
      ["blue", ["m", "z"], 5],
    ]);
    const graph = new Graph(network);
    const everyDay = (times: number[]) => ({
      weekday: times,
      friday: times,
      saturday: times,
      sunday: times,
    });
    const small = new Timetable(graph, {
      routes: [
        { line: "slow", stops: ["a", "z"], times: [0, 30], trips: everyDay([600]) },
        { line: "red", stops: ["a", "m"], times: [0, 5], trips: everyDay([600]) },
        { line: "blue", stops: ["m", "z"], times: [0, 5], trips: everyDay([610]) },
      ],
    });
    window.history.replaceState(null, "", "/?from=a&to=z&at=10:00&day=wed");
    const user = userEvent.setup();
    render(<App graph={graph} timetable={small} now={monday9am} liveStatus={null} />);

    const options = within(screen.getByRole("group", { name: "Journey options" })).getAllByRole(
      "button",
    );
    expect(options).toHaveLength(2);
    expect(options[1]).toHaveAttribute("aria-pressed", "true"); // fastest by default
    await user.click(options[0]!);
    expect(options[0]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("SLOW line towards Z")).toBeInTheDocument();
  });
});

describe("recommend", () => {
  const j = (arrival: number) => ({ arrival }) as Journey;
  const d = (departure: number) => ({ departure }) as Journey;
  it("prefers the latest departure when arriving by a time", () => {
    expect(recommendArriveBy([], false)).toBe(-1);
    expect(recommendArriveBy([d(500), d(530)], false)).toBe(1);
    expect(recommendArriveBy([d(525), d(530)], true)).toBe(0);
    expect(recommendArriveBy([d(500), d(530)], true)).toBe(1);
  });
  it("picks the fastest, or the simplest within tolerance when preferring fewer changes", () => {
    expect(recommend([], false)).toBe(-1);
    expect(recommend([j(100), j(95), j(80)], false)).toBe(2);
    expect(recommend([j(100), j(88), j(80)], true)).toBe(1);
    expect(recommend([j(89), j(88), j(80)], true)).toBe(0);
  });
});

describe("App with live status", () => {
  const live = {
    updatedAt: new Date("2026-11-21T22:00:00Z"),
    statuses: [
      {
        line: "jubilee",
        severity: 5,
        description: "Part Closure",
        reason: "No service between Green Park and Bond Street.",
        closedSections: [["940GZZLUGPK", "940GZZLUBND"]],
      },
      {
        line: "victoria",
        severity: 9,
        description: "Minor Delays",
        reason: "Signal failure.",
        closedSections: [],
      },
      {
        line: "central",
        severity: 10,
        description: "Good Service",
        reason: null,
        closedSections: [],
      },
    ],
  };

  beforeEach(() => window.history.replaceState(null, "", "/?from=brixton&to=stanmore"));

  it("routes around a closure, warns about delays, and lists disrupted lines", () => {
    const { container } = render(<App timetable={null} liveStatus={live} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Rerouted to avoid: Jubilee (Part Closure)",
    );
    expect(
      screen.getByText(/Victoria: Minor Delays\. Journey times allow for delays\./),
    ).toBeInTheDocument();

    const panel = screen.getByRole("region", { name: "Live line status" });
    expect(within(panel).getByText("Part Closure")).toBeInTheDocument();
    expect(within(panel).getByText("Minor Delays")).toBeInTheDocument();
    expect(within(panel).queryByText("Central")).not.toBeInTheDocument();
    expect(within(panel).getByText(/Updated \d\d:\d\d/)).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="closed-segment"]').length).toBeGreaterThan(0);
  });

  it("can ignore live disruptions", async () => {
    const user = userEvent.setup();
    render(<App timetable={null} liveStatus={live} />);
    await user.click(screen.getByRole("checkbox", { name: "Avoid live disruptions" }));
    expect(window.location.search).toContain("live=off");
    expect(screen.queryByText(/Rerouted to avoid/)).not.toBeInTheDocument();
    expect(screen.getByText("Jubilee line towards Stanmore")).toBeInTheDocument();
  });

  it("says when everything is running normally", () => {
    render(
      <App
        timetable={null}
        liveStatus={{ updatedAt: new Date(), statuses: [live.statuses[2]!] }}
      />,
    );
    expect(screen.getByText("Good service on all lines.")).toBeInTheDocument();
  });

  it("tells you when you're offline", () => {
    const spy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<App timetable={null} liveStatus={null} />);
    expect(screen.getByText(/You’re offline/)).toBeInTheDocument();
    spy.mockRestore();
  });

  it("shows when live status is unavailable", () => {
    render(<App timetable={null} liveStatus={null} />);
    expect(screen.getByRole("region", { name: "Live line status" })).toHaveTextContent("Loading");
  });
});
