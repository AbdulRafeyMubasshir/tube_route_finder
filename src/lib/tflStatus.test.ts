import { parseLineStatus } from "./tflStatus";
import { fetchLineStatus } from "./useLineStatus";
import handler from "../../api/status";

/** Trimmed from a real /Line/Mode/.../Status?detail=true response. */
export const sampleResponse = [
  {
    id: "district",
    lineStatuses: [
      {
        statusSeverity: 6,
        statusSeverityDescription: "Severe Delays",
        reason: "District Line: Severe delays.  ",
        validityPeriods: [{ isNow: true }],
        disruption: {
          affectedRoutes: [
            {
              routeSectionNaptanEntrySequence: [
                { stopPoint: { id: "A" } },
                { stopPoint: { id: "B" } },
              ],
            },
          ],
        },
      },
      {
        statusSeverity: 3,
        statusSeverityDescription: "Part Suspended",
        reason: "No service between Kensington (Olympia) and Earl's Court.",
        validityPeriods: [{ isNow: true }],
        disruption: {
          affectedRoutes: [
            {
              routeSectionNaptanEntrySequence: [
                { stopPoint: { id: "940GZZLUECT" } },
                { stopPoint: { naptanId: "940GZZLUKOY" } },
              ],
            },
            { routeSectionNaptanEntrySequence: [{ stopPoint: { id: "X" } }] },
          ],
        },
      },
      {
        statusSeverity: 4,
        statusSeverityDescription: "Planned Closure",
        validityPeriods: [{ isNow: false }],
      },
    ],
  },
  {
    id: "victoria",
    lineStatuses: [{ statusSeverity: 10, statusSeverityDescription: "Good Service" }],
  },
];

describe("parseLineStatus", () => {
  it("normalises current statuses and their affected sections", () => {
    expect(parseLineStatus(sampleResponse)).toEqual([
      {
        line: "district",
        severity: 6,
        description: "Severe Delays",
        reason: "District Line: Severe delays.",
        closedSections: [["A", "B"]],
      },
      {
        line: "district",
        severity: 3,
        description: "Part Suspended",
        reason: "No service between Kensington (Olympia) and Earl's Court.",
        closedSections: [["940GZZLUECT", "940GZZLUKOY"]],
      },
      {
        line: "victoria",
        severity: 10,
        description: "Good Service",
        reason: null,
        closedSections: [],
      },
    ]);
  });

  it("rejects unexpected responses", () => {
    expect(() => parseLineStatus({ message: "rate limited" })).toThrow();
  });
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("fetchLineStatus", () => {
  it("uses the app's edge function when available", async () => {
    const fetcher = vi.fn(async () => json({ statuses: [], updatedAt: "2026-11-21T22:00:00Z" }));
    const result = await fetchLineStatus(fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledWith("/api/status");
    expect(result.updatedAt.toISOString()).toBe("2026-11-21T22:00:00.000Z");
  });

  it("falls back to TfL directly, e.g. in local development", async () => {
    const fetcher = vi.fn(async (url: string) =>
      url === "/api/status" ? new Response("<html>", { status: 404 }) : json(sampleResponse),
    );
    const result = await fetchLineStatus(fetcher as unknown as typeof fetch);
    expect(result.statuses).toHaveLength(3);
  });

  it("reports TfL failures", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url === "/api/status") throw new Error("offline");
      return json({}, 503);
    });
    await expect(fetchLineStatus(fetcher as unknown as typeof fetch)).rejects.toThrow(
      /unavailable/,
    );
  });
});

describe("GET /api/status", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns trimmed, cacheable status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(sampleResponse)),
    );
    const response = await handler();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=60");
    const body = (await response.json()) as { statuses: unknown[] };
    expect(body.statuses).toHaveLength(3);
  });

  it("returns 502 when TfL fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({}, 500)),
    );
    const response = await handler();
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
