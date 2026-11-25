import type { Activity, Plan, Trip } from "../types";
import { activityDay, calendarLabel, timeLabel, tripPeriod } from "../utils.ts";

type SharedTrip = Pick<Trip, "id" | "name" | "start_at" | "end_at" | "timezone">;

function placeOf(plan: Plan, activity: Activity) {
  const place = plan.selected_locations.find(item => item.id === activity.selected_location_id);
  return place ? [place.name, place.address].filter(Boolean).join(", ") : "";
}

/** Plain itinerary for chat apps: titles, times and places only; no notes, fund or member data. */
export function planText(trip: SharedTrip, plan: Plan): string {
  const days = new Map<string, Activity[]>();
  const time = (item: Activity) => item.starts_at ? Date.parse(item.starts_at) : Number.MAX_SAFE_INTEGER;
  for (const activity of [...plan.activities].sort((a, b) => time(a) - time(b) || a.position - b.position)) {
    const day = activityDay(activity, trip.timezone) ?? "";
    days.set(day, [...(days.get(day) ?? []), activity]);
  }
  const keys = [...days.keys()].sort((a, b) => (a || "9999").localeCompare(b || "9999"));
  const lines = [trip.name, tripPeriod(trip).label];
  for (const key of keys) {
    lines.push("", key ? calendarLabel(key) : "Chưa xếp ngày");
    for (const activity of days.get(key)!) {
      const place = placeOf(plan, activity);
      lines.push(`• ${activity.starts_at ? `${timeLabel(activity.starts_at, trip.timezone)} ` : ""}${activity.title}${place ? ` · ${place}` : ""}`);
    }
  }
  if (!keys.length) lines.push("", "Chưa có hoạt động nào.");
  return lines.join("\n");
}

const escapeIcs = (value: string) => value.replace(/\\/g, "\\\\").replace(/[;,]/g, match => `\\${match}`).replace(/\r\n|\r|\n/g, "\\n");
const stamp = (value: number) => new Date(value).toISOString().replace(/[-:]|\.\d{3}/g, "");

/** RFC 5545 lines are at most 75 octets; split between characters, never inside one. */
function fold(line: string) {
  let out = "", size = 0;
  for (const char of line) {
    const code = char.codePointAt(0)!;
    const bytes = code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
    if (size + bytes > 73) { out += "\r\n "; size = 1; }
    out += char;
    size += bytes;
  }
  return out;
}

/** Activities with a time or a day; undefined when nothing can go on a calendar. */
export function planCalendar(trip: SharedTrip, plan: Plan, now = Date.now()): string | undefined {
  const events = plan.activities.flatMap(activity => {
    const place = placeOf(plan, activity);
    const common = [`UID:${activity.id}@wolfari`, `DTSTAMP:${stamp(now)}`, `SUMMARY:${escapeIcs(activity.title)}`, ...(place ? [`LOCATION:${escapeIcs(place)}`] : [])];
    if (activity.starts_at) {
      const start = Date.parse(activity.starts_at);
      const end = activity.ends_at ? Date.parse(activity.ends_at) : 0;
      return [["BEGIN:VEVENT", ...common, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end > start ? end : start + 3_600_000)}`, "END:VEVENT"]];
    }
    if (!activity.scheduled_date) return [];
    const next = new Date(Date.parse(`${activity.scheduled_date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const day = (value: string) => value.replace(/-/g, "");
    return [["BEGIN:VEVENT", ...common, `DTSTART;VALUE=DATE:${day(activity.scheduled_date)}`, `DTEND;VALUE=DATE:${day(next)}`, "END:VEVENT"]];
  });
  if (!events.length) return undefined;
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Wolfari//Trip plan//VI", `X-WR-CALNAME:${escapeIcs(trip.name)}`, ...events.flat(), "END:VCALENDAR", ""].map(fold).join("\r\n");
}
