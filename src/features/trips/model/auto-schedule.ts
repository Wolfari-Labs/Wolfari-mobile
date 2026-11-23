import { haversine, type LatLng } from "./place.ts";
import { dateKey, localTimestamp, timeLabel } from "../utils.ts";

/**
 * Time-slot planning for one day of the itinerary, done on the device as a draft the
 * group still reviews and saves. Durations come from the activity itself (its saved
 * start/end) or a sensible default per type; moving between places costs travel time
 * from the straight-line distance at city speed plus a buffer; a lunch break is kept
 * around noon when the day has no meal yet.
 */
export type Schedulable = {
  id: string;
  activity_type: string;
  starts_at: string | null;
  ends_at: string | null;
  selected_location_id: string | null;
};
export type Slot = { id: string; starts_at: string; ends_at: string };
export type DayPlan = { slots: Slot[]; overflow: string[]; lunch?: { starts: string; ends: string } };

export const DAY_START = 8 * 60;
export const DAY_END = 22 * 60;
const LUNCH_FROM = 11 * 60 + 30;
const LUNCH_UNTIL = 14 * 60;
const LUNCH_LENGTH = 60;
const CITY_KMH = 25;

const TYPE_MINUTES: Record<string, number> = {
  MEAL: 60, FOOD: 60, CAFE: 45, TRANSPORT: 45, SIGHTSEEING: 90, MUSEUM: 90, BEACH: 120, SHOPPING: 60, OTHER: 60,
};
const MEALS = new Set(["MEAL", "FOOD", "CAFE", "RESTAURANT"]);

/** Minutes the activity takes: its saved length (15 min–10 h) or the default for its type. */
export function activityMinutes(activity: Pick<Schedulable, "activity_type" | "starts_at" | "ends_at">, fallback?: number): number {
  if (activity.starts_at && activity.ends_at) {
    const saved = Math.round((Date.parse(activity.ends_at) - Date.parse(activity.starts_at)) / 60_000);
    if (Number.isFinite(saved) && saved >= 15) return Math.min(saved, 600);
  }
  return fallback ?? TYPE_MINUTES[activity.activity_type] ?? 60;
}

/** Door-to-door estimate between two places: city speed plus 10 minutes, in 5-minute steps. */
export function travelMinutes(from?: LatLng, to?: LatLng): number {
  if (!from || !to) return 15;
  const km = haversine(from, to) / 1000;
  if (km < 0.2) return 10;
  return Math.min(180, Math.max(10, Math.ceil(((km / CITY_KMH) * 60 + 10) / 5) * 5));
}

const roundUp = (minutes: number, step = 15) => Math.ceil(minutes / step) * step;
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
function minutesOf(iso: string, timezone: string): number {
  const [h, m] = timeLabel(iso, timezone).split(":").map(Number);
  return h * 60 + m;
}

/**
 * Lays the day's activities out in their current order. The first activity keeps its
 * saved start if it has one (the user's anchor), otherwise the day starts at 08:00.
 * Activities that would end after 22:00 are left untimed (`overflow`).
 */
