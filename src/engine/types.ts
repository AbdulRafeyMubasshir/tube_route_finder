export type StationId = string;
export type PlaceId = string;
export type LineId = string;
export type PatternId = string;

export interface Line {
  id: LineId;
  name: string;
  /** TfL mode, e.g. "tube", "dlr", "overground", "elizabeth-line". */
  mode: string;
  colour: string;
}

/** A platform-level stop: what trains actually call at. */
export interface Station {
  id: StationId;
  name: string;
  place: PlaceId;
  /** Projected map coordinates. */
  x: number;
  y: number;
}

/**
 * What a passenger searches for: one or more stations sharing a name or
 * interchange, e.g. King's Cross St Pancras groups the Underground and the
 * rail stations.
 */
export interface Place {
  id: PlaceId;
  name: string;
  stations: StationId[];
  x: number;
  y: number;
  /** Lowest fare zone, when known. */
  zone: number | null;
  lines: LineId[];
}

/** A service pattern: the ordered stops one train calls at. */
export interface Pattern {
  id: PatternId;
  line: LineId;
  stops: StationId[];
}

/** Run time between consecutive stops on a line. */
export interface Hop {
  line: LineId;
  from: StationId;
  to: StationId;
  minutes: number;
  /** True when no timetable was available and the time was estimated from distance. */
  estimated?: boolean;
}

/** Walking link between stations in the same place. */
export interface Walk {
  from: StationId;
  to: StationId;
  minutes: number;
}

export interface Network {
  fetchedAt?: string;
  lines: Line[];
  places: Place[];
  stations: Station[];
  patterns: Pattern[];
  hops: Hop[];
  walks: Walk[];
}

/** A directed edge in the routing graph. */
export type Edge =
  | {
      kind: "ride";
      from: StationId;
      to: StationId;
      line: LineId;
      pattern: PatternId;
      minutes: number;
      estimated: boolean;
    }
  | { kind: "walk"; from: StationId; to: StationId; minutes: number };

export type RideEdge = Extract<Edge, { kind: "ride" }>;

export interface RideSegment {
  kind: "ride";
  line: LineId;
  from: StationId;
  to: StationId;
  /** Every station after `from`, ending with `to`. */
  stops: StationId[];
  /** Termini of every train on this line that runs from `from` to `to`. */
  towards: StationId[];
  minutes: number;
  /** True if any hop's time is estimated rather than timetabled. */
  estimated: boolean;
}

export interface WalkSegment {
  kind: "walk";
  from: StationId;
  to: StationId;
  minutes: number;
}

export type Segment = RideSegment | WalkSegment;

export interface Route {
  from: PlaceId;
  to: PlaceId;
  /** Every station visited, in order. */
  stations: StationId[];
  edges: Edge[];
  segments: Segment[];
  /** Number of times the passenger changes train. */
  interchanges: number;
  rideMinutes: number;
  walkMinutes: number;
  /** Allowance for changing trains: interchanges × changeMinutes. */
  changeMinutes: number;
  totalMinutes: number;
}

export interface RouteOptions {
  /**
   * Minutes allowed for each change of train (platform change and wait).
   * Counted in the journey time. Default 3.
   */
  changeMinutes?: number;
  /**
   * Extra minutes of cost per change that are *not* added to the journey
   * time. Raising it prefers routes with fewer changes. Default 0.
   */
  changePenalty?: number;
}
