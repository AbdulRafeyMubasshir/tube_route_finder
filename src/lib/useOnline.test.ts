import { act, renderHook } from "@testing-library/react";
import { useOnline } from "./useOnline";

describe("useOnline", () => {
  it("follows online and offline events", () => {
    const spy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
    spy.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);
    spy.mockRestore();
  });
});
