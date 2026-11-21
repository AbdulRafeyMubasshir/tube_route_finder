# ADR 0003: TfL data, service patterns and places

**Status:** Accepted · **Phase:** 2 · Supersedes the hand-built data in ADR 0002

## Context

Phase 1 used a hand-built network of 90 stations on 6 lines. Phase 2 moves to
the full network from the [TfL Unified API](https://api.tfl.gov.uk): the
Underground, DLR, Overground and Elizabeth line (19 lines, about 470 stations).

Real data exposed three modelling problems:

1. **Lines branch.** The Northern line has 8 service patterns (via Bank or
   Charing Cross, to Edgware, High Barnet or Mill Hill East). A line-level
   graph lets a route ride "the Northern line" from the Charing Cross branch to
   the Bank branch without changing, which no train does.
2. **Interchanges are several stations.** Bank is a hub containing Bank
   Underground and Bank DLR. Passengers search for "Bank", not for a platform.
3. **Not every mode publishes timetables.** `/Line/{id}/Timetable` works for
   the Underground and DLR but returns 404 for the Elizabeth line and Overground.

## Decision

- **Service patterns are first-class.** Each pattern (TfL "ordered line
  route") is an ordered list of stops. Ride edges are expanded per pattern, and
  the search tracks which pattern you are on. Staying on a train is free;
  boarding any other train, including another pattern of the same line, is a
  change.
- **Places group stations.** A place is a TfL hub (e.g. `HUBBAN`) or a
  stand-alone station. Searches start from every station in the origin place
  and finish at any station in the destination place. Stations in one place,
  and stations in different places within 350 m (e.g. Bank and Monument), are
  linked by walking edges.
- **Run times:** the average of timetabled hop times where available;
  otherwise distance ÷ typical mode speed + dwell, flagged `estimated` and shown
  as "est." in the UI.
- **Pipeline:** `npm run fetch:tfl` downloads a compact snapshot to
  `data/tfl/source.json` (committed, so builds are reproducible and offline).
  `npm run build:network` compiles and validates it into `src/data/network.json`.
  The fetch logic is a pure function taking a `get(path)` callback, so it is
  unit-tested against a fake API and was run against the live API in a browser.
- "Towards" is the set of termini of every pattern that serves the ride, e.g.
  "towards Edgware or High Barnet", rather than a single guessed terminus.

## Consequences

- Correct handling of branches and multi-station interchanges.
- About a third of hops (mostly Overground and Elizabeth line) use estimated
  times. These are marked in the UI and can be replaced if a timetable source is
  added later.
- TfL hop times are whole minutes, so single hops are approximate; averaged
  over a journey the error is small. Golden tests use ranges for this reason.
