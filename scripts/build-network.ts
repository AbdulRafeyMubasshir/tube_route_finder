/**
 * Network build pipeline.
 *
 * Compiles the TfL snapshot in data/tfl/source.json into the compact,
 * validated src/data/network.json that the app imports at build time.
 *
 * Usage:  npm run build:network          # build
 *         npm run check:network          # fail if the output is stale
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { TflSource } from "./tfl/types";
import { compileNetwork } from "./tfl/compileNetwork";

const sourceFile = new URL("../data/tfl/source.json", import.meta.url);
const outFile = new URL("../src/data/network.json", import.meta.url);

const source = JSON.parse(readFileSync(sourceFile, "utf8")) as TflSource;
const { network, errors, warnings, stats } = compileNetwork(source);

for (const w of warnings) console.warn(`warn: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}

const output = JSON.stringify(network) + "\n";
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
    `Built network: ${stats.places} places, ${stats.stations} stations, ${stats.lines} lines, ` +
      `${stats.patterns} patterns, ${stats.hops} hops (${stats.estimatedHops} estimated), ` +
      `${stats.walks} walking links`,
  );
}
