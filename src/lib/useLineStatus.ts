import { useEffect, useState } from "react";
import type { LineStatus } from "../engine/conditions";
import { TFL_STATUS_URL, parseLineStatus } from "./tflStatus";

export interface LiveStatus {
  statuses: LineStatus[];
  updatedAt: Date;
}

const REFRESH_MS = 2 * 60_000;

/** Fetches status from our edge function, falling back to TfL directly (e.g. in local dev). */
export async function fetchLineStatus(fetcher: typeof fetch = fetch): Promise<LiveStatus> {
  try {
    const response = await fetcher("/api/status");
    if (response.ok && response.headers.get("content-type")?.includes("json")) {
      const body = (await response.json()) as { statuses: LineStatus[]; updatedAt: string };
      return { statuses: body.statuses, updatedAt: new Date(body.updatedAt) };
    }
  } catch {
    // fall through to TfL
  }
  const response = await fetcher(TFL_STATUS_URL);
  if (!response.ok) throw new Error(`TfL status unavailable (${response.status})`);
  return { statuses: parseLineStatus(await response.json()), updatedAt: new Date() };
}

/** Live line status, refreshed every two minutes. Null until the first response. */
export function useLineStatus(load: () => Promise<LiveStatus> = fetchLineStatus): {
  status: LiveStatus | null;
  error: string | null;
} {
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      load()
        .then((s) => {
          if (cancelled) return;
          setStatus(s);
          setError(null);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Status unavailable");
        });
    void refresh();
    const id = window.setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [load]);
  return { status, error };
}
