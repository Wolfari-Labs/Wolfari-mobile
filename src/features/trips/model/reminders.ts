import type { Plan } from "../types";
import { dateLabel, localTimestamp, parseDate, timeLabel } from "../utils.ts";

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
