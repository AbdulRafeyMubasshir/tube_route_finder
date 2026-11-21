# London Underground Route Finder

[![CI](https://github.com/AbdulRafeyMubasshir/tube_route_finder/actions/workflows/ci.yml/badge.svg)](https://github.com/AbdulRafeyMubasshir/tube_route_finder/actions/workflows/ci.yml)

A journey planner for London's rail network: the Underground, DLR, Overground
and Elizabeth line. Pick two stations and a time, and it plans journeys on real
TfL timetables with **RAPTOR**, the algorithm behind production journey
planners. It shows the trade-off between faster journeys with more changes and
simpler ones, gives clock times for every step, and frames the journey on a
geographic map.

**Live demo:** https://tube-route-finder.vercel.app

<!-- TODO: add a GIF of a journey being planned -->

## Features

- **Timetabled journeys** ("08:35 → 09:23") from about 25,000 TfL departures,
  for leaving now or at a chosen day and time. It handles trains running past
  midnight and tells you when trains have stopped.
- **Pareto-optimal options**: the faster journey with more changes, and the
  simpler ones, each one a real trade-off.
- **Whole network:** 420 stations on 19 lines, built from the TfL Unified API.
- **Branch-aware routing.** The engine knows which trains actually run where.
  It won't ride "the Northern line" from the Charing Cross branch to the Bank
  branch without a change, and it tells you every train that works ("Northern
  line towards Edgware or High Barnet").
- **Realistic journey times:** timetabled run times, a change allowance, and
  walking links between nearby stations (e.g. Bank ↔ Monument). Estimated times
  are labelled.
- **"Prefer fewer changes"** mode that trades a little time for simpler journeys.
- **Interactive geographic map:** pan and zoom, with labels that appear as you
  zoom in. It frames each route automatically, and you can click stations to
  plan.
- **Accessible station search**: a WAI-ARIA combobox with full keyboard support
  and forgiving matching ("kings" finds King's Cross St Pancras).
- **Shareable URLs**: `?from=brixton&to=stanmore` restores a journey.

## How it works

```
TfL Unified API ─► fetch:tfl ─► data/tfl/source.json ─► build:network ─┬─► network.json   ─► Graph     ─► findRoute()    (Dijkstra, typical times)
                   (patterns,     (committed snapshot)    (normalise,     └─► timetable.json ─► Timetable ─► planJourneys()  (RAPTOR, clock times)
                    stops, trips)                          validate)          (lazy-loaded)
```

### Routing engine (`src/engine/`)

A pure TypeScript module with no React or DOM dependencies, with two routers:

- **`planJourneys` (RAPTOR):** answers "when will I get there?". Round _k_ finds
  the earliest arrival everywhere using at most _k_ trains, by scanning each
  route touched in the previous round once and boarding the earliest catchable
  trip (binary search). Walks are relaxed between rounds. Each round that
  improves the destination arrival is a Pareto option. A minimum change time
  applies, and target pruning keeps it fast. See
  [ADR 0005](docs/adr/0005-raptor-with-tfl-timetables.md).
- **`findRoute` (Dijkstra):** answers "how long does this usually take?" from
  average run times. It is instant, needs no timetable, and is the fallback.

Both share the same model:

- **Service patterns, not lines.** TfL publishes each line as ordered stopping
  patterns (8 for the Northern line). The search tracks which train you are on:
  staying on it is free, and boarding any other train is a change.
- **Places, not platforms.** A place groups the stations of an interchange
  (e.g. Bank Underground and Bank DLR). Searches start from every station in the
  origin and finish at any station in the destination, with walking links in
  between.
- **State model.** The states are _at a station_ (not yet boarded, or on the
  platform after a train) and _on a train_ (position _j_ of pattern _p_). From a
  train you can stay on or alight; from a station you can board or walk. This
  keeps work linear at busy interchanges.
- **Integer-indexed search.** States and transitions are precompiled into
  typed arrays (compressed sparse row). Dijkstra runs on a binary heap with
  `Float64Array` costs. This was about 5× faster than the string-keyed version.
- **Costs**: time + `changeMinutes` per change (counted in the journey time) +
  an optional `changePenalty` (steers the choice only). Ties prefer fewer changes.

Design decisions are recorded in [`docs/adr/`](docs/adr).

### Data pipeline (`scripts/`)

- `npm run fetch:tfl` downloads lines, stopping patterns, stations, hubs and
  timetables, paced for the API's rate limits (set `TFL_APP_KEY` to go faster).
- `npm run build:network` compiles the snapshot:
  - groups stations into places and gives clashing names distinct labels
    ("Bethnal Green (Overground)")
  - averages timetabled hop times; where TfL publishes no timetable (Elizabeth
    line, Overground) it estimates from distance and typical speed, and flags
    the result
  - adds walking links within interchanges and between stations under 350 m apart
  - **validates**: unknown stops, non-positive times, suspicious outliers, and
    that every place can reach and be reached from every other
- A weekly GitHub Action refreshes the snapshot and opens a pull request, which
  CI must pass.

## Testing

| Layer    | What is tested                                                                                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RAPTOR   | Waiting, last trains, minimum change time, Pareto options, walks, boarding an earlier trip mid-route; **property test** against a time-dependent Dijkstra on 400 random timetables |
| Engine   | Edge cases: same place, unreachable, one-way patterns, parallel lines, branch changes, shared sections, walking, multi-station origins, penalties, ties                            |
| Engine   | **Property-based tests** ([fast-check](https://fast-check.dev)): on 400 random networks per property, results match a simple Bellman-Ford reference and are always valid paths     |
| Pipeline | Fetch logic against a fake TfL API; compilation, estimates, walking links, name clashes and validation errors                                                                      |
| Data     | Connectivity across the real network; golden journeys (Brixton→Stanmore, Morden→High Barnet, Heathrow T5→Canary Wharf…)                                                            |
| UI       | Testing Library tests for search, keyboard navigation, map clicks, URL state and error states                                                                                      |

Coverage is enforced in CI (thresholds: 90% lines, 85% branches).

## Performance

`npm run bench` times 20,000 fixed pseudo-random journeys on the full network
(420 places, 3,539 search states, 243 timetable routes), departing between
06:00 and 22:00 on a weekday for RAPTOR:

| Router                              | p50     | p95     | p99     |
| ----------------------------------- | ------- | ------- | ------- |
| RAPTOR, timetabled, full Pareto set | ~300 µs | ~440 µs | ~550 µs |
| Dijkstra, typical times             | ~380 µs | ~660 µs | ~800 µs |
| Dijkstra, fewer changes             | ~350 µs | ~720 µs | ~920 µs |

Measured on Node 22 in a CI-class Linux container. Numbers vary by machine.

## Getting started

```bash
npm install
npm run dev            # start the dev server
npm test               # run tests
npm run ci             # everything CI runs: data check, lint, format, types, coverage, build
npm run bench          # routing benchmark
npm run fetch:tfl      # refresh data/tfl/source.json from the TfL API
npm run build:network  # recompile src/data/network.json
```

Requires Node 20 or later (see `.nvmrc`).

## Project structure

```
src/
  engine/        routing engine: raptor (Timetable, planJourneys), Graph, StateIndex, findRoute, MinHeap
  data/          generated network.json and timetable.json, and the shared graph instance
  components/    React UI: StationCombobox, RouteDetails, TubeMap, Legend
  lib/           service days and clock times, journey choice, search, URL state, map geometry
scripts/
  tfl/           TfL fetcher, network and timetable compilers (pure, unit-tested)
  fetch-tfl.ts   CLI: download the snapshot
  build-network.ts  CLI: compile and validate
  benchmark.ts
data/tfl/        committed TfL snapshot
docs/adr/        architecture decision records
```

## Limitations and roadmap

- Elizabeth line and Overground have no TfL timetable: run times are estimated
  from distance and trips from an assumed frequency (marked "est.").
- Trains that start mid-line (e.g. from depots) are missing, as timetables are
  fetched from termini.
- Shared track sections (e.g. Circle, District, H&C) are drawn on top of each
  other rather than side by side.

Next:

- **Phase 4:** live line status and rerouting around disruption; step-free routing
- **Phase 5:** map polish (parallel lines, label collision), offline-capable PWA, leave-at / arrive-by
- **Phase 6:** technical write-up and demo video

## Tech

React 19 · TypeScript 5 (strict) · Vite · d3-zoom · Vitest · Testing Library ·
fast-check · ESLint · Prettier · GitHub Actions · Vercel

Data: Powered by TfL Open Data. Contains OS data © Crown copyright and database
rights. Not affiliated with or endorsed by Transport for London.
