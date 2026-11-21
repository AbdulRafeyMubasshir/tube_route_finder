/**
 * Downloads the network from the TfL Unified API into data/tfl/source.json.
 *
 * Usage:  npm run fetch:tfl
 * Optional: set TFL_APP_KEY (free from https://api-portal.tfl.gov.uk) for higher rate limits.
 * Then run `npm run build:network` to regenerate src/data/network.json.
 */
import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { fetchSource } from "./tfl/fetchSource";
import { stringifyCompact } from "./tfl/stringify";

const BASE = "https://api.tfl.gov.uk";
const appKey = process.env.TFL_APP_KEY;
// Anonymous access is rate limited, so pace requests unless a key is set.
const delayMs = appKey ? 100 : 1300;
let requests = 0;

async function get(path: string): Promise<unknown> {
  const url = new URL(BASE + path);
  if (appKey) url.searchParams.set("app_key", appKey);
  for (let attempt = 1; ; attempt++) {
    await sleep(delayMs);
    requests++;
    const response = await fetch(url);
    if (response.status === 404) return null;
    if (response.ok) return response.json();
    if ((response.status === 429 || response.status >= 500) && attempt < 5) {
      const wait = 2 ** attempt * 1000;
      console.warn(`  ${response.status} for ${path}; retrying in ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    throw new Error(`TfL API ${response.status} for ${path}`);
  }
}

const source = await fetchSource(get, console.log);
const out = new URL("../data/tfl/source.json", import.meta.url);
writeFileSync(out, stringifyCompact(source) + "\n");
const trips = source.timetables.reduce(
  (n, t) => n + t.schedules.reduce((m, s) => m + s.departures.length, 0),
  0,
);
console.log(
  `Saved ${source.stops.length} stops, ${source.patterns.length} patterns, ` +
    `${source.hops.length} timed hops and ${trips} trips (${requests} requests) to data/tfl/source.json`,
);
