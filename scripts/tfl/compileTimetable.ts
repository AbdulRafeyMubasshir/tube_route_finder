import type { Network } from "../../src/engine/types";
import { DAY_TYPES, type DayType, type TimetableData } from "../../src/engine/raptor";
import type { TflSource } from "./types";

/** Assumed minutes between trains, per pattern, where TfL publishes no timetable. */
const ASSUMED_HEADWAY: Record<string, number> = {
  tube: 6,
  dlr: 8,
  overground: 15,
  "elizabeth-line": 12,
};
/** Service hours assumed for synthesised trips, minutes after midnight. */
const ASSUMED_SERVICE: Record<DayType, [number, number]> = {
  weekday: [5 * 60 + 30, 24 * 60 + 30],
  friday: [5 * 60 + 30, 24 * 60 + 30],
  saturday: [5 * 60 + 45, 24 * 60 + 30],
  sunday: [7 * 60, 24 * 60],
};

/** Maps TfL schedule names ("Monday - Thursday", "Saturdays and Public Holidays") to day types. */
export function dayTypesFor(scheduleName: string): DayType[] {
  const name = scheduleName.toLowerCase();
  const days: DayType[] = [];
  if (/mon/.test(name)) days.push("weekday");
  if (/fri/.test(name) && !/good friday/.test(name)) days.push("friday");
  if (/mon/.test(name) && /fri/.test(name)) days.splice(0, days.length, "weekday", "friday");
  if (/sat/.test(name)) days.push("saturday");
  if (/sun/.test(name)) days.push("sunday");
  return [...new Set(days)];
}

const deltaEncode = (sorted: number[]) =>
  sorted.map((t, i) => t - (i === 0 ? 0 : (sorted[i - 1] as number)));

export interface TimetableResult {
  timetable: TimetableData;
  warnings: string[];
  stats: { routes: number; trips: number; estimatedRoutes: number };
}

/**
 * Builds the RAPTOR timetable: one route per distinct stopping pattern and
 * set of run times, with sorted departures per day type. Lines and directions
 * with no published timetable get trips synthesised from the network's run
 * times and an assumed frequency, flagged as estimated.
 */
export function compileTimetable(source: TflSource, network: Network): TimetableResult {
  const warnings: string[] = [];
  const known = new Set(network.stations.map((s) => s.id));
  const routes = new Map<
    string,
    TimetableData["routes"][number] & { all: Record<DayType, number[]> }
  >();

  const routeFor = (line: string, stops: string[], times: number[], estimated: boolean) => {
    const key = `${line}|${stops.join(",")}|${times.join(",")}`;
    let route = routes.get(key);
    if (!route) {
      route = {
        line,
        stops,
        times,
        trips: {},
        all: { weekday: [], friday: [], saturday: [], sunday: [] },
      };
      if (estimated) route.estimated = true;
      routes.set(key, route);
    }
    return route;
  };

  const covered = new Set<string>();
  for (const tt of source.timetables) {
    const usable = tt.routes.map((r) => {
      if (r.stops.some((s) => !known.has(s))) return null;
      if (r.times.some((t, i) => i > 0 && t < (r.times[i - 1] as number))) {
        warnings.push(`${tt.line} from ${tt.origin}: run times go backwards; route skipped`);
        return null;
      }
      return routeFor(tt.line, r.stops, r.times, false);
    });
    for (const schedule of tt.schedules) {
      const days = dayTypesFor(schedule.name);
      if (!days.length) warnings.push(`unrecognised schedule "${schedule.name}"`);
      schedule.departures.forEach((time, i) => {
        const route = usable[schedule.routes[i] as number];
        if (route) for (const day of days) route.all[day].push(time);
      });
    }
    covered.add(`${tt.line}|${tt.direction}`);
  }

  // Synthesise trips for patterns on lines/directions without a timetable.
  const hopMinutes = new Map(network.hops.map((h) => [`${h.line}|${h.from}|${h.to}`, h.minutes]));
  const mode = new Map(network.lines.map((l) => [l.id, l.mode]));
  for (const pattern of source.patterns) {
    if (covered.has(`${pattern.line}|${pattern.direction}`)) continue;
    if (pattern.stops.some((s) => !known.has(s))) continue;
    const times = [0];
    for (let i = 1; i < pattern.stops.length; i++) {
      const minutes =
        hopMinutes.get(`${pattern.line}|${pattern.stops[i - 1]}|${pattern.stops[i]}`) ?? 2;
      times.push(Math.round(((times[i - 1] as number) + minutes) * 10) / 10);
    }
    const route = routeFor(pattern.line, pattern.stops, times, true);
    const headway = ASSUMED_HEADWAY[mode.get(pattern.line) ?? ""] ?? 10;
    for (const day of DAY_TYPES) {
      const [first, last] = ASSUMED_SERVICE[day];
      for (let t = first; t <= last; t += headway) route.all[day].push(t);
    }
  }

  let trips = 0;
  const list: TimetableData["routes"] = [];
  for (const { all, ...route } of routes.values()) {
    for (const day of DAY_TYPES) {
      const times = [...new Set(all[day])].sort((a, b) => a - b);
      trips += times.length;
      if (times.length) route.trips[day] = deltaEncode(times);
    }
    if (Object.keys(route.trips).length) list.push(route);
  }
  list.sort((a, b) => a.line.localeCompare(b.line) || a.stops.length - b.stops.length);
  return {
    timetable: { routes: list },
    warnings,
    stats: { routes: list.length, trips, estimatedRoutes: list.filter((r) => r.estimated).length },
  };
}
