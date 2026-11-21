# ADR 0005: RAPTOR over TfL timetables

**Status:** Accepted · **Phase:** 3

## Context

Dijkstra over typical run times (ADR 0004) answers "how long does this usually
take?", but not "when will I get there if I leave now?". It also gives exactly
one answer, while a passenger often wants the trade-off: a faster journey with
an extra change, or a simpler one that arrives a few minutes later.

TfL's `/Line/{id}/Timetable/{stop}` endpoint for Underground and DLR lines
includes `knownJourneys`: every departure from a terminus, per schedule
("Monday - Thursday", "Friday", "Saturday", "Sunday"), each tied to a stopping
pattern with cumulative run times.

## Decision

- **Data:** the fetcher keeps trip-level data (about 25,000 departures on the
  Underground and DLR). The compiler groups trips into RAPTOR routes (one per
  distinct stop sequence and set of run times) for four day types, delta-encodes
  departure times, and writes `src/data/timetable.json` (213 kB, 21 kB gzipped).
  The app lazy-loads it as a separate chunk, so the first route still appears
  instantly from the Dijkstra engine.
- **No timetable (Elizabeth line, Overground, gaps):** trips are synthesised
  from the network's run times and an assumed frequency per mode (e.g. every
  15 minutes on the Overground), flagged `estimated` and labelled in the UI.
- **Algorithm:** RAPTOR (Delling, Pajor and Werneck, 2012). Round _k_ computes
  the earliest arrival at every station using at most _k_ trains by scanning
  each route touched in the previous round once, boarding the earliest trip
  that can be caught (binary search), then relaxing walking links. Target
  pruning and an integer route queue keep it fast.
- **Pareto output:** each round that improves the arrival at the destination
  yields an option, giving the trade-off between arrival time and number of
  trains. The UI shows all options and picks the fastest, or with "prefer fewer
  changes" the simplest one within 10 minutes of it.
- **Changes** need a minimum of `changeMinutes` (default 3) between arriving
  and boarding the next train. Walking links are made transitively closed in
  the pipeline, because RAPTOR relaxes one walk at a time.
- **Service days** run past midnight. Before 04:00 the planner also searches the
  previous day's late trains, and after the last train it plans the first
  journey of the next morning.

## Consequences

- Real clock times: "08:35 → 09:23", including waiting for trains.
- p50 query time is about 0.30 ms on 20,000 random weekday journeys
  (`npm run bench`), faster than the Dijkstra engine (about 0.38 ms) while
  returning a whole Pareto set.
- Correctness is checked by property-based tests against a plain
  time-dependent Dijkstra on random timetables (earliest arrival must match,
  and each extra train must buy a strictly earlier arrival), plus unit tests for
  waiting, change times, walks and boarding an earlier trip mid-route.
- Trains that start mid-line (e.g. from a depot) are missing, because TfL
  timetables are fetched from termini. Frequencies on untimetabled lines are
  assumptions.
- The Dijkstra engine stays as the instant first answer and the fallback when
  the timetable can't be loaded.
