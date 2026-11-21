# ADR 0006: Live line status and routing around disruption

**Status:** Accepted · **Phase:** 4

## Context

Timetables describe the planned service. On a typical London weekend some
lines are part-closed for engineering and others are delayed. A planner that
ignores this sends people to closed stations.

TfL's `/Line/Mode/{modes}/Status?detail=true` gives, per line, the current
statuses (severity, description, reason) and, for closures, the affected
sections as ordered station sequences (e.g. District line, Earl's Court ↔
Kensington (Olympia)).

## Decision

- **Edge function proxy:** `GET /api/status` (a Vercel Edge Function) fetches
  the feed with an optional server-side `TFL_APP_KEY`, trims it to what the app
  needs (`parseLineStatus`), and caches it at the edge for 60 seconds
  (`s-maxage=60, stale-while-revalidate=120`). Visitors share one upstream
  request a minute, and the key never reaches the browser. The client falls
  back to TfL directly (which allows CORS) when the function isn't there, e.g.
  in `vite dev`. It refreshes every two minutes.
- **Conditions model:** statuses become `Conditions`: closed hops (`line|from|to`,
  both directions) for closure severities, and a per-line run-time multiplier
  for delays (minor 1.15×, severe 1.35×, reduced service 1.2×). The model is
  deliberately simple and conservative, and kept in one place
  (`src/engine/conditions.ts`).
- **Both engines apply it:**
  - Dijkstra multiplies each edge by a per-edge factor array (Infinity =
    closed), computed once per conditions object and cached in a `WeakMap`.
  - RAPTOR precomputes, per route, the delay factor and the positions whose
    incoming hop is closed. A trip is dropped at a closed hop and can't be
    boarded through it; delays stretch the route's offsets uniformly, which
    keeps trips in order (FIFO).
- **Only for "leave now":** live status describes the present, so planned
  journeys at another time use the timetable as published.
- **UI:** a live status panel, "Rerouted to avoid …" when the usual route runs
  into a closure, a warning for delays on the lines used, dashed closed
  sections on the map, and an "Avoid live disruptions" switch.

## Rejected: step-free routing

Planned for this phase but not shipped. TfL's StopPoint accessibility data
(`AccessViaLift`) covers only about a third of our 470 stations, and some
values contradict TfL's own step-free guide. Routing people who rely on
step-free access with unreliable data would be worse than not offering it. It
needs an authoritative source (e.g. TfL's station accessibility datasets)
first.

## Consequences

- Real-world correctness on disrupted days. Delay factors are an estimate:
  TfL doesn't publish expected delay minutes.
- Raising RAPTOR's property test to 1,000 runs while adding closure tests
  found three bugs, all now fixed with regression tests, in how walks combine
  with trains. A train arriving no earlier than a walk was discarded although
  it lets you walk on. A walk could chain through a stop improved by another
  walk in the same round. And a journey could be rebuilt from a walk-improved
  arrival rather than the train arrival the final walk started from. Train and
  walk labels are now kept separately, as in the RAPTOR paper.
