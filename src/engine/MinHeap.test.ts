import fc from "fast-check";
import { MinHeap } from "./MinHeap";

describe("MinHeap", () => {
  it("returns undefined when empty", () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    expect(heap.pop()).toBeUndefined();
    expect(heap.size).toBe(0);
  });

  it("pops items in ascending order", () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (values) => {
        const heap = new MinHeap<number>((a, b) => a - b);
        values.forEach((v) => heap.push(v));
        const out: number[] = [];
        while (heap.size > 0) out.push(heap.pop() as number);
        expect(out).toEqual([...values].sort((a, b) => a - b));
      }),
    );
  });

  it("handles interleaved pushes and pops", () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    heap.push(5);
    heap.push(1);
    expect(heap.pop()).toBe(1);
    heap.push(3);
    heap.push(0);
    expect(heap.pop()).toBe(0);
    expect(heap.pop()).toBe(3);
    expect(heap.pop()).toBe(5);
  });
});
