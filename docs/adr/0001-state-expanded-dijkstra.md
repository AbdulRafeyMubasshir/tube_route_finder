# ADR 0001: Dijkstra over a (station, line) state graph

**Status:** Accepted · **Phase:** 1

## Context

The original engine ran Dijkstra over stations only, using an O(V²) linear scan
for the next station. Two problems followed:

1. A station-only graph cannot price a change of line. "Fastest" routes could
   include several changes to save seconds, and there was no way to prefer
   fewer changes.
2. The UI looked up "the connection between A and B" after the search, so where
   two lines link the same stations it could show a different line, and time,
   from the one the algorithm used.

## Decision

- Search over states of **(station, arrival line)**. Moving along an edge on a
  different line from the arrival line adds `interchangePenalty` minutes.
- Use a **binary heap** with lazy deletion: O((S + E) log S).
- Order labels by **(cost, interchanges)**, so equal-time routes prefer fewer
  changes.
- Return the **edges actually traversed** (`legs`) and group them into `rides`.
  The UI renders only these, so displayed lines and times always match the search.

## Consequences

- Correctness is checked by property-based tests against a Bellman-Ford oracle
  on random networks, plus golden journeys on the real data.
- The state space is at most stations × lines, which is small. On the current
  network p50 query time is about 30 µs (`npm run bench`).
- This is a stepping stone. Phase 3 replaces it with RAPTOR for timetable-aware,
  multi-criteria (Pareto) results; this implementation stays as the baseline it
  is benchmarked against.
