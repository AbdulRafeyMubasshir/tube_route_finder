import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { searchStations, type Searchable } from "../lib/searchStations";

interface Props {
  label: string;
  stations: readonly Searchable[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
}

/**
 * Accessible station picker following the WAI-ARIA combobox pattern:
 * type to filter, arrow keys to move, Enter to choose, Escape to close.
 */
export function StationCombobox({ label, stations, value, onChange, placeholder }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const selected = stations.find((s) => s.id === value) ?? null;

  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [syncedValue, setSyncedValue] = useState(value);

  // Keep the text in step when the value changes from outside (map click, swap, URL).
  if (value !== syncedValue) {
    setSyncedValue(value);
    setQuery(selected?.name ?? "");
  }

  const results = useMemo(() => searchStations(stations, query), [stations, query]);
  const expanded = open && results.length > 0;
  const noMatch = open && query.trim() !== "" && results.length === 0 && !selected;

  const choose = (station: Searchable) => {
    setQuery(station.name);
    setOpen(false);
    onChange(station.id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setOpen(true);
        setActive((i) => (results.length ? (i + 1) % results.length : 0));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
        break;
      case "Enter": {
        const station = results[active];
        if (expanded && station) {
          event.preventDefault();
          choose(station);
        }
        break;
      }
      case "Escape":
        setOpen(false);
        break;
    }
  };

  return (
    <div className="combobox">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded ? `${id}-opt-${active}` : undefined}
        aria-invalid={noMatch || undefined}
        placeholder={placeholder}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
          if (value) onChange(null);
        }}
        onFocus={(event) => event.target.select()}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <ul id={listId} role="listbox" aria-label={`${label} suggestions`} hidden={!expanded}>
        {results.map((station, index) => (
          <li
            key={station.id}
            id={`${id}-opt-${index}`}
            role="option"
            aria-selected={index === active}
            className={index === active ? "active" : undefined}
            // mousedown, not click, so the input's blur doesn't close the list first
            onMouseDown={(event) => {
              event.preventDefault();
              choose(station);
            }}
            onMouseEnter={() => setActive(index)}
          >
            {station.name}
          </li>
        ))}
      </ul>
      {noMatch && <p className="field-hint">No station matches “{query.trim()}”.</p>}
    </div>
  );
}
