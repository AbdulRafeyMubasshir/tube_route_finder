import type { Graph } from "../engine";
import { isDisrupted, type LineStatus } from "../engine/conditions";
import type { LiveStatus } from "../lib/useLineStatus";

interface Props {
  graph: Graph;
  status: LiveStatus | null;
  error: string | null;
}

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

/** Groups a line's statuses (a line can have several, e.g. delays plus a part suspension). */
function byLine(statuses: LineStatus[]) {
  const lines = new Map<string, LineStatus[]>();
  for (const s of statuses.filter(isDisrupted))
    lines.set(s.line, [...(lines.get(s.line) ?? []), s]);
  return [...lines];
}

/** Live line status from TfL: which lines are disrupted, and why. */
export function StatusPanel({ graph, status, error }: Props) {
  const disrupted = status ? byLine(status.statuses) : [];
  return (
    <section className="status" aria-label="Live line status">
      <div className="status-header">
        <h2>Live status</h2>
        <span className="muted small">
          {status
            ? `Updated ${timeFormat.format(status.updatedAt)}`
            : error
              ? "Unavailable"
              : "Loading…"}
        </span>
      </div>
      {error && !status && <p className="muted small">Live status is unavailable: {error}</p>}
      {status && disrupted.length === 0 && <p className="good">Good service on all lines.</p>}
      {disrupted.length > 0 && (
        <ul className="status-list">
          {disrupted.map(([lineId, statuses]) => {
            const line = graph.lines.get(lineId);
            const reasons = [...new Set(statuses.map((s) => s.reason).filter(Boolean))];
            return (
              <li key={lineId}>
                <details>
                  <summary>
                    <span
                      className="swatch"
                      style={{ background: line?.colour }}
                      aria-hidden="true"
                    />
                    <span className="status-line">{line?.name ?? lineId}</span>
                    <span className="status-desc">
                      {[...new Set(statuses.map((s) => s.description))].join(", ")}
                    </span>
                  </summary>
                  {reasons.map((reason) => (
                    <p key={reason} className="small">
                      {reason}
                    </p>
                  ))}
                </details>
              </li>
            );
          })}
        </ul>
      )}
      {status && disrupted.length > 0 && (
        <p className="muted small">Good service on all other lines.</p>
      )}
    </section>
  );
}
