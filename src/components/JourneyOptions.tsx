import type { Journey } from "../engine/raptor";
import { formatMinutes, pluralise } from "../lib/format";
import { formatClock } from "../lib/serviceTime";

interface Props {
  journeys: Journey[];
  selected: number;
  onSelect: (index: number) => void;
}

/** The Pareto-optimal choices: faster with more changes, or simpler and a little slower. */
export function JourneyOptions({ journeys, selected, onSelect }: Props) {
  return (
    <div className="options" role="group" aria-label="Journey options">
      {journeys.map((journey, index) => (
        <button
          key={index}
          type="button"
          className="option"
          aria-pressed={index === selected}
          onClick={() => onSelect(index)}
        >
          <span className="option-times">
            {formatClock(journey.departure)} → {formatClock(journey.arrival)}
          </span>
          <span className="muted">
            {formatMinutes(journey.totalMinutes)} ·{" "}
            {journey.interchanges === 0 ? "direct" : pluralise(journey.interchanges, "change")}
          </span>
        </button>
      ))}
    </div>
  );
}
