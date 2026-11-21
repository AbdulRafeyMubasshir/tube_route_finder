import { act, renderHook } from "@testing-library/react";
import { readJourneyParams, useJourneyParams, writeJourneyParams } from "./useUrlState";

describe("journey URL params", () => {
  it("round-trips through the query string", () => {
    const params = {
      from: "brixton",
      to: "stanmore",
      fewerChanges: true,
      at: "09:30",
      day: "mon",
      live: false,
    };
    expect(readJourneyParams(writeJourneyParams(params))).toEqual(params);
  });

  it("omits empty values", () => {
    expect(
      writeJourneyParams({
        from: null,
        to: null,
        fewerChanges: false,
        at: null,
        day: "mon",
        live: true,
      }),
    ).toBe("");
  });

  it("syncs state to the address bar", () => {
    window.history.replaceState(null, "", "/?from=bank");
    const { result } = renderHook(() => useJourneyParams());
    expect(result.current[0].from).toBe("bank");
    act(() =>
      result.current[1]({
        from: "bank",
        to: "euston",
        fewerChanges: false,
        at: null,
        day: null,
        live: true,
      }),
    );
    expect(window.location.search).toBe("?from=bank&to=euston");
  });
});
