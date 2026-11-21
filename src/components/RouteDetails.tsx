import type { CSSProperties } from "react";
import type { Graph, RideSegment, Route } from "../engine";
import { formatMinutes, pluralise } from "../lib/format";

interface Props {
  graph: Graph;
  route: Route;
}

function lineLabel(graph: Graph, lineId: string): string {
  const line = graph.lines.get(lineId);
  if (!line) return lineId;
  // "Elizabeth line", "DLR" and the Overground lines are named without "line".
  return line.mode === "tube" ? `${line.name} line` : line.name;
}

function towardsLabel(graph: Graph, ride: RideSegment): string {
  const names = ride.towards.map((id) => graph.station(id).name);
  if (names.length === 0) return "";
  if (names.length <= 3) return `towards ${names.join(" or ")}`;
  return `towards ${names.slice(0, 2).join(", ")} or ${names.length - 2} others`;
}

export function RouteDetails({ graph, route }: Props) {
  if (route.segments.length === 0) {
    return (
      <section className="route" aria-live="polite">
        <p className="muted">You’re already there: pick two different stations.</p>
      </section>
    );
  }

  const stops = route.segments.reduce((n, s) => (s.kind === "ride" ? n + s.stops.length : n), 0);
  const estimated = route.segments.some((s) => s.kind === "ride" && s.estimated);
  const lastRide = route.segments.findLastIndex((s) => s.kind === "ride");

  return (
    <section className="route" aria-live="polite" aria-label="Journey details">
      <div className="route-summary">
        <p className="route-time">{formatMinutes(route.totalMinutes)}</p>
        <p className="muted">
          {pluralise(stops, "stop")} ·{" "}
          {route.interchanges === 0 ? "no changes" : pluralise(route.interchanges, "change")}
        </p>
      </div>

      <ol className="rides">
        {route.segments.map((segment, index) => {
          if (segment.kind === "walk") {
            return (
              <li key={`walk-${segment.from}`} className="walk">
                <p>
                  Walk to {graph.station(segment.to).name} · {formatMinutes(segment.minutes)}
                </p>
              </li>
            );
          }
          const line = graph.lines.get(segment.line);
          const intermediate = segment.stops.slice(0, -1);
          const previous = route.segments[index - 1];
          return (
            <li
              key={`${segment.line}-${segment.from}`}
              className="ride"
              style={{ "--line-colour": line?.colour ?? "#666" } as CSSProperties}
            >
              {previous?.kind === "ride" && (
                <p className="change">Change at {graph.station(segment.from).name}</p>
              )}
              <p className="ride-station">{graph.station(segment.from).name}</p>
              <div className="ride-body">
                <p className="ride-line">
                  {lineLabel(graph, segment.line)} {towardsLabel(graph, segment)}
                </p>
                <p className="muted">
                  {pluralise(segment.stops.length, "stop")} · {formatMinutes(segment.minutes)}
                  {segment.estimated && (
                    <span title="No timetable available; estimated from distance"> (est.)</span>
                  )}
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
              {index === lastRide && (
                <p className="ride-station">{graph.station(segment.to).name}</p>
              )}
            </li>
          );
        })}
      </ol>
      <p className="muted small">{footnote(route, estimated)}</p>
    </section>
  );
}

function footnote(route: Route, estimated: boolean): string {
  const parts: string[] = [];
  if (route.changeMinutes > 0) parts.push(`${formatMinutes(route.changeMinutes)} for changes`);
  if (route.walkMinutes > 0) parts.push(`${formatMinutes(route.walkMinutes)} walking`);
  return [
    parts.length ? `Includes ${parts.join(" and ")}.` : "",
    "Excludes waiting for the first train.",
    estimated ? "Times marked “est.” are estimated from distance." : "",
  ]
    .filter(Boolean)
    .join(" ");
}
