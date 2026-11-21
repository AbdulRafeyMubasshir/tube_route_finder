/**
 * Routing benchmark: times findRoute on a fixed, pseudo-random sample of
 * journeys between places on the bundled network and reports percentiles.
 *
 * Usage: npm run bench
 */
import { performance } from "node:perf_hooks";
import { tubeGraph } from "../src/data/network";
import { findRoute, type RouteOptions } from "../src/engine";

const SAMPLE = 20_000;
const ids = [...tubeGraph.places.keys()];

// Deterministic LCG so every run measures the same journeys.
let seed = 42;
const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const pick = () => ids[Math.floor(random() * ids.length)] as string;
const pairs = Array.from({ length: SAMPLE }, () => [pick(), pick()] as const);

function run(label: string, options: RouteOptions) {
  for (const [from, to] of pairs.slice(0, 2000)) findRoute(tubeGraph, from, to, options); // warm up
  const samples: number[] = [];
  for (const [from, to] of pairs) {
    const start = performance.now();
    findRoute(tubeGraph, from, to, options);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const pct = (p: number) => (samples[Math.floor((samples.length - 1) * p)] ?? 0) * 1000;
  console.log(
    `${label.padEnd(30)} p50=${pct(0.5).toFixed(0)}µs  p95=${pct(0.95).toFixed(0)}µs  p99=${pct(0.99).toFixed(0)}µs`,
  );
}

console.log(
  `Network: ${tubeGraph.places.size} places, ${tubeGraph.stations.size} stations, ` +
    `${tubeGraph.edges.length} edges, ${tubeGraph.index.stateCount} search states. ` +
    `${SAMPLE.toLocaleString("en-GB")} journeys per mode.`,
);
run("fastest", {});
run("fewer changes (8 min penalty)", { changePenalty: 8 });
