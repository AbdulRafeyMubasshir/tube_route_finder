import { planJourneys, type DayType, type Journey, type Timetable } from "../engine/raptor";

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const WEEKDAY_NAMES: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** Service days start around 4am; earlier times belong to the previous day's timetable. */
const SERVICE_DAY_START = 4 * 60;

export function dayTypeOf(weekday: Weekday): DayType {
  if (weekday === "fri") return "friday";
  if (weekday === "sat") return "saturday";
  if (weekday === "sun") return "sunday";
  return "weekday";
}

const shiftWeekday = (weekday: Weekday, by: number): Weekday =>
  WEEKDAYS[(WEEKDAYS.indexOf(weekday) + by + 7) % 7] as Weekday;

/** Current weekday and minutes after midnight in London. */
export function londonNow(now = new Date()): { weekday: Weekday; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday").slice(0, 3).toLowerCase() as Weekday;
  return { weekday, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** "09:05"; times past midnight wrap, with " (+1)" for the next day. */
export function formatClock(minutes: number): string {
  const total = Math.round(minutes);
  const day = Math.floor(total / 1440);
  const m = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}${day > 0 ? " (+1)" : ""}`;
}

export function parseClock(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes < 1440 ? minutes : null;
}

const shiftJourney = (j: Journey, by: number): Journey => ({
  ...j,
  departure: j.departure + by,
  arrival: j.arrival + by,
  times: j.times.map((t) => ({ start: t.start + by, end: t.end + by })),
});

const trainCount = (j: Journey) => j.segments.filter((s) => s.kind === "ride").length;

/** Keeps journeys where each extra train buys a strictly earlier arrival. */
export function paretoFront(journeys: Journey[]): Journey[] {
  const sorted = [...journeys].sort(
    (a, b) => trainCount(a) - trainCount(b) || a.arrival - b.arrival,
  );
  const front: Journey[] = [];
  for (const j of sorted) {
    const last = front.at(-1);
    if (!last || j.arrival < last.arrival - 1e-9) {
      if (last && trainCount(last) === trainCount(j)) front.pop();
      front.push(j);
    }
  }
  return front;
}

/**
 * Plans journeys leaving at `minutes` on `weekday`, handling service days that
 * run past midnight: before 4am it also searches the previous day's late
 * trains, and if nothing runs it tries the first trains of the next morning.
 * Times in the result are relative to midnight at the start of `weekday`.
 */
export function planAcrossServiceDays(
  timetable: Timetable,
  from: string,
  to: string,
  weekday: Weekday,
  minutes: number,
  changeMinutes?: number,
): { journeys: Journey[]; nextMorning: boolean } {
  const run = (day: Weekday, departAt: number, shift: number) =>
    planJourneys(timetable, from, to, {
      day: dayTypeOf(day),
      departAt,
      ...(changeMinutes === undefined ? {} : { changeMinutes }),
    }).map((j) => shiftJourney(j, shift));

  const found = run(weekday, minutes, 0);
  if (minutes < SERVICE_DAY_START)
    found.push(...run(shiftWeekday(weekday, -1), minutes + 1440, -1440));
  if (found.length) return { journeys: paretoFront(found), nextMorning: false };

  const start = Math.max(minutes, SERVICE_DAY_START);
  const nextDay = minutes < SERVICE_DAY_START ? weekday : shiftWeekday(weekday, 1);
  const shift = minutes < SERVICE_DAY_START ? 0 : 1440;
  const next = run(nextDay, minutes < SERVICE_DAY_START ? start : SERVICE_DAY_START, shift);
  return { journeys: paretoFront(next), nextMorning: next.length > 0 };
}
