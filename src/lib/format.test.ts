import { formatMinutes, normaliseForSearch, pluralise } from "./format";

describe("formatMinutes", () => {
  it.each([
    [0.2, "1 min"],
    [12.4, "12 min"],
    [59.6, "1 h"],
    [75, "1 h 15 min"],
    [120, "2 h"],
  ])("%s -> %s", (input, expected) => {
    expect(formatMinutes(input)).toBe(expected);
  });
});

describe("pluralise", () => {
  it("uses the singular for one", () => expect(pluralise(1, "change")).toBe("1 change"));
  it("uses the plural otherwise", () => expect(pluralise(0, "stop")).toBe("0 stops"));
  it("accepts an irregular plural", () => expect(pluralise(2, "bus", "buses")).toBe("2 buses"));
});

describe("normaliseForSearch", () => {
  it("ignores case, apostrophes and brackets", () => {
    expect(normaliseForSearch("King's Cross St Pancras")).toBe("kings cross st pancras");
    expect(normaliseForSearch("Paddington (H&C)")).toBe("paddington handc");
  });
});
