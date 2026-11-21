import type { Line } from "../engine";

export function Legend({ lines }: { lines: readonly Line[] }) {
  return (
    <ul className="legend" aria-label="Lines on the map">
      {lines.map((line) => (
        <li key={line.id}>
          <span className="swatch" style={{ background: line.colour }} aria-hidden="true" />
          {line.name}
        </li>
      ))}
    </ul>
  );
}
