/**
 * Routing benchmark: times findRoute on a fixed, pseudo-random sample of
 * journeys between places on the bundled network and reports percentiles.
 *
 * Usage: npm run bench
 */
import { performance } from "node:perf_hooks";
import { tubeGraph } from "../src/data/network";
import { findRoute } from "../src/engine";
import { Timetable, planJourneys, type TimetableData } from "../src/engine/raptor";
import timetableData from "../src/data/timetable.json";

const SAMPLE = 20_000;
const ids = [...tubeGraph.places.keys()];

// Deterministic LCG so every run measures the same journeys.
let seed = 42;
const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const pick = () => ids[Math.floor(random() * ids.length)] as string;
const pairs = Array.from({ length: SAMPLE }, () => [pick(), pick()] as const);

const timetable = new Timetable(tubeGraph, timetableData as TimetableData);
// Departure times spread across a weekday, 06:00–22:00.
const departures = pairs.map(() => 360 + Math.floor(random() * 960));

function run(label: string, query: (from: string, to: string, i: number) => unknown) {
  pairs.slice(0, 2000).forEach(([from, to], i) => query(from, to, i)); // warm up
  const samples: number[] = [];
  pairs.forEach(([from, to], i) => {
    const start = performance.now();
    query(from, to, i);
    samples.push(performance.now() - start);
  });
  samples.sort((a, b) => a - b);
  const pct = (p: number) => (samples[Math.floor((samples.length - 1) * p)] ?? 0) * 1000;
  console.log(
    `${label.padEnd(30)} p50=${pct(0.5).toFixed(0)}µs  p95=${pct(0.95).toFixed(0)}µs  p99=${pct(0.99).toFixed(0)}µs`,
  );
}

console.log(
  `Network: ${tubeGraph.places.size} places, ${tubeGraph.stations.size} stations, ` +
    `${tubeGraph.edges.length} edges, ${tubeGraph.index.stateCount} search states, ` +
    `${timetable.routes.length} timetable routes. ` +
    `${SAMPLE.toLocaleString("en-GB")} journeys per mode.`,
);
run("Dijkstra, typical times", (a, b) => findRoute(tubeGraph, a, b));
run("Dijkstra, fewer changes", (a, b) => findRoute(tubeGraph, a, b, { changePenalty: 8 }));
run("RAPTOR, timetabled (Pareto)", (a, b, i) =>
  planJourneys(timetable, a, b, { departAt: departures[i] as number, day: "weekday" }),
);
