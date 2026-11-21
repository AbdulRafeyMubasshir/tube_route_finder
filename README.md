# London Underground Route Finder

[![CI](https://github.com/AbdulRafeyMubasshir/tube_route_finder/actions/workflows/ci.yml/badge.svg)](https://github.com/AbdulRafeyMubasshir/tube_route_finder/actions/workflows/ci.yml)

A journey planner for the London Underground. Pick two stations, by typing or
by clicking the map, and it finds the fastest route, shows each train you need,
where to change, and highlights the journey on an interactive network map.

**Live demo:** https://tube-route-finder.vercel.app

<!-- TODO: add a GIF of a journey being planned -->

## Features

- **Time-weighted routing.** Dijkstra's algorithm over a (station, line) state
  graph, so it can price changes of line as well as travel time.
- **"Prefer fewer changes"** mode that trades a little time for simpler journeys.
- **Step-by-step journeys**: each ride with its line, direction ("towards
  Stanmore"), stops and time.
- **Interactive map**: pan, zoom, click stations to plan, with the route
  highlighted and the rest of the network dimmed.
- **Accessible station search**: a WAI-ARIA combobox with full keyboard support
  and forgiving matching ("kings" finds King's Cross St Pancras).
- **Shareable URLs**: `?from=brixton&to=stanmore` restores a journey.
- **Responsive** layout for desktop and mobile.

## How it works

```
data/raw/*.json ──► scripts/build-network.mjs ──► src/data/network.json ──► Graph ──► findRoute()
 (per-line data)     normalise · correct · validate    (single, compact)    (indexed)   (Dijkstra)
```

### Routing engine (`src/engine/`)

The engine is a pure TypeScript module with no React or DOM dependencies.

- **State-expanded graph.** Each search state is a _(station, arrival line)_
  pair. Moving along an edge on a different line from the one you arrived on
  adds an optional interchange penalty. A station-only graph can't express this.
- **Binary heap** priority queue: `O((S + E) log S)` for S states and E edges,
  replacing the original `O(V²)` scan.
- **Tie-breaking**: routes of equal time are ranked by fewer changes.
- **Rides**: consecutive legs on the same line and direction are grouped into
  one ride, with its terminus worked out by following the line. Loops such as
  the Circle line are described by rail instead.

See [ADR 0001](docs/adr/0001-state-expanded-dijkstra.md) for the reasoning.

### Data pipeline (`scripts/build-network.mjs`)

Raw data is compiled into a single validated file at build time:

- normalises display names and generates stable ids
- validates unknown stations, non-positive times, duplicate edges, isolated
  stations, connectivity, and missing reverse edges
- applies **documented corrections** for known defects. Its first run found four
  hops with a travel time of 0 minutes.
- CI fails if `src/data/network.json` is out of date

See [ADR 0002](docs/adr/0002-vite-and-build-time-data.md).

## Testing

| Layer  | What is tested                                                                                                                                                                                                 |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine | Unit tests for edge cases (same station, unreachable, unknown ids, parallel lines, penalties, ties)                                                                                                            |
| Engine | **Property-based tests** ([fast-check](https://fast-check.dev)): across 500 random networks per property, the optimal cost matches a Bellman-Ford reference, and every route is a connected path of real edges |
| Data   | Every station reaches every other (8,100 pairs); golden journeys checked against known answers                                                                                                                 |
| UI     | Testing Library tests for search, keyboard navigation, map clicks, URL state and error states                                                                                                                  |

Coverage is enforced in CI (thresholds: 90% lines, 85% branches).

## Performance

`npm run bench` routes every station pair (8,100 journeys × 5 rounds):

| Mode                    | p50    | p95    | p99     |
| ----------------------- | ------ | ------ | ------- |
| Fastest                 | ~32 µs | ~59 µs | ~118 µs |
| 5-minute change penalty | ~30 µs | ~58 µs | ~82 µs  |

Measured on Node 22 in a CI-class Linux container. Numbers vary by machine.

## Getting started

```bash
npm install
npm run dev          # start the dev server
npm test             # run tests
npm run ci           # everything CI runs: data check, lint, format, types, coverage, build
npm run bench        # routing benchmark
npm run build:network  # rebuild src/data/network.json after editing data/raw
```

Requires Node 20 or later (see `.nvmrc`).

## Project structure

```
src/
  engine/        routing engine: Graph, findRoute, MinHeap, types (framework-free)
  data/          generated network.json and the shared graph instance
  components/    React UI: StationCombobox, RouteDetails, TubeMap, Legend
  lib/           search, formatting, URL state, map geometry
scripts/         data pipeline and benchmark
data/raw/        source data, one file per line
docs/adr/        architecture decision records
```

## Limitations and roadmap

The current network is a hand-built subset: 90 stations on 6 lines, with
schematic coordinates and estimated run times. Times are in-train only.

- **Phase 2:** full network from the TfL Unified API, with interchange and walking times
- **Phase 3:** RAPTOR for multi-criteria (Pareto) results, benchmarked against this engine
- **Phase 4:** live line status and rerouting around disruption; step-free routing
- **Phase 5:** geographic map, offline-capable PWA, leave-at / arrive-by
- **Phase 6:** technical write-up and demo video

## Tech

React 19 · TypeScript 5 (strict) · Vite · d3-zoom · Vitest · Testing Library ·
fast-check · ESLint · Prettier · GitHub Actions · Vercel
