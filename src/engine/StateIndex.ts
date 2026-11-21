import type { Graph } from "./Graph";
import type { StationId } from "./types";

/**
 * Integer-indexed state graph used by the search, built once per Graph.
 *
 * States are numbered so the search can use typed arrays instead of string
 * keys and Maps:
 *   [0, N)        "start":    at station i, not yet boarded
 *   [N, 2N)       "platform": at station i after leaving a train
 *   [2N, total)   on a train: arrived at position j of pattern p
 *
 * Transitions are stored as flat arrays (compressed sparse row) so iterating a
 * state's options is a tight loop over contiguous memory.
 */
export interface StateIndex {
  stationCount: number;
  stateCount: number;
  stationIds: StationId[];
  stationIndex: Map<StationId, number>;
  /** Station index for every state. */
  stationOf: Int32Array;
  /** Boarding transitions per station: CSR offsets, target states, minutes, edge index. */
  boardStart: Int32Array;
  boardTarget: Int32Array;
  boardMinutes: Float64Array;
  boardEdge: Int32Array;
  /** Walking transitions per station. */
  walkStart: Int32Array;
  walkTarget: Int32Array; // station index
  walkMinutes: Float64Array;
  walkEdge: Int32Array;
  /** For on-train states: the next state on the same train (-1 at the end), its minutes and edge. */
  nextState: Int32Array;
  nextMinutes: Float64Array;
  nextEdge: Int32Array;
}

function toCsr(lists: number[][][], width: number) {
  const start = new Int32Array(lists.length + 1);
  let total = 0;
  lists.forEach((items, i) => {
    start[i] = total;
    total += items.length;
  });
  start[lists.length] = total;
  const columns = Array.from({ length: width }, () => new Float64Array(total));
  let k = 0;
  for (const items of lists) {
    for (const item of items) {
      item.forEach((value, c) => ((columns[c] as Float64Array)[k] = value));
      k++;
    }
  }
  return { start, columns };
}

export function buildStateIndex(graph: Graph): StateIndex {
  const stationIds = [...graph.stations.keys()];
  const stationIndex = new Map(stationIds.map((id, i) => [id, i]));
  const n = stationIds.length;
  const edgeIndex = new Map(graph.edges.map((e, i) => [e, i]));

  const stationOf: number[] = [];
  for (let i = 0; i < n; i++) stationOf[i] = i;
  for (let i = 0; i < n; i++) stationOf[n + i] = i;

  const boards: number[][][] = Array.from({ length: n }, () => []);
  const walks: number[][][] = Array.from({ length: n }, () => []);
  const nextState: number[] = [];
  const nextMinutes: number[] = [];
  const nextEdge: number[] = [];

  // Ride edges grouped by pattern, in stop order.
  const byPattern = new Map<string, Extract<(typeof graph.edges)[number], { kind: "ride" }>[]>();
  for (const edge of graph.edges) {
    if (edge.kind !== "ride") continue;
    const list = byPattern.get(edge.pattern) ?? [];
    list.push(edge);
    byPattern.set(edge.pattern, list);
  }

  let state = 2 * n;
  for (const hops of byPattern.values()) {
    // On-train state for arriving at the end of each hop.
    const first = state;
    hops.forEach((hop, j) => {
      const s = first + j;
      stationOf[s] = stationIndex.get(hop.to) as number;
      const following = hops[j + 1];
      nextState[s - 2 * n] = following ? s + 1 : -1;
      nextMinutes[s - 2 * n] = following?.minutes ?? 0;
      nextEdge[s - 2 * n] = following ? (edgeIndex.get(following) as number) : -1;
      boards[stationIndex.get(hop.from) as number]?.push([
        s,
        hop.minutes,
        edgeIndex.get(hop) as number,
      ]);
    });
    state += hops.length;
  }

  for (const edge of graph.edges) {
    if (edge.kind !== "walk") continue;
    walks[stationIndex.get(edge.from) as number]?.push([
      stationIndex.get(edge.to) as number,
      edge.minutes,
      edgeIndex.get(edge) as number,
    ]);
  }

  const board = toCsr(boards, 3);
  const walk = toCsr(walks, 3);
  return {
    stationCount: n,
    stateCount: state,
    stationIds,
    stationIndex,
    stationOf: Int32Array.from(stationOf),
    boardStart: board.start,
    boardTarget: Int32Array.from(board.columns[0] as Float64Array),
    boardMinutes: board.columns[1] as Float64Array,
    boardEdge: Int32Array.from(board.columns[2] as Float64Array),
    walkStart: walk.start,
    walkTarget: Int32Array.from(walk.columns[0] as Float64Array),
    walkMinutes: walk.columns[1] as Float64Array,
    walkEdge: Int32Array.from(walk.columns[2] as Float64Array),
    nextState: Int32Array.from(nextState),
    nextMinutes: Float64Array.from(nextMinutes),
    nextEdge: Int32Array.from(nextEdge),
  };
}
