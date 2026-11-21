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
import { compileTimetable } from "./tfl/compileTimetable";

const sourceFile = new URL("../data/tfl/source.json", import.meta.url);
const outFile = new URL("../src/data/network.json", import.meta.url);
const timetableFile = new URL("../src/data/timetable.json", import.meta.url);

const source = JSON.parse(readFileSync(sourceFile, "utf8")) as TflSource;
const { network, errors, warnings, stats } = compileNetwork(source);
const timetable = compileTimetable(source, network);
warnings.push(...timetable.warnings);

for (const w of warnings) console.warn(`warn: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}

const outputs: [URL, string][] = [
  [outFile, JSON.stringify(network) + "\n"],
  [timetableFile, JSON.stringify(timetable.timetable) + "\n"],
];
if (process.argv.includes("--check")) {
  for (const [file, output] of outputs) {
    const current = existsSync(file) ? readFileSync(file, "utf8") : "";
    if (current !== output) {
      console.error(`${file.pathname} is out of date. Run \`npm run build:network\`.`);
      process.exit(1);
    }
  }
  console.log("network.json and timetable.json are up to date");
} else {
  for (const [file, output] of outputs) writeFileSync(file, output);
  console.log(
    `Built network: ${stats.places} places, ${stats.stations} stations, ${stats.lines} lines, ` +
      `${stats.patterns} patterns, ${stats.hops} hops (${stats.estimatedHops} estimated), ` +
      `${stats.walks} walking links`,
  );
  console.log(
    `Built timetable: ${timetable.stats.routes} routes (${timetable.stats.estimatedRoutes} estimated), ` +
      `${timetable.stats.trips} trips`,
  );
}
