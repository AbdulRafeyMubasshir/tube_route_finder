/**
 * Routing benchmark: runs every station pair on the bundled network and
 * reports per-query latency percentiles.
 *
 * Usage: npm run bench
 */
import { performance } from "node:perf_hooks";
import { tubeGraph } from "../src/data/network";
import { findRoute } from "../src/engine";

const ids = [...tubeGraph.stations.keys()];
const pairs = ids.flatMap((from) => ids.map((to) => [from, to] as const));

function run(label: string, penalty: number) {
  // Warm up the JIT before measuring.
  for (const [from, to] of pairs) findRoute(tubeGraph, from, to, { interchangePenalty: penalty });

  const samples: number[] = [];
  for (let round = 0; round < 5; round++) {
    for (const [from, to] of pairs) {
      const start = performance.now();
      findRoute(tubeGraph, from, to, { interchangePenalty: penalty });
      samples.push(performance.now() - start);
    }
  }
  samples.sort((a, b) => a - b);
  const pct = (p: number) => (samples[Math.floor((samples.length - 1) * p)] ?? 0) * 1000;
  console.log(
    `${label.padEnd(34)} queries=${samples.length}  p50=${pct(0.5).toFixed(1)}µs  ` +
      `p95=${pct(0.95).toFixed(1)}µs  p99=${pct(0.99).toFixed(1)}µs`,
  );
}

console.log(`Network: ${tubeGraph.stations.size} stations, ${tubeGraph.edges.length} edges`);
run("fastest (no interchange penalty)", 0);
run("interchange penalty 5 min", 5);
