import type { Activity } from "../types";
import { activityDay, dateKey } from "../utils.ts";

/** A staged schedule change made in the itinerary editor, saved with the order. */
export type ScheduleDraft =
  | { kind: "timed"; starts_at: string; ends_at: string }
  | { kind: "day"; date: string }
  | { kind: "unscheduled" };

export const UNSCHEDULED = "unscheduled";

/** The activity as the group will see it once the draft is saved. */
export function withDraft(activity: Activity, draft?: ScheduleDraft): Activity {
  if (!draft) return activity;
  if (draft.kind === "timed")
    return { ...activity, starts_at: draft.starts_at, ends_at: draft.ends_at, scheduled_date: null };
  if (draft.kind === "day")
    return { ...activity, starts_at: null, ends_at: null, scheduled_date: draft.date };
  return { ...activity, starts_at: null, ends_at: null, scheduled_date: null };
}

/** Trip-local day key, or "unscheduled". */
export function scheduleDay(activity: Activity, timezone: string): string {
  return activityDay(activity, timezone) ?? UNSCHEDULED;
}

/** True when the draft would leave the stored schedule unchanged. */
export function sameSchedule(activity: Activity, draft: ScheduleDraft): boolean {
  if (draft.kind === "timed")
    return (
      !!activity.starts_at &&
      !!activity.ends_at &&
      Date.parse(activity.starts_at) === Date.parse(draft.starts_at) &&
      Date.parse(activity.ends_at) === Date.parse(draft.ends_at)
    );
  if (draft.kind === "day") return !activity.starts_at && activity.scheduled_date === draft.date;
  return !activity.starts_at && !activity.scheduled_date;
}

/** A timed draft that has to lose its time keeps only its Trip-local day. */
export function withoutTime(draft: ScheduleDraft, timezone: string): ScheduleDraft {
  return draft.kind === "timed" ? { kind: "day", date: dateKey(draft.starts_at, timezone) } : draft;
}

/**
 * PATCH body for a schedule change. Timed writes omit scheduled_date (the server clears
 * it with the timestamp pair); day-only and unscheduled send the pair as null.
 */
export function scheduleInput(activity: Activity, draft: ScheduleDraft, version: number) {
  const base = {
    title: activity.title,
    activity_type: activity.activity_type,
    description: activity.description,
    public_description: activity.public_description,
    selected_location_id: activity.selected_location_id,
    position: activity.position,
    expected_plan_version: version,
  };
  if (draft.kind === "timed") return { ...base, starts_at: draft.starts_at, ends_at: draft.ends_at };
  return {
    ...base,
    starts_at: null,
    ends_at: null,
    scheduled_date: draft.kind === "day" ? draft.date : null,
  };
}

/**
 * New order for one day after `movedId` lands there: a timed activity goes to its
 * chronological slot (or stays put when nothing else that day has a time), anything else
 * goes to the end. `dayItems` is the day in current order,
 * already showing drafts and including the moved activity.
 */
export function placeInDay(dayItems: readonly Activity[], movedId: string): string[] {
  const moved = dayItems.find((item) => item.id === movedId);
  const rest = dayItems.filter((item) => item.id !== movedId);
  const next = rest.map((item) => item.id);
  if (!moved) return dayItems.map((item) => item.id);
  let index = rest.length;
  if (moved.starts_at) {
    const at = Date.parse(moved.starts_at);
    const later = rest.findIndex((item) => !!item.starts_at && Date.parse(item.starts_at) > at);
    if (later >= 0) index = later;
    else {
      const lastTimed = rest.map((item) => !!item.starts_at).lastIndexOf(true);
      index = lastTimed >= 0 ? lastTimed + 1 : dayItems.indexOf(moved);
    }
  }
  next.splice(index, 0, movedId);
  return next;
}
