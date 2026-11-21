import { conditionsFrom, isDisrupted, type LineStatus } from "./conditions";

const status = (line: string, severity: number, closedSections: string[][] = []): LineStatus => ({
  line,
  severity,
  description: "",
  reason: null,
  closedSections,
});

describe("conditionsFrom", () => {
  it("closes every hop of a closed section, in both directions", () => {
    const { closedHops } = conditionsFrom([status("district", 3, [["ECT", "KOY"]])]);
    expect([...closedHops].sort()).toEqual(["district|ECT|KOY", "district|KOY|ECT"]);
  });

  it("ignores sections listed for delays, and keeps the worst delay per line", () => {
    const { closedHops, delayFactor } = conditionsFrom([
      status("central", 6, [["A", "B", "C"]]),
      status("central", 9),
      status("victoria", 9),
      status("jubilee", 10),
    ]);
    expect(closedHops.size).toBe(0);
    expect(delayFactor.get("central")).toBe(1.35);
    expect(delayFactor.get("victoria")).toBe(1.15);
    expect(delayFactor.has("jubilee")).toBe(false);
  });

  it("flags anything but good service as disrupted", () => {
    expect(isDisrupted(status("x", 10))).toBe(false);
    expect(isDisrupted(status("x", 9))).toBe(true);
  });
});
