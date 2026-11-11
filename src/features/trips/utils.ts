import type { Activity, Trip } from "./types";

export const lifecycleLabels = { UPCOMING: "Sắp tới", ONGOING: "Đang đi", COMPLETED: "Đã đi", ARCHIVED: "Lưu trữ" };
export function dateLabel(value: string, timezone = "Asia/Ho_Chi_Minh") {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: timezone }).format(new Date(value));
}
// end_at is exclusive (web stores next-day 00:00), so show the last day the trip covers, like web does (end_at - 1 ms).
export function tripDates(trip: Trip) { return `${dateLabel(trip.start_at, trip.timezone)} – ${calendarLabel(lastTripDay(trip))}`; }
export function dateKey(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: timezone }).formatToParts(new Date(value));
  const part = (key: string) => parts.find(p => p.type === key)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function tripDays(trip: Trip) {
  const first = dateKey(trip.start_at, trip.timezone);
  // Trips are half-open [start_at, end_at): an end at local 00:00 does not add a calendar day.
  const last = lastTripDay(trip);
  const result: string[] = [];
  let stamp = Date.parse(`${first}T12:00:00Z`);
  const end = Date.parse(`${last}T12:00:00Z`);
  while (stamp <= end && result.length < 366) { result.push(new Date(stamp).toISOString().slice(0, 10)); stamp += 86_400_000; }
  return result;
}
export function lastTripDay(trip: Pick<Trip, "start_at" | "end_at" | "timezone">) {
  const end = Date.parse(trip.end_at), start = Date.parse(trip.start_at);
  return dateKey(new Date(Math.max(start, end - 1)).toISOString(), trip.timezone);
}
/** A calendar day may hold a day-only activity when it overlaps the trip. */
export function isTripDay(day: string, trip: Pick<Trip, "start_at" | "end_at" | "timezone">) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= dateKey(trip.start_at, trip.timezone) && day <= lastTripDay(trip);
}
export type ActivitySchedule = "unscheduled" | "day" | "timed";
export function activitySchedule(activity: Pick<Activity, "starts_at" | "scheduled_date">): ActivitySchedule {
  return activity.starts_at ? "timed" : activity.scheduled_date ? "day" : "unscheduled";
}
/** Local calendar day of an activity: timed activities by start instant, day-only by their stored date. */
export function activityDay(activity: Pick<Activity, "starts_at" | "scheduled_date">, timezone: string) {
  if (activity.starts_at) return dateKey(activity.starts_at, timezone);
  return activity.scheduled_date ?? undefined;
}
export function activityTimeLabel(activity: Pick<Activity, "starts_at" | "scheduled_date">, timezone: string) {
  return activity.starts_at ? timeLabel(activity.starts_at, timezone) : activity.scheduled_date ? "Cả ngày" : "Chưa xếp";
}
/** dd/mm/yyyy for a calendar string without converting through UTC instants. */
export function calendarLabel(day: string) {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}
export function timeLabel(value: string | null, timezone: string) {
  return value ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: timezone }).format(new Date(value)) : "Chưa xếp";
}
export function parseDate(value: string): string | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return;
  const [, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.getUTCDate() !== +day || date.getUTCMonth() + 1 !== +month || +year < 2000) return;
  return `${year}-${month}-${day}`;
}
export function localTimestamp(date: string, time: string, timezone: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
  // Derive the IANA zone's offset at this date, including DST, without assuming the phone's zone.
  const target = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(target)) return;
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess));
    const p = (key: string) => parts.find(v => v.type === key)?.value;
    const shown = Date.parse(`${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}:${p("second")}Z`);
    guess += target - shown;
  }
  const iso = new Date(guess).toISOString();
  return dateKey(iso, timezone) === date && timeLabel(iso, timezone) === time ? iso : undefined;
}
// The shared plan owns order. Timestamps are labels, not a client-side override.
export function sortedActivities(items: Activity[]) { return [...items].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)); }
export function invitationToken(value: string) {
  const match = /(?:^|[#?&])token=(inv1_[A-Za-z0-9_-]{43})(?:&|$)/.exec(value.trim());
  const token = match?.[1] ?? value.trim();
  return /^inv1_[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}
