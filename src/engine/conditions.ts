import type { LineId, StationId } from "./types";

/** One line's current status, normalised from the TfL status feed. */
export interface LineStatus {
  line: LineId;
  /** TfL severity code: 10 is Good Service; lower is generally worse. */
  severity: number;
  description: string;
  reason: string | null;
  /** For closures: the closed sections, each an ordered list of stations. */
  closedSections: StationId[][];
}

/** How live status changes routing: closed hops are unusable, delayed lines run slower. */
export interface Conditions {
  /** Keys "line|from|to" for hops with no service (both directions). */
  closedHops: ReadonlySet<string>;
  /** Run-time multiplier per line, e.g. 1.35 for severe delays. */
  delayFactor: ReadonlyMap<LineId, number>;
}

/** TfL severities meaning no service on all or part of the line. */
export const CLOSURE_SEVERITIES = new Set([1, 2, 3, 4, 5, 11, 16, 20]);

/** Run-time multipliers for delay severities: a rough model of slower journeys. */
export const DELAY_FACTORS: Record<number, number> = {
  6: 1.35, // Severe Delays
  7: 1.2, // Reduced Service
  9: 1.15, // Minor Delays
  14: 1.1, // Change of frequency
};

export const NO_CONDITIONS: Conditions = { closedHops: new Set(), delayFactor: new Map() };

export const hopKey = (line: LineId, from: StationId, to: StationId) => `${line}|${from}|${to}`;

export function conditionsFrom(statuses: readonly LineStatus[]): Conditions {
  const closedHops = new Set<string>();
  const delayFactor = new Map<LineId, number>();
  for (const status of statuses) {
    if (CLOSURE_SEVERITIES.has(status.severity)) {
      for (const section of status.closedSections) {
        for (let i = 1; i < section.length; i++) {
          const a = section[i - 1] as StationId;
          const b = section[i] as StationId;
          closedHops.add(hopKey(status.line, a, b));
          closedHops.add(hopKey(status.line, b, a));
        }
      }
    }
    const factor = DELAY_FACTORS[status.severity];
    if (factor && factor > (delayFactor.get(status.line) ?? 1))
      delayFactor.set(status.line, factor);
  }
  return { closedHops, delayFactor };
}

export const isDisrupted = (status: LineStatus) => status.severity !== 10 && status.severity !== 18;
