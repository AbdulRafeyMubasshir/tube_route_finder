import { useId } from "react";
import { WEEKDAYS, WEEKDAY_NAMES, londonNow, type Weekday } from "../lib/serviceTime";

interface Props {
  /** "HH:MM", or null for leave now. */
  at: string | null;
  day: Weekday | null;
  onChange: (at: string | null, day: Weekday | null) => void;
}

const ORDER: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** "Leave now" or "Leave at" a chosen day and time (London time). */
export function DepartureControl({ at, day, onChange }: Props) {
  const id = useId();
  const planned = at !== null;

  const startPlanning = () => {
    const now = londonNow();
    const hh = String(Math.floor(now.minutes / 60)).padStart(2, "0");
    const mm = String(now.minutes % 60).padStart(2, "0");
    onChange(`${hh}:${mm}`, now.weekday);
  };

  return (
    <fieldset className="departure">
      <legend className="field-label">When</legend>
      <div className="departure-row">
        <select
          aria-label="Leave now or later"
          value={planned ? "at" : "now"}
          onChange={(event) =>
            event.target.value === "now" ? onChange(null, null) : startPlanning()
          }
        >
          <option value="now">Leave now</option>
          <option value="at">Leave at…</option>
        </select>
        {planned && (
          <>
            <select
              id={`${id}-day`}
              aria-label="Day"
              value={day ?? WEEKDAYS[new Date().getDay()]}
              onChange={(event) => onChange(at, event.target.value as Weekday)}
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
              onChange={(event) => event.target.value && onChange(event.target.value, day)}
            />
          </>
        )}
      </div>
    </fieldset>
  );
}