export function planDay({
  day,
  timezone,
  activities,
  placeOf,
  start,
}: {
  day: string;
  timezone: string;
  activities: readonly Schedulable[];
  placeOf: (locationId: string | null) => LatLng | undefined;
  start?: number;
}): DayPlan {
  const first = activities[0];
  const anchored = first?.starts_at && dateKey(first.starts_at, timezone) === day ? minutesOf(first.starts_at, timezone) : undefined;
  let cursor = start ?? anchored ?? DAY_START;
  let hadMeal = false;
  let lunch: DayPlan["lunch"];
  const slots: Slot[] = [];
  const overflow: string[] = [];
  let previous: LatLng | undefined;
  activities.forEach((activity, index) => {
    const here = placeOf(activity.selected_location_id);
    if (index > 0) cursor += travelMinutes(previous, here);
    if (index > 0 || anchored === undefined) cursor = roundUp(cursor);
    const meal = MEALS.has(activity.activity_type);
    if (meal && cursor >= LUNCH_FROM - 60 && cursor < LUNCH_UNTIL) hadMeal = true;
    // Keep a lunch break when the day reaches noon without a meal of its own.
    if (!meal && !hadMeal && cursor >= LUNCH_FROM && cursor < LUNCH_UNTIL) {
      lunch = { starts: clock(cursor), ends: clock(cursor + LUNCH_LENGTH) };
      cursor = roundUp(cursor + LUNCH_LENGTH);
      hadMeal = true;
    }
    const length = activityMinutes(activity);
    if (cursor + length > DAY_END || overflow.length) {
      overflow.push(activity.id);
      return;
    }
    const starts_at = localTimestamp(day, clock(cursor), timezone);
    const ends_at = localTimestamp(day, clock(cursor + length), timezone);
    if (!starts_at || !ends_at) {
      overflow.push(activity.id);
      return;
    }
    slots.push({ id: activity.id, starts_at, ends_at });
    cursor += length;
    previous = here ?? previous;
  });
  return { slots, overflow, lunch };
}

/**
 * Shorter path through the day: keeps the first stop, then always goes to the nearest
 * remaining place. Activities without a place keep their positions.
 */
export function shortestOrder<T extends Schedulable>(activities: readonly T[], placeOf: (locationId: string | null) => LatLng | undefined): T[] {
  const placed = activities.filter((item) => placeOf(item.selected_location_id));
  if (placed.length < 3) return [...activities];
  const [head, ...rest] = placed;
  const route = [head];
  let current = placeOf(head.selected_location_id)!;
  while (rest.length) {
    let best = 0;
    for (let i = 1; i < rest.length; i++)
      if (haversine(current, placeOf(rest[i].selected_location_id)!) < haversine(current, placeOf(rest[best].selected_location_id)!)) best = i;
    const [next] = rest.splice(best, 1);
    route.push(next);
    current = placeOf(next.selected_location_id)!;
  }
  let cursor = 0;
  return activities.map((item) => (placeOf(item.selected_location_id) ? route[cursor++] : item));
}

/** Total straight-line kilometres visiting the activities in order (for "saves x km"). */
export function pathKm(activities: readonly Schedulable[], placeOf: (locationId: string | null) => LatLng | undefined): number {
  let total = 0;
  let previous: LatLng | undefined;
  for (const item of activities) {
    const here = placeOf(item.selected_location_id);
    if (here && previous) total += haversine(previous, here) / 1000;
    if (here) previous = here;
  }
  return total;
}

/**
 * Where a new activity fits on a day: after the last timed activity plus travel, else
 * 09:00. Undefined when it would end after 22:00 (offer "no time yet" instead).
 */
export function nextSlot({
  day,
  timezone,
  activities,
  placeOf,
  place,
  minutes,
}: {
  day: string;
  timezone: string;
  activities: readonly Schedulable[];
  placeOf: (locationId: string | null) => LatLng | undefined;
  place?: LatLng;
  minutes: number;
}): { starts_at: string; ends_at: string; label: string } | undefined {
  const timed = activities
    .filter((item) => item.starts_at && dateKey(item.starts_at, timezone) === day)
    .sort((a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!));
  const last = timed.at(-1);
  let cursor = 9 * 60;
  if (last) {
    const end = last.ends_at ?? new Date(Date.parse(last.starts_at!) + activityMinutes(last) * 60_000).toISOString();
    cursor = roundUp(minutesOf(end, timezone) + travelMinutes(placeOf(last.selected_location_id), place));
    if (dateKey(end, timezone) !== day) return undefined;
  }
  if (cursor + minutes > DAY_END) return undefined;
  const starts_at = localTimestamp(day, clock(cursor), timezone);
  const ends_at = localTimestamp(day, clock(cursor + minutes), timezone);
  return starts_at && ends_at ? { starts_at, ends_at, label: `${clock(cursor)}–${clock(cursor + minutes)}` } : undefined;
}
