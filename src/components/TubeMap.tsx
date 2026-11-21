import { useEffect, useMemo, useRef } from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import type { Graph, Route, StationId } from "../engine";
import { buildSegments, pairKey } from "../lib/mapSegments";

interface Props {
  graph: Graph;
  route: Route | null;
  from: StationId | null;
  to: StationId | null;
  onStationClick: (id: StationId) => void;
}

export function TubeMap({ graph, route, from, to, onStationClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const stations = useMemo(() => [...graph.stations.values()], [graph]);
  const segments = useMemo(() => buildSegments(graph), [graph]);

  const viewBox = useMemo(() => {
    const xs = stations.map((s) => s.x);
    const ys = stations.map((s) => s.y);
    const minX = Math.min(...xs) - 40;
    const minY = Math.min(...ys) - 40;
    // Extra room on the right for labels, which sit to the right of each station.
    const width = Math.max(...xs) - minX + 200;
    const height = Math.max(...ys) - minY + 40;
    return `${minX} ${minY} ${width} ${height}`;
  }, [stations]);

  const routeSegments = useMemo(
    () => new Set(route?.legs.map((leg) => `${pairKey(leg.from, leg.to)}|${leg.line}`) ?? []),
    [route],
  );
  const routeStations = useMemo(() => new Set(route?.stations ?? []), [route]);
  const hasRoute = routeSegments.size > 0;

  useEffect(() => {
    const svg = svgRef.current;
    const layer = layerRef.current;
    if (!svg || !layer) return;
    const behaviour = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on("zoom", (event: { transform: { toString(): string } }) => {
        layer.setAttribute("transform", event.transform.toString());
      });
    select(svg).call(behaviour);
    zoomRef.current = behaviour;
    return () => {
      select(svg).on(".zoom", null);
    };
  }, []);

  const zoomBy = (factor: number) => {
    if (svgRef.current && zoomRef.current)
      select(svgRef.current).call(zoomRef.current.scaleBy, factor);
  };
  const resetZoom = () => {
    if (svgRef.current && zoomRef.current) {
      select(svgRef.current).call(zoomRef.current.transform, zoomIdentity);
    }
  };

  return (
    <div className="map">
      <div className="map-controls" role="group" aria-label="Map zoom">
        <button type="button" onClick={() => zoomBy(1.5)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.5)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={resetZoom}>
          Reset
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Network map. Scroll or pinch to zoom, drag to pan, and click a station to set it as your origin or destination."
      >
        <g ref={layerRef}>
          <g className={hasRoute ? "segments dimmed" : "segments"}>
            {segments.map((s) => {
              const a = graph.station(s.a);
              const b = graph.station(s.b);
              const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
              const dx = (-(b.y - a.y) / length) * s.offset;
              const dy = ((b.x - a.x) / length) * s.offset;
              const onRoute = routeSegments.has(s.key);
              return (
                <line
                  key={s.key}
                  data-testid={onRoute ? "route-segment" : undefined}
                  className={onRoute ? "segment on-route" : "segment"}
                  x1={a.x + dx}
                  y1={a.y + dy}
                  x2={b.x + dx}
                  y2={b.y + dy}
                  stroke={graph.lines.get(s.line)?.colour}
                />
              );
            })}
          </g>
          <g className="stations">
            {stations.map((station) => {
              const isEnd = station.id === from || station.id === to;
              const classes = [
                "station",
                routeStations.has(station.id) ? "on-route" : "",
                hasRoute && !routeStations.has(station.id) ? "faded" : "",
                isEnd ? "endpoint" : "",
              ];
              return (
                <g
                  key={station.id}
                  className={classes.filter(Boolean).join(" ")}
                  onClick={() => onStationClick(station.id)}
                  data-station={station.id}
                >
                  <circle cx={station.x} cy={station.y} r={isEnd ? 11 : 7} />
                  <text x={station.x + 12} y={station.y - 10}>
                    {station.name}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}
