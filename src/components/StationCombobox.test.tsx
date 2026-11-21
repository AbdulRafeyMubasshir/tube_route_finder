import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { StationCombobox } from "./StationCombobox";
import { searchStations } from "../lib/searchStations";
import type { Station } from "../engine";

const stations: Station[] = [
  { id: "bank", name: "Bank", x: 0, y: 0 },
  { id: "baker-street", name: "Baker Street", x: 0, y: 0 },
  { id: "kings-cross", name: "King's Cross St Pancras", x: 0, y: 0 },
  { id: "elephant", name: "Elephant & Castle", x: 0, y: 0 },
  { id: "great-portland", name: "Great Portland Street", x: 0, y: 0 },
];

function Harness({ onChange = () => {} }: { onChange?: (id: string | null) => void }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <StationCombobox
      label="From"
      stations={stations}
      value={value}
      onChange={(id) => {
        setValue(id);
        onChange(id);
      }}
    />
  );
}

describe("searchStations", () => {
  it("returns nothing for an empty query", () => {
    expect(searchStations(stations, "  ")).toEqual([]);
  });

  it("ranks prefix matches before word and substring matches", () => {
    expect(searchStations(stations, "st").map((s) => s.id)).toEqual([
      "baker-street",
      "great-portland",
      "kings-cross",
      "elephant", // substring match in "Castle"
    ]);
  });

  it("ignores apostrophes and ampersands", () => {
    expect(searchStations(stations, "kings")[0]?.id).toBe("kings-cross");
    expect(searchStations(stations, "elephant and")[0]?.id).toBe("elephant");
  });
});

describe("StationCombobox", () => {
  it("selects a suggestion with the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "From" });

    await user.type(input, "ba");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(2);

    // The first suggestion is active as you type; Arrow Down moves to the next.
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("bank");
    expect(input).toHaveValue("Bank");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("wraps around with the arrow keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.type(screen.getByRole("combobox"), "ba");
    await user.keyboard("{ArrowUp}{Enter}"); // from the first to the last suggestion
    expect(onChange).toHaveBeenLastCalledWith("bank");
  });

  it("selects a suggestion with the mouse", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.type(screen.getByRole("combobox"), "king");
    await user.click(screen.getByRole("option", { name: "King's Cross St Pancras" }));
    expect(onChange).toHaveBeenLastCalledWith("kings-cross");
  });

  it("closes on Escape and flags unknown stations", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("combobox");
    await user.type(input, "ba");
    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");

    await user.clear(input);
    await user.type(input, "zzz");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/No station matches/)).toBeInTheDocument();
  });

  it("clears the selection when the text is edited", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole("combobox");
    await user.type(input, "bank");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("bank");
    await user.type(input, "x");
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
