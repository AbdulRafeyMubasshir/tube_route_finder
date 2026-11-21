import { useId } from "react";
import { WEEKDAYS, WEEKDAY_NAMES, londonNow, type Weekday } from "../lib/serviceTime";

interface Props {
  /** "HH:MM", or null for leave now. */
  at: string | null;
  day: Weekday | null;
  /** With `at`: arrive by that time instead of leaving at it. */
  arrive: boolean;
  onChange: (at: string | null, day: Weekday | null, arrive: boolean) => void;
}

const ORDER: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** "Leave now", "Leave at" or "Arrive by" a chosen day and time (London time). */
export function DepartureControl({ at, day, arrive, onChange }: Props) {
  const id = useId();
  const planned = at !== null;
  const mode = !planned ? "now" : arrive ? "arrive" : "at";

  const setMode = (next: string) => {
    if (next === "now") return onChange(null, null, false);
    if (planned) return onChange(at, day, next === "arrive");
    const now = londonNow();
    const hh = String(Math.floor(now.minutes / 60)).padStart(2, "0");
    const mm = String(now.minutes % 60).padStart(2, "0");
    onChange(`${hh}:${mm}`, now.weekday, next === "arrive");
  };

  return (
    <fieldset className="departure">
      <legend className="field-label">When</legend>
      <div className="departure-row">
        <select
          aria-label="When to travel"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
        >
          <option value="now">Leave now</option>
          <option value="at">Leave at…</option>
          <option value="arrive">Arrive by…</option>
        </select>
        {planned && (
          <>
            <select
              id={`${id}-day`}
              aria-label="Day"
              value={day ?? WEEKDAYS[new Date().getDay()]}
              onChange={(event) => onChange(at, event.target.value as Weekday, arrive)}
            >
              {ORDER.map((d) => (
                <option key={d} value={d}>
                  {WEEKDAY_NAMES[d]}
                </option>
              ))}
            </select>
            <input
              type="time"
              aria-label="Time"
              value={at}
              onChange={(event) => event.target.value && onChange(event.target.value, day, arrive)}
            />
          </>
        )}
      </div>
    </fieldset>
  );
}
