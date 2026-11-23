import type { Plan } from "../types";
import { dateKey, dateLabel, localTimestamp, parseDate, timeLabel } from "../utils.ts";

export type ReminderSource = { id: string; type: "ACTIVITY" | "PACKING"; label: string; at: string };
export function reminderSources(plan: Plan, now = Date.now()): ReminderSource[] {
  return [
    ...plan.activities.flatMap(item => item.starts_at && item.status !== "COMPLETED" && Date.parse(item.starts_at) > now ? [{ id: item.id, type: "ACTIVITY" as const, label: item.title, at: item.starts_at }] : []),
    ...plan.packing_items.flatMap(item => item.due_at && item.status !== "COMPLETED" && Date.parse(item.due_at) > now ? [{ id: item.id, type: "PACKING" as const, label: item.name, at: item.due_at }] : []),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
export function defaultReminderTime(source: ReminderSource, timezone: string, now = Date.now()) {
  const at = new Date(Math.max(now + 120_000, Date.parse(source.at) - 30 * 60_000)).toISOString();
  return { date: dateLabel(at, timezone), time: timeLabel(at, timezone) };
}
export function reminderInput(source: ReminderSource | undefined, date: string, time: string, timezone: string, now = Date.now()) {
  if (!source) throw Error("Chọn hoạt động hoặc vật dụng cần nhắc.");
  const calendar = parseDate(date);
  const at = calendar ? localTimestamp(calendar, time.trim(), timezone) : undefined;
  if (!at || Date.parse(at) <= now || Date.parse(at) > Date.parse(source.at))
    throw Error("Giờ nhắc phải ở tương lai và không sau giờ hoạt động/hạn chuẩn bị.");
  return { source_type: source.type, source_id: source.id, remind_at: at };
}

export type ReminderPreset = { key: string; label: string; date: string; time: string; at: string };
/**
 * One-tap times before the activity/deadline: 15 minutes, 1 hour, 3 hours, 7:00 that
 * morning and the day before. Only future times strictly before the source are offered.
 */
export function reminderPresets(source: ReminderSource, timezone: string, now = Date.now()): ReminderPreset[] {
  const at = Date.parse(source.at);
  const morning = localTimestamp(dateKey(source.at, timezone), "07:00", timezone);
  const candidates: [string, string, number][] = [
    ["15m", "Trước 15 phút", at - 15 * 60_000],
    ["1h", "Trước 1 giờ", at - 3_600_000],
    ["3h", "Trước 3 giờ", at - 3 * 3_600_000],
    ...(morning ? [["morning", "7:00 sáng hôm đó", Date.parse(morning)] as [string, string, number]] : []),
    ["1d", "Trước 1 ngày", at - 86_400_000],
  ];
  const seen = new Set<number>();
  return candidates
    .filter(([, , time]) => time > now + 60_000 && time < at && !seen.has(time) && (seen.add(time), true))
    .map(([key, label, time]) => {
      const iso = new Date(time).toISOString();
      return { key, label, date: dateLabel(iso, timezone), time: timeLabel(iso, timezone), at: iso };
    });
}
