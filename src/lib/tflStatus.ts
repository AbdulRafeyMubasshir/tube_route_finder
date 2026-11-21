import type { LineStatus } from "../engine/conditions";

export const STATUS_MODES = "tube,dlr,elizabeth-line,overground";
export const TFL_STATUS_URL = `https://api.tfl.gov.uk/Line/Mode/${STATUS_MODES}/Status?detail=true`;

/** The parts of TfL's /Line/Mode/{modes}/Status response that we use. */
interface ApiLine {
  id: string;
  lineStatuses?: {
    statusSeverity: number;
    statusSeverityDescription: string;
    reason?: string;
    validityPeriods?: { isNow?: boolean }[];
    disruption?: {
      affectedRoutes?: {
        routeSectionNaptanEntrySequence?: { stopPoint?: { id?: string; naptanId?: string } }[];
      }[];
    };
  }[];
}

/**
 * Normalises TfL's line status feed: one entry per current status, with the
 * stations of each affected section. Statuses whose validity periods are all
 * in the future are dropped.
 */
export function parseLineStatus(response: unknown): LineStatus[] {
  if (!Array.isArray(response)) throw new Error("Unexpected status response");
  const result: LineStatus[] = [];
  for (const line of response as ApiLine[]) {
    for (const status of line.lineStatuses ?? []) {
      const periods = status.validityPeriods ?? [];
      if (periods.length > 0 && !periods.some((p) => p.isNow)) continue;
      const closedSections = (status.disruption?.affectedRoutes ?? [])
        .map((route) =>
          (route.routeSectionNaptanEntrySequence ?? [])
            .map((entry) => entry.stopPoint?.id ?? entry.stopPoint?.naptanId)
            .filter((id): id is string => Boolean(id)),
        )
        .filter((section) => section.length > 1);
      result.push({
        line: line.id,
        severity: status.statusSeverity,
        description: status.statusSeverityDescription,
        reason: status.reason?.trim() || null,
        closedSections,
      });
    }
  }
  return result;
}
