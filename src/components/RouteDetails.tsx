import type { CSSProperties } from "react";
import type { Graph, Ride, Route } from "../engine";
import { formatMinutes, pluralise } from "../lib/format";

interface Props {
  graph: Graph;
  route: Route;
}

function rideHeading(graph: Graph, ride: Ride): string {
  const line = graph.lines.get(ride.line)?.name ?? ride.line;
  if (ride.terminus) return `${line} line towards ${graph.station(ride.terminus).name}`;
  return `${line} line (${ride.direction.toLowerCase()} rail)`;
}

export function RouteDetails({ graph, route }: Props) {
  if (route.legs.length === 0) {
    return (
      <section className="route" aria-live="polite">
        <p className="muted">You’re already there: pick two different stations.</p>
      </section>
    );
  }

  return (
    <section className="route" aria-live="polite" aria-label="Journey details">
      <div className="route-summary">
        <p className="route-time">{formatMinutes(route.travelMinutes)}</p>
        <p className="muted">
          {pluralise(route.legs.length, "stop")} ·{" "}
          {route.interchanges === 0 ? "no changes" : pluralise(route.interchanges, "change")}
        </p>
      </div>

      <ol className="rides">
        {route.rides.map((ride, index) => {
          const line = graph.lines.get(ride.line);
          const intermediate = ride.stops.slice(0, -1);
          return (
            <li
              key={`${ride.line}-${ride.from}`}
              className="ride"
              style={{ "--line-colour": line?.colour ?? "#666" } as CSSProperties}
            >
              {index > 0 && <p className="change">Change at {graph.station(ride.from).name}</p>}
              <p className="ride-station">{graph.station(ride.from).name}</p>
              <div className="ride-body">
                <p className="ride-line">{rideHeading(graph, ride)}</p>
                <p className="muted">
                  {pluralise(ride.stops.length, "stop")} · {formatMinutes(ride.minutes)}
                </p>
                {intermediate.length > 0 && (
                  <details>
                    <summary>Show stops</summary>
                    <ul className="stops">
                      {intermediate.map((id) => (
                        <li key={id}>{graph.station(id).name}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
              {index === route.rides.length - 1 && (
                <p className="ride-station">{graph.station(ride.to).name}</p>
              )}
            </li>
          );
        })}
      </ol>
      <p className="muted small">Times are in-train only and exclude walking and waiting.</p>
    </section>
  );
}
