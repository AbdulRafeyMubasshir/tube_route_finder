import { act, renderHook, waitFor } from "@testing-library/react";
import { useLineStatus } from "./useLineStatus";

describe("useLineStatus", () => {
  it("loads status and refreshes it every two minutes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const load = vi.fn(async () => ({ statuses: [], updatedAt: new Date() }));
    const { result, unmount } = renderHook(() => useLineStatus(load));
    await waitFor(() => expect(result.current.status).not.toBeNull());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(load).toHaveBeenCalledTimes(2);
    unmount();
    vi.useRealTimers();
  });

  it("reports errors", async () => {
    const load = vi.fn(async () => {
      throw new Error("TfL down");
    });
    const { result } = renderHook(() => useLineStatus(load));
    await waitFor(() => expect(result.current.error).toBe("TfL down"));
  });
});
