# ADR 0002: Vite, and network data compiled at build time

**Status:** Accepted · **Phase:** 1

## Context

The app was built on Create React App, which is deprecated and pinned to
TypeScript 4.9. It fetched 12 JSON files at runtime, with no validation, so bad
data (for example, hops with a travel time of 0) reached users silently.

## Decision

- Move to **Vite + TypeScript 5** with strict compiler options, ESLint, Prettier
  and Vitest. Keep the build output in `build/` so the existing Vercel project
  deploys unchanged.
- Add a **data pipeline** (`scripts/build-network.mjs`) that reads `data/raw/`,
  normalises names and ids, applies documented corrections, validates the graph
  (unknown stations, non-positive times, isolated or disconnected stations,
  missing reverse edges) and writes one `src/data/network.json`.
- The app imports that file, so there are no runtime requests and the graph is
  built once. CI fails if the committed JSON is stale.

## Consequences

- Data defects now fail the build instead of producing wrong routes. The first
  run found four zero-minute hops on the Hammersmith branch.
- Phase 2 swaps `data/raw/` for TfL Unified API data while keeping the same
  output format, so the engine and UI do not change.
