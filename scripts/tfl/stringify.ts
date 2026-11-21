/**
 * JSON with one-space indentation but numeric arrays kept on one line, so large
 * snapshots stay readable and produce small diffs.
 */
export function stringifyCompact(value: unknown): string {
  return JSON.stringify(value, null, 1).replace(
    /\[\s*(-?[\d.]+(?:,\s*-?[\d.]+)*)\s*\]/g,
    (_, items: string) =>
      `[${items
        .split(",")
        .map((x) => x.trim())
        .join(",")}]`,
  );
}
