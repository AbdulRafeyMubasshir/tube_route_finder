/**
 * GET /api/status: live line status for the app, as a Vercel Edge Function.
 *
 * Proxies the TfL status feed so the app key (TFL_APP_KEY, optional) stays on
 * the server, trims it to what the app uses, and caches it at the edge for 60
 * seconds so every visitor doesn't hit TfL.
 */
import { TFL_STATUS_URL, parseLineStatus } from "../src/lib/tflStatus";

export const config = { runtime: "edge" };

export default async function handler(): Promise<Response> {
  const url = new URL(TFL_STATUS_URL);
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
    ?.env;
  const key = env?.TFL_APP_KEY;
  if (key) url.searchParams.set("app_key", key);
  try {
    const upstream = await fetch(url);
    if (!upstream.ok) throw new Error(`TfL responded ${upstream.status}`);
    const statuses = parseLineStatus(await upstream.json());
    return Response.json(
      { updatedAt: new Date().toISOString(), statuses },
      { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=120" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
