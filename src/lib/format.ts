export function formatMinutes(minutes: number): string {
  const rounded = Math.max(1, Math.round(minutes));
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Lower-cases and strips punctuation so "kings x" style queries match. */
export function normaliseForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’.()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
