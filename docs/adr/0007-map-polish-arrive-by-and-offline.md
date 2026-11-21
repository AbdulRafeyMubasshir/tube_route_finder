# ADR 0007: Readable map, arrive-by planning, and offline use

**Status:** Accepted · **Phase:** 5

## Map: lines side by side, labels that never overlap

**Context.** With 420 stations on a geographic map, lines sharing track
(Circle, District, Hammersmith & City) were drawn on top of each other, and
labels piled up in central London. Fixed zoom thresholds for showing labels
were either too sparse or too cluttered.

**Decision.**

- **Parallel lines:** each line on a shared section gets a perpendicular
  offset in _screen pixels_ (4 px apart). The offset is applied with a CSS
  transform scaled by `--u` (map units per pixel at the current zoom), so it
  stays constant at any zoom with no re-render.
- **Label placement:** after each zoom frame (one per `requestAnimationFrame`),
  `placeLabels` greedily places labels in priority order (journey endpoints,
  stations on the route, then by number of lines). It tries four positions
  around each station and keeps the first that doesn't overlap a placed label.
  A uniform grid keeps each overlap check local, so about 400 labels take well
  under a millisecond. Results are written straight to the DOM to avoid
  re-rendering 400 React components per frame.
- A property test asserts that no two placed labels ever overlap, and the
  label boxes match how they're drawn.

## Arrive-by planning

**Context.** "Get me there by 9:30" is as common as "leave at 9:00". The
textbook answer is reverse RAPTOR (scan backwards from the destination).

**Decision.** Use forward RAPTOR with binary search over departure time.
Earliest arrival never decreases as departure gets later, because trains on a
route don't overtake each other. So for each number of trains, the latest
departure that still arrives in time can be found in about 8 queries (a
4-hour window). It reuses the tested forward engine and the service-day
handling, at a cost of tens of milliseconds, which is fine for an interactive
query. Options are kept only if each extra train buys a later departure.

## Offline, installable app

**Decision.** `vite-plugin-pwa` (Workbox) precaches the app, the network and
the timetable chunk (743 KiB total), so journey planning works with no
connection, which helps underground. Live status uses network-first caching:
the last response is shown when offline, and an offline notice explains what
still works. The web app manifest and icons make it installable.

**Consequences.** A service worker means users can see an old version until it
updates. `registerType: "autoUpdate"` refreshes it on the next load.
