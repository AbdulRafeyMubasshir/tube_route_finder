/**
 * Compact, normalised snapshot of the TfL data the app needs. Produced by
 * fetchSource() and committed to data/tfl/source.json so builds are
 * reproducible and don't depend on the API being up.
 */
export interface TflSource {
  fetchedAt: string;
  lines: SourceLine[];
  stops: SourceStop[];
  places: SourcePlace[];
  patterns: SourcePattern[];
  hops: SourceHop[];
  /** Trip-level timetables, for modes where TfL publishes them. */
  timetables: SourceTimetable[];
}

/**
 * Departures from one origin stop in one direction. Each route is a stopping
 * pattern with cumulative minutes from the origin; each schedule (e.g.
 * "Monday - Thursday") lists departure times as minutes after midnight (values
 * over 1440 run past midnight) with the route each train follows.
 */
export interface SourceTimetable {
  line: string;
  direction: "inbound" | "outbound";
  origin: string;
  routes: { stops: string[]; times: number[] }[];
  schedules: { name: string; departures: number[]; routes: number[] }[];
}

export interface SourceLine {
  id: string;
  name: string;
  mode: string;
}

export interface SourceStop {
  id: string;
  name: string;
  /** TfL hub id (topMostParentId), or the stop's own id when it has none. */
  placeId: string;
  lat: number;
  lon: number;
  zone: string | null;
}

export interface SourcePlace {
  id: string;
  name: string;
}

/** A service pattern: the ordered stops one train calls at. */
export interface SourcePattern {
  line: string;
  direction: "inbound" | "outbound";
  name: string;
  stops: string[];
}

/** Average timetabled run time between two consecutive stops on a line. */
export interface SourceHop {
  line: string;
  from: string;
  to: string;
  minutes: number;
  samples: number;
}
