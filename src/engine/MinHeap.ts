/**
 * Binary min-heap ordered by a comparator. push/pop are O(log n).
 */
export class MinHeap<T> {
  private readonly items: T[] = [];

  constructor(private readonly compare: (a: T, b: T) => number) {}

  get size(): number {
    return this.items.length;
  }

  push(item: T): void {
    this.items.push(item);
    this.siftUp(this.items.length - 1);
  }

  pop(): T | undefined {
    const items = this.items;
    if (items.length === 0) return undefined;
    const top = items[0];
    const last = items.pop() as T;
    if (items.length > 0) {
      items[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  private siftUp(index: number): void {
    const items = this.items;
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(items[i] as T, items[parent] as T) >= 0) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  private siftDown(index: number): void {
    const items = this.items;
    const n = items.length;
    let i = index;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < n && this.compare(items[left] as T, items[smallest] as T) < 0) smallest = left;
      if (right < n && this.compare(items[right] as T, items[smallest] as T) < 0) smallest = right;
      if (smallest === i) return;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  private swap(a: number, b: number): void {
    const items = this.items;
    const tmp = items[a] as T;
    items[a] = items[b] as T;
    items[b] = tmp;
  }
}
