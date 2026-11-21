#!/usr/bin/env node
/**
 * Network build pipeline.
 *
 * Reads the per-line raw data in data/raw/, normalises it, validates it, and
 * writes a single compact network file to src/data/network.json that the app
 * imports at build time (no runtime fetches).
 *
 * Usage:  node scripts/build-network.mjs          # build
 *         node scripts/build-network.mjs --check  # fail if output is stale
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rawDir = join(root, "data", "raw");
const outFile = join(root, "src", "data", "network.json");

/** Line metadata. Colours approximate the public line colours. */
const LINES = {
  bakerloo: { name: "Bakerloo", colour: "#B36305" },
  central: { name: "Central", colour: "#E32017" },
  circle: { name: "Circle", colour: "#FFD300" },
  jubilee: { name: "Jubilee", colour: "#A0A5A9" },
  piccadilly: { name: "Piccadilly", colour: "#003688" },
  victoria: { name: "Victoria", colour: "#0098D4" },
};

/** Raw names that need a clearer display name. */
const DISPLAY_NAMES = {
  "Paddington Circle": "Paddington (Circle)",
  "Paddington H C": "Paddington (H&C)",
  "Hammersmith H C": "Hammersmith (H&C)",
  "Kings Cross St Pancras": "King's Cross St Pancras",
  "St James Park": "St James's Park",
  "Shepherds Bush Market": "Shepherd's Bush Market",
};

/**
 * Known defects in the raw data, corrected here so the fix is explicit and
 * reviewable. Keyed by "from|to" using raw station names (both directions).
 * TODO(phase 2): replace with timetabled run times from the TfL Unified API.
 */
const TIME_CORRECTIONS = {
  // Raw data has 0 minutes for these hops, which would make them free to travel.
  // 1.5 min is an estimate in line with neighbouring hops (1.15–1.37 min).
  "Latimer Road|Wood Lane": 1.5,
  "Wood Lane|Shepherds Bush Market": 1.5,
};
const correctedTime = (from, to, time) =>
  TIME_CORRECTIONS[`${from}|${to}`] ?? TIME_CORRECTIONS[`${to}|${from}`] ?? time;

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const errors = [];
const warnings = [];

// ---- Stations -------------------------------------------------------------
const stations = new Map(); // rawName -> station
for (const file of readdirSync(join(rawDir, "stations")).sort()) {
  const { stations: list } = readJson(join(rawDir, "stations", file));
  for (const s of list) {
    if (typeof s.x !== "number" || typeof s.y !== "number") {
      errors.push(`${file}: station "${s.name}" has invalid coordinates`);
      continue;
    }
    const existing = stations.get(s.name);
    if (existing) {
      if (existing.x !== s.x || existing.y !== s.y) {
        warnings.push(`"${s.name}" has different coordinates in ${file}; keeping the first`);
      }
      continue;
    }
    const name = DISPLAY_NAMES[s.name] ?? s.name;
    stations.set(s.name, { id: slugify(name), name, x: s.x, y: s.y });
  }
}

// ---- Edges ----------------------------------------------------------------
const edges = [];
const seen = new Set();
for (const file of readdirSync(join(rawDir, "connections")).sort()) {
  for (const c of readJson(join(rawDir, "connections", file))) {
    const match = /^(\w+)\s*\(([^)]+)\)$/.exec(c.line);
    if (!match) {
      errors.push(`${file}: unrecognised line label "${c.line}"`);
      continue;
    }
    const line = match[1].toLowerCase();
    const direction = match[2];
    if (!LINES[line]) errors.push(`${file}: unknown line "${line}"`);
    const from = stations.get(c.from);
    const to = stations.get(c.to);
    if (!from) errors.push(`${file}: unknown station "${c.from}"`);
    if (!to) errors.push(`${file}: unknown station "${c.to}"`);
    const minutes = correctedTime(c.from, c.to, c.time);
    if (!(typeof minutes === "number" && minutes > 0)) {
      errors.push(`${file}: ${c.from} -> ${c.to} has invalid time ${c.time}`);
    }
    if (!from || !to) continue;
    const key = `${from.id}|${to.id}|${line}|${direction}`;
    if (seen.has(key)) {
      warnings.push(`duplicate edge ${key}`);
      continue;
    }
    seen.add(key);
    edges.push({ from: from.id, to: to.id, line, direction, minutes });
  }
}

// ---- Graph checks ---------------------------------------------------------
const ids = [...stations.values()].map((s) => s.id);
if (new Set(ids).size !== ids.length) errors.push("station ids are not unique");

const adjacency = new Map(ids.map((id) => [id, new Set()]));
for (const e of edges) {
  adjacency.get(e.from).add(e.to);
  adjacency.get(e.to).add(e.from);
}
for (const [id, neighbours] of adjacency) {
  if (neighbours.size === 0) errors.push(`station "${id}" has no connections`);
}
// Every station should be reachable from every other (undirected check).
if (ids.length) {
  const stack = [ids[0]];
  const visited = new Set(stack);
  while (stack.length) {
    for (const n of adjacency.get(stack.pop())) {
      if (!visited.has(n)) {
        visited.add(n);
        stack.push(n);
      }
    }
  }
  if (visited.size !== ids.length) {
    errors.push(`network is disconnected: ${ids.length - visited.size} stations unreachable`);
  }
}
// Each directed edge should have a reverse edge on the same line.
const pairs = new Set(edges.map((e) => `${e.from}|${e.to}|${e.line}`));
for (const e of edges) {
  if (!pairs.has(`${e.to}|${e.from}|${e.line}`)) {
    warnings.push(`no reverse edge for ${e.from} -> ${e.to} (${e.line})`);
  }
}

for (const w of warnings) console.warn(`warn: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}

const lines = Object.entries(LINES).map(([id, meta]) => ({ id, ...meta }));
const network = {
  lines,
  stations: [...stations.values()].sort((a, b) => a.name.localeCompare(b.name)),
  edges,
};
const output = JSON.stringify(network, null, 2) + "\n";

if (process.argv.includes("--check")) {
  const current = existsSync(outFile) ? readFileSync(outFile, "utf8") : "";
  if (current !== output) {
    console.error("src/data/network.json is out of date. Run `npm run build:network`.");
    process.exit(1);
  }
  console.log("network.json is up to date");
} else {
  writeFileSync(outFile, output);
  console.log(
    `Built network: ${network.stations.length} stations, ${edges.length} edges, ${lines.length} lines`,
  );
}
