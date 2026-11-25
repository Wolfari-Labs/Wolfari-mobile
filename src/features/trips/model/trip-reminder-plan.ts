import type { Plan } from "../types";
import { reminderSources } from "./reminders.ts";

export type TripReminderKind = "ACTIVITY" | "PACKING";
type ExistingReminder = { id: string; source_type: string; source_id: string; remind_at: string; status: string };

/** The server allows 50 waiting reminders per person and trip. */
export const REMINDER_LIMIT = 50;
export const isWaiting = (row: Pick<ExistingReminder, "status">) => row.status === "PENDING" || row.status === "PROCESSING";

/**
 * Switches on the settings page: activities 30 minutes before, packing one day before departure.
 * Only reminders at exactly that time belong to a switch; other hand-made ones are never touched.
 */
export function tripReminderPlan(kind: TripReminderKind, plan: Plan, startAt: string, existing: ExistingReminder[], now = Date.now()) {
  const targets = reminderSources(plan, now).filter(item => item.type === kind).flatMap(item => {
    const at = kind === "ACTIVITY" ? Date.parse(item.at) - 30 * 60_000 : Date.parse(startAt) - 86_400_000;
    return at > now + 60_000 && at <= Date.parse(item.at) ? [{ source_type: kind, source_id: item.id, remind_at: new Date(at).toISOString() }] : [];
  });
  const matches = (row: ExistingReminder, target: (typeof targets)[number]) => isWaiting(row) && row.source_type === kind
    && row.source_id === target.source_id && Date.parse(row.remind_at) === Date.parse(target.remind_at);
  return {
    available: targets.length > 0,
    missing: targets.filter(target => !existing.some(row => matches(row, target))),
    active: existing.filter(row => targets.some(target => matches(row, target))),
  };
}
