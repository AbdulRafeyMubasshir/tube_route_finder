import { useMemo } from "react";
import { network, tubeGraph } from "./data/network";
import { findRoute, type Graph, type PlaceId } from "./engine";
import { StationCombobox } from "./components/StationCombobox";
import { RouteDetails } from "./components/RouteDetails";
import { TubeMap } from "./components/TubeMap";
import { Legend } from "./components/Legend";
import { useJourneyParams } from "./lib/useUrlState";

/** Extra cost per change when "fewer changes" is on (steers the search; not added to times). */
export const FEWER_CHANGES_PENALTY = 8;

export function App({ graph = tubeGraph }: { graph?: Graph }) {
  const [params, setParams] = useJourneyParams();
  const places = useMemo(
    () => [...graph.places.values()].sort((a, b) => a.name.localeCompare(b.name)),
    [graph],
  );
  // Ignore ids in a shared URL that aren't stations.
  const from = params.from && graph.places.has(params.from) ? params.from : null;
  const to = params.to && graph.places.has(params.to) ? params.to : null;

  const route = useMemo(
    () =>
      from && to
        ? findRoute(graph, from, to, {
            changePenalty: params.fewerChanges ? FEWER_CHANGES_PENALTY : 0,
          })
        : null,
    [graph, from, to, params.fewerChanges],
  );

  const update = (patch: Partial<typeof params>) => setParams({ ...params, from, to, ...patch });

  const onPlaceClick = (id: PlaceId) => {
    if (!from || (from && to)) update({ from: id, to: null });
    else if (id !== from) update({ to: id });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>London Underground Route Finder</h1>
        <p className="muted">
          Fastest journeys across {places.length} stations on the Underground, DLR, Overground and
          Elizabeth line.
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
            <RouteDetails graph={graph} route={route} />
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
        Network data from the TfL Unified API
        {network.fetchedAt ? ` (${new Date(network.fetchedAt).toLocaleDateString("en-GB")})` : ""}.
        Powered by TfL Open Data. Not affiliated with TfL.
      </footer>
    </div>
  );
}
