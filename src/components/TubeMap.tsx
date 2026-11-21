import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import type { Graph, PlaceId, Route } from "../engine";
import { boundsOf, buildSegments, pairKey, type Bounds } from "../lib/mapSegments";
import { placeLabels, type LabelPosition } from "../lib/labels";

interface Props {
  graph: Graph;
  route: Route | null;
  from: PlaceId | null;
  to: PlaceId | null;
  onPlaceClick: (id: PlaceId) => void;
  /** Live closures ("line|from|to"); closed sections are drawn dashed. */
  closedHops?: ReadonlySet<string> | undefined;
}

/** Label geometry in screen pixels (12px font). */
const CHAR_WIDTH = 6.6;
const LABEL_HEIGHT = 14;
const LABEL_ATTRIBUTES: Record<LabelPosition, { anchor: string; dx: string; dy: string }> = {
  ne: { anchor: "start", dx: "0.7em", dy: "-0.5em" },
  se: { anchor: "start", dx: "0.7em", dy: "1.2em" },
  nw: { anchor: "end", dx: "-0.7em", dy: "-0.5em" },
  sw: { anchor: "end", dx: "-0.7em", dy: "1.2em" },
};

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

  /**
   * Places station labels for the current view so they never overlap:
   * route stations first, then by number of lines. Runs after each zoom
   * frame, writing straight to the DOM to avoid re-rendering 400 stations.
   */
  const layoutLabels = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const { k, x: tx, y: ty } = transformRef.current;
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const scale = Math.min(width / view.width, height / view.height) || 1;
    const offsetX = (width - view.width * scale) / 2;
    const offsetY = (height - view.height * scale) / 2;
    const groups = svg.querySelectorAll<SVGGElement>("g.station");
    const inputs = [...groups].flatMap((g) => {
      const place = graph.places.get(g.dataset.place ?? "");
      if (!place || g.classList.contains("faded")) return [];
      const priority =
        (g.classList.contains("endpoint") ? 100 : 0) +
        (g.classList.contains("on-route") ? 50 : 0) +
        place.lines.length;
      return [
        {
          id: place.id,
          x: (k * place.x + tx - view.minX) * scale + offsetX,
          y: (k * place.y + ty - view.minY) * scale + offsetY,
          width: place.name.length * CHAR_WIDTH,
          height: LABEL_HEIGHT,
          priority,
        },
      ];
    });
    const placed = placeLabels(inputs, { width, height });
    for (const g of groups) {
      const text = g.querySelector("text");
      if (!text) continue;
      const position = placed.get(g.dataset.place ?? "");
      text.style.display = position ? "" : "none";
      if (position) {
        const { anchor, dx, dy } = LABEL_ATTRIBUTES[position];
        text.setAttribute("text-anchor", anchor);
        text.setAttribute("dx", dx);
        text.setAttribute("dy", dy);
      }
    }
  };

  /** Updates the CSS scale variable after a zoom or resize, then lays out labels (once per frame). */
  const frame = useRef(0);
  const applyScale = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const k = transformRef.current.k;
    const pxPerUnit = Math.min(svg.clientWidth / view.width, svg.clientHeight / view.height) || 1;
    svg.style.setProperty("--u", String(1 / (pxPerUnit * k)));
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(layoutLabels);
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
                  style={{ "--ox": s.ox, "--oy": s.oy } as CSSProperties}
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
