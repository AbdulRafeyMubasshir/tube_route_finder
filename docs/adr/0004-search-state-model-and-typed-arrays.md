# ADR 0004: Station/train state model and integer-indexed search

**Status:** Accepted · **Phase:** 2 · Refines ADR 0001

## Context

The first pattern-aware search used states of (station, current pattern), and
from each state tried every edge leaving the station. At an interchange served
by _p_ patterns that is _p × p_ relaxations. On the full network it took about
2 ms per query, using string keys and `Map`s.

## Decision

1. **Separate "at a station" from "on a train".** States are:
   - _start_: at a station, not yet boarded
   - _platform_: at a station after leaving a train (boarding again is a change)
   - _on a train_: arrived at position _j_ of pattern _p_

   On a train, the only options are "stay on" (one edge) or "alight". At a
   station, the options are each departure or a walk. Work per state becomes
   constant on a train and linear in departures at a station.

2. **Integer-indexed states and flat arrays.** `StateIndex` numbers every state
   and stores transitions in compressed sparse row arrays. The search uses
   `Float64Array` / `Int32Array` for costs, change counts and back-pointers
   instead of string-keyed maps.

## Consequences

- Query time on the full network fell from about 2 ms to about 0.37 ms
  (p50, `npm run bench`), with identical results.
- Correctness is still checked against a deliberately simple Bellman-Ford
  reference that uses the same rules, on hundreds of random networks.
- Phase 3 (RAPTOR) will be benchmarked against this implementation.
