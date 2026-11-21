export type StationId = string;
export type LineId = string;

export interface Station {
  id: StationId;
  name: string;
  /** Schematic map coordinates. */
  x: number;
  y: number;
}

export interface Line {
  id: LineId;
  name: string;
  colour: string;
}

/** A directed hop between two adjacent stations on one line. */
export interface Edge {
  from: StationId;
  to: StationId;
  line: LineId;
  /** Direction label from the source data, e.g. "Northbound" or "Inner". */
  direction: string;
  minutes: number;
}

export interface Network {
  lines: Line[];
  stations: Station[];
  edges: Edge[];
}

/** Consecutive legs on the same line and direction: one train ride. */
export interface Ride {
  line: LineId;
  direction: string;
  /** Last station this train runs to, or null on a loop (e.g. the Circle). */
  terminus: StationId | null;
  from: StationId;
  to: StationId;
  /** Every station after `from`, ending with `to`. */
  stops: StationId[];
  minutes: number;
}

export interface Route {
  from: StationId;
  to: StationId;
  /** Every station visited, in order, including both ends. */
  stations: StationId[];
  legs: Edge[];
  rides: Ride[];
  /** In-train time only. */
  travelMinutes: number;
  /** Number of times the passenger changes line. */
  interchanges: number;
}

export interface RouteOptions {
  /**
   * Minutes added to the cost of each change of line. 0 finds the fastest
   * in-train route; larger values prefer fewer changes. Default 0.
   */
  interchangePenalty?: number;
}
