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
import { StatusPanel } from "./components/StatusPanel";
import { useLineStatus, type LiveStatus } from "./lib/useLineStatus";
import { useOnline } from "./lib/useOnline";
import {
  CLOSURE_SEVERITIES,
  NO_CONDITIONS,
  conditionsFrom,
  hopKey,
  isDisrupted,
} from "./engine/conditions";
import { useJourneyParams } from "./lib/useUrlState";
import { useTimetable } from "./lib/useTimetable";
import { FEWER_CHANGES_PENALTY, LONG_WAIT, recommend, recommendArriveBy } from "./lib/recommend";
import {
  WEEKDAYS,
  formatClock,
  londonNow,
  parseClock,
  planAcrossServiceDays,
  planArriveBy,
  type Weekday,
} from "./lib/serviceTime";

interface Props {
  graph?: Graph;
  /** Injected in tests; defaults to the lazily loaded bundled timetable. */
  timetable?: Timetable | null;
  /** Injected in tests; defaults to the real clock. */
  now?: () => Date;
  /** Injected in tests; defaults to polling TfL. */
  liveStatus?: LiveStatus | null;
}

const noStatus = () => new Promise<LiveStatus>(() => {});

export function App({
  graph = tubeGraph,
  timetable: injected,
  now = () => new Date(),
  liveStatus,
}: Props) {
  const [params, setParams] = useJourneyParams();
  const online = useOnline();
  const polled = useLineStatus(liveStatus === undefined ? undefined : noStatus);
  const status = liveStatus === undefined ? polled.status : liveStatus;
  const avoidDisruptions = params.live;
  const conditions = useMemo(
    () => (status && avoidDisruptions ? conditionsFrom(status.statuses) : NO_CONDITIONS),
    [status, avoidDisruptions],
  );
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
            conditions,
          })
        : null,
    [graph, from, to, params.fewerChanges, conditions],
  );

  const timed = useMemo(() => {
    if (!timetable || !from || !to || from === to) return null;
    const clock = londonNow(now());
    const weekday = plannedAt !== null ? (plannedDay ?? clock.weekday) : clock.weekday;
    const minutes = plannedAt ?? clock.minutes;
    // Live status describes now, so only apply it to journeys leaving now.
    const options = plannedAt === null ? { conditions } : {};
    if (plannedAt !== null && params.arrive) {
      const journeys = planArriveBy(timetable, from, to, weekday, minutes, options);
      return { journeys, nextMorning: false, minutes: -Infinity, arriveBy: true };
    }
    return {
      ...planAcrossServiceDays(timetable, from, to, weekday, minutes, options),
      minutes,
      arriveBy: false,
    };
    // `tick` re-runs "leave now" plans every 30 seconds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timetable, from, to, plannedAt, plannedDay, params.arrive, tick, conditions]);

  const [chosen, setChosen] = useState<number | null>(null);
  const [chosenFor, setChosenFor] = useState(timed);
  if (chosenFor !== timed) {
    setChosenFor(timed);
    setChosen(null);
  }
  const journeys = timed?.journeys ?? [];
  const selected =
    chosen ??
    (timed?.arriveBy
      ? recommendArriveBy(journeys, params.fewerChanges)
      : recommend(journeys, params.fewerChanges));
  const journey = journeys[selected] ?? null;
  const route: Route | null = journey ?? typical;

  // Disruptions on lines this journey uses, and closures it was routed around.
  const statuses = status?.statuses ?? [];
  const usedLines = new Set(route?.edges.flatMap((e) => (e.kind === "ride" ? [e.line] : [])));
  // Closures are routed around unless the user turned that off, so only then warn about them.
  const onRoute = statuses.filter(
    (s) =>
      isDisrupted(s) &&
      usedLines.has(s.line) &&
      (!CLOSURE_SEVERITIES.has(s.severity) || !avoidDisruptions),
  );
  const undisrupted = useMemo(
    () => (from && to && conditions !== NO_CONDITIONS ? findRoute(graph, from, to) : null),
    [graph, from, to, conditions],
  );
  // Closures that the usual route would have run into.
  const avoided = avoidDisruptions
    ? statuses.filter(
        (s) =>
          CLOSURE_SEVERITIES.has(s.severity) &&
          undisrupted?.edges.some(
            (e) =>
              e.kind === "ride" &&
              e.line === s.line &&
              conditions.closedHops.has(hopKey(e.line, e.from, e.to)),
          ),
      )
    : [];
  const lineName = (id: string) => graph.lines.get(id)?.name ?? id;

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

      {!online && (
        <p className="notice offline" role="status">
          You’re offline. Timetabled journeys still work; live status will update when you
          reconnect.
        </p>
      )}

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
              arrive={params.arrive}
              onChange={(at, day, arrive) => update({ at, day, arrive })}
            />
            <label className="checkbox">
              <input
                type="checkbox"
                checked={params.fewerChanges}
                onChange={(event) => update({ fewerChanges: event.target.checked })}
              />
              Prefer fewer changes
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={avoidDisruptions}
                onChange={(event) => update({ live: event.target.checked })}
              />
              Avoid live disruptions
            </label>
          </form>

          {route ? (
            <>
              {journey &&
                timed &&
                (timed.nextMorning ||
                  (!timed.arriveBy && journey.departure - timed.minutes > LONG_WAIT)) && (
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
              {avoided.length > 0 && (
                <p className="notice" role="status">
                  Rerouted to avoid:{" "}
                  {[...new Set(avoided.map((s) => `${lineName(s.line)} (${s.description})`))].join(
                    ", ",
                  )}
                  .
                </p>
              )}
              {onRoute.length > 0 && (
                <p className="notice warning">
                  {[...new Set(onRoute.map((s) => `${lineName(s.line)}: ${s.description}`))].join(
                    ". ",
                  )}
                  .{avoidDisruptions && " Journey times allow for delays."}
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

          <StatusPanel graph={graph} status={status} error={polled.error} />
        </aside>

        <section className="map-panel" aria-label="Map">
          <TubeMap
            graph={graph}
            route={route}
            from={from}
            to={to}
            onPlaceClick={onPlaceClick}
            closedHops={avoidDisruptions ? conditions.closedHops : undefined}
          />
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
