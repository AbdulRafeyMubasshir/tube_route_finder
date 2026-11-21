import { useEffect, useMemo, useRef } from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import type { Graph, PlaceId, Route } from "../engine";
import { boundsOf, buildSegments, pairKey, type Bounds } from "../lib/mapSegments";

interface Props {
  graph: Graph;
  route: Route | null;
  from: PlaceId | null;
  to: PlaceId | null;
  onPlaceClick: (id: PlaceId) => void;
  /** Live closures ("line|from|to"); closed sections are drawn dashed. */
  closedHops?: ReadonlySet<string> | undefined;
}

/** Zoom levels at which more labels appear: big interchanges, then all interchanges, then all. */
const MAJOR_LABELS_ZOOM = 1.6;
const ALL_LABELS_ZOOM = 3;

/**
 * Geographic network map. Lines, dots and labels keep a constant on-screen
 * size at any zoom: strokes use non-scaling-stroke, and dot radii and font
 * sizes are scaled by the CSS variable --u (map units per screen pixel).
 */
export function TubeMap({ graph, route, from, to, onPlaceClick, closedHops }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);

  const places = useMemo(() => [...graph.places.values()], [graph]);
  const segments = useMemo(() => buildSegments(graph), [graph]);

  // Start on central London (zone 1), with the rest of the network a pan or zoom away.
  const view = useMemo(() => {
    const central = places.filter((p) => p.zone === 1);
    const b = boundsOf(central.length ? central : places, 250);
    return { ...b, width: b.maxX - b.minX, height: b.maxY - b.minY };
  }, [places]);

  const routeKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const edge of route?.edges ?? []) {
      if (edge.kind === "ride") keys.add(`${pairKey(edge.from, edge.to)}|${edge.line}`);
    }
    return keys;
  }, [route]);
  const routePlaces = useMemo(
    () => new Set(route?.stations.map((id) => graph.station(id).place) ?? []),
    [graph, route],
  );
  const hasRoute = routeKeys.size > 0;

  /** Updates the CSS scale variables after a zoom or resize. */
  const applyScale = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const k = transformRef.current.k;
    const pxPerUnit = Math.min(svg.clientWidth / view.width, svg.clientHeight / view.height) || 1;
    svg.style.setProperty("--u", String(1 / (pxPerUnit * k)));
    svg.dataset.detail = k >= ALL_LABELS_ZOOM ? "all" : k >= MAJOR_LABELS_ZOOM ? "major" : "hubs";
  };

  useEffect(() => {
    const svg = svgRef.current;
    const layer = layerRef.current;
    if (!svg || !layer) return;
    const behaviour = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.12, 25])
      .on("zoom", (event: { transform: ZoomTransform }) => {
        transformRef.current = event.transform;
        layer.setAttribute("transform", event.transform.toString());
        applyScale();
      });
    select(svg).call(behaviour);
    zoomRef.current = behaviour;
    applyScale();

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(applyScale);
    observer?.observe(svg);
    return () => {
      observer?.disconnect();
      select(svg).on(".zoom", null);
    };
    // applyScale only reads refs and `view`, which is stable for a given graph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  /** Pans and zooms so that `bounds` fills the view. */
  const fitTo = (bounds: Bounds) => {
    const svg = svgRef.current;
    if (!svg || !zoomRef.current) return;
    const k = Math.min(
      25,
      Math.max(
        0.12,
        Math.min(
          view.width / (bounds.maxX - bounds.minX),
          view.height / (bounds.maxY - bounds.minY),
        ),
      ),
    );
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    const transform = zoomIdentity
      .translate(view.minX + view.width / 2, view.minY + view.height / 2)
      .scale(k)
      .translate(-cx, -cy);
    select(svg).call(zoomRef.current.transform, transform);
  };

  // Frame the journey whenever a new route is found.
  useEffect(() => {
    if (!route || route.stations.length < 2) return;
    fitTo(
      boundsOf(
        route.stations.map((id) => graph.station(id)),
        400,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  const zoomBy = (factor: number) => {
    if (svgRef.current && zoomRef.current)
      select(svgRef.current).call(zoomRef.current.scaleBy, factor);
  };
  const resetZoom = () => {
    if (svgRef.current && zoomRef.current)
      select(svgRef.current).call(zoomRef.current.transform, zoomIdentity);
  };

  return (
    <div className="map">
      <div className="map-controls" role="group" aria-label="Map zoom">
        <button type="button" onClick={() => zoomBy(1.6)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.6)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={resetZoom}>
          Central London
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={`${view.minX} ${view.minY} ${view.width} ${view.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Network map. Scroll or pinch to zoom, drag to pan, and click a station to set it as your origin or destination."
        data-detail="hubs"
      >
        <g ref={layerRef}>
          <g className={hasRoute ? "segments dimmed" : "segments"}>
            {segments.map((s) => {
              const a = graph.station(s.a);
              const b = graph.station(s.b);
              const onRoute = routeKeys.has(s.key);
              const closed = closedHops?.has(`${s.line}|${s.a}|${s.b}`) ?? false;
              return (
                <line
                  key={s.key}
                  data-testid={onRoute ? "route-segment" : closed ? "closed-segment" : undefined}
                  className={["segment", onRoute ? "on-route" : "", closed ? "closed" : ""]
                    .join(" ")
                    .trim()}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={graph.lines.get(s.line)?.colour}
                />
              );
            })}
          </g>
          <g className="stations">
            {places.map((place) => {
              const onRoute = routePlaces.has(place.id);
              const isEnd = place.id === from || place.id === to;
              const classes = [
                "station",
                place.lines.length > 1 ? "major" : "",
                place.lines.length > 2 ? "hub" : "",
                onRoute ? "on-route" : "",
                hasRoute && !onRoute ? "faded" : "",
                isEnd ? "endpoint" : "",
              ];
              return (
                <g
                  key={place.id}
                  className={classes.filter(Boolean).join(" ")}
                  onClick={() => onPlaceClick(place.id)}
                  data-place={place.id}
                >
                  <circle cx={place.x} cy={place.y} />
                  <text x={place.x} y={place.y} dx="0.7em" dy="-0.5em">
                    {place.name}
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
