import type { Line } from "../engine";

const MODE_ORDER = ["tube", "elizabeth-line", "dlr", "overground"];

export function Legend({ lines }: { lines: readonly Line[] }) {
  const sorted = [...lines].sort(
    (a, b) =>
      MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode) || a.name.localeCompare(b.name),
  );
  return (
    <ul className="legend" aria-label="Lines on the map">
      {sorted.map((line) => (
        <li key={line.id}>
          <span className="swatch" style={{ background: line.colour }} aria-hidden="true" />
          {line.name}
        </li>
      ))}
    </ul>
  );
}
