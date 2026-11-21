import { useEffect, useMemo, useState } from "react";
import { tubeGraph } from "./data/network";
import { findRoute, type Graph, type PlaceId, type Route } from "./engine";
import type { Timetable } from "./engine/raptor";
import { StationCombobox } from "./components/StationCombobox";
import { RouteDetails } from "./components/RouteDetails";
import { JourneyOptions } from "./components/JourneyOptions";
import { DepartureControl } from "./components/DepartureControl";
import { TubeMap } from "./components/TubeMap";
import { Legend } from "./components/Legend";
import { useJourneyParams } from "./lib/useUrlState";
import { useTimetable } from "./lib/useTimetable";
import { FEWER_CHANGES_PENALTY, LONG_WAIT, recommend } from "./lib/recommend";
import {
  WEEKDAYS,
  formatClock,
  londonNow,
  parseClock,
  planAcrossServiceDays,
  type Weekday,
} from "./lib/serviceTime";

interface Props {
  graph?: Graph;
  /** Injected in tests; defaults to the lazily loaded bundled timetable. */
  timetable?: Timetable | null;
  /** Injected in tests; defaults to the real clock. */
  now?: () => Date;
}

export function App({ graph = tubeGraph, timetable: injected, now = () => new Date() }: Props) {
  const [params, setParams] = useJourneyParams();
  const loaded = useTimetable(graph);
  const timetable = injected === undefined ? loaded : injected;
  const places = useMemo(
    () => [...graph.places.values()].sort((a, b) => a.name.localeCompare(b.name)),
    [graph],
  );

  // Re-plan "leave now" journeys as the clock moves on.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Ignore ids in a shared URL that aren't places.
  const from = params.from && graph.places.has(params.from) ? params.from : null;
  const to = params.to && graph.places.has(params.to) ? params.to : null;
  const plannedAt = params.at ? parseClock(params.at) : null;
  const plannedDay = WEEKDAYS.includes(params.day as Weekday) ? (params.day as Weekday) : null;

  const update = (patch: Partial<typeof params>) => setParams({ ...params, from, to, ...patch });

  // Typical journey (no timetable): instant, and the fallback if no trains run.
  const typical: Route | null = useMemo(
    () =>
      from && to
        ? findRoute(graph, from, to, {
            changePenalty: params.fewerChanges ? FEWER_CHANGES_PENALTY : 0,
          })
        : null,
    [graph, from, to, params.fewerChanges],
  );

  const timed = useMemo(() => {
    if (!timetable || !from || !to || from === to) return null;
    const clock = londonNow(now());
    const weekday = plannedAt !== null ? (plannedDay ?? clock.weekday) : clock.weekday;
    const minutes = plannedAt ?? clock.minutes;
    return { ...planAcrossServiceDays(timetable, from, to, weekday, minutes), minutes };
    // `tick` re-runs "leave now" plans every 30 seconds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timetable, from, to, plannedAt, plannedDay, tick]);

  const [chosen, setChosen] = useState<number | null>(null);
  const [chosenFor, setChosenFor] = useState(timed);
  if (chosenFor !== timed) {
    setChosenFor(timed);
    setChosen(null);
  }
  const journeys = timed?.journeys ?? [];
  const selected = chosen ?? recommend(journeys, params.fewerChanges);
  const journey = journeys[selected] ?? null;
  const route: Route | null = journey ?? typical;

  const onPlaceClick = (id: PlaceId) => {
    if (!from || (from && to)) update({ from: id, to: null });
    else if (id !== from) update({ to: id });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>London Underground Route Finder</h1>
        <p className="muted">
          Journeys across {places.length} stations on the Underground, DLR, Overground and Elizabeth
          line, using TfL timetables.
        </p>
      </header>

      <main className="layout">
        <aside className="panel">
          <form
            className="journey"
            onSubmit={(event) => event.preventDefault()}
            aria-label="Plan a journey"
          >
            <StationCombobox
              label="From"
              placeholder="Start typing a station"
              stations={places}
              value={from}
              onChange={(id) => update({ from: id })}
            />
            <button
              type="button"
              className="swap"
              onClick={() => update({ from: to, to: from })}
              disabled={!from && !to}
              aria-label="Swap origin and destination"
              title="Swap"
            >
              ⇅
            </button>
            <StationCombobox
              label="To"
              placeholder="Start typing a station"
              stations={places}
              value={to}
              onChange={(id) => update({ to: id })}
            />
            <DepartureControl
              at={params.at}
              day={plannedDay}
              onChange={(at, day) => update({ at, day })}
            />
            <label className="checkbox">
              <input
                type="checkbox"
                checked={params.fewerChanges}
                onChange={(event) => update({ fewerChanges: event.target.checked })}
              />
              Prefer fewer changes
            </label>
          </form>

          {route ? (
            <>
              {journey &&
                timed &&
                (timed.nextMorning || journey.departure - timed.minutes > LONG_WAIT) && (
                  <p className="notice" role="status">
                    No trains for a while: the next journey leaves at{" "}
                    {formatClock(journey.departure)}.
                  </p>
                )}
              {timed && journeys.length === 0 && (
                <p className="notice" role="status">
                  No timetabled journey found; showing a typical journey time.
                </p>
              )}
              {journeys.length > 1 && (
                <JourneyOptions journeys={journeys} selected={selected} onSelect={setChosen} />
              )}
              <RouteDetails graph={graph} route={route} journey={journey} />
            </>
          ) : from && to ? (
            <p role="alert">No route found between these stations.</p>
          ) : (
            <p className="muted hint">Choose two stations above, or click them on the map.</p>
          )}
        </aside>

        <section className="map-panel" aria-label="Map">
          <TubeMap graph={graph} route={route} from={from} to={to} onPlaceClick={onPlaceClick} />
          <Legend lines={[...graph.lines.values()]} />
        </section>
      </main>

      <footer className="app-footer muted small">
        Network and timetable data from the TfL Unified API. Powered by TfL Open Data. Not
        affiliated with TfL.
      </footer>
    </div>
  );
}
