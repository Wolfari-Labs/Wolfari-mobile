import assert from "node:assert/strict";
import test from "node:test";
import {
  placeInDay,
  sameSchedule,
  scheduleDay,
  scheduleInput,
  withDraft,
  withoutTime,
} from "../src/features/trips/model/schedule-draft.ts";

const tz = "Asia/Ho_Chi_Minh";
const activity = (id, starts_at = null, scheduled_date = null) => ({
  id, trip_id: "t", title: id, description: null, public_description: null, activity_type: "OTHER",
  selected_location_id: null, starts_at, ends_at: starts_at && new Date(Date.parse(starts_at) + 3600000).toISOString(),
  scheduled_date, position: 0, status: "TODO", source: "MANUAL", plan_version: 1,
});

test("drafts show the schedule the group will see and find its day", () => {
  const base = activity("a", "2026-11-12T01:00:00.000Z");
  assert.equal(scheduleDay(base, tz), "2026-11-12");
  assert.equal(scheduleDay(withDraft(base, { kind: "day", date: "2026-11-13" }), tz), "2026-11-13");
  assert.equal(scheduleDay(withDraft(base, { kind: "unscheduled" }), tz), "unscheduled");
  assert.equal(withDraft(base, { kind: "day", date: "2026-11-13" }).starts_at, null);
});

test("schedule PATCH bodies follow the server rules for each kind", () => {
  const base = activity("a", "2026-11-12T01:00:00.000Z");
  const timed = scheduleInput(base, { kind: "timed", starts_at: "2026-11-12T02:00:00.000Z", ends_at: "2026-11-12T03:00:00.000Z" }, 7);
  assert.equal("scheduled_date" in timed, false, "timed writes let the server clear the date");
  assert.equal(timed.expected_plan_version, 7);
  assert.deepEqual(
    [scheduleInput(base, { kind: "day", date: "2026-11-13" }, 1)].map((b) => [b.starts_at, b.ends_at, b.scheduled_date]),
    [[null, null, "2026-11-13"]],
  );
  const loose = scheduleInput(base, { kind: "unscheduled" }, 1);
  assert.deepEqual([loose.starts_at, loose.ends_at, loose.scheduled_date], [null, null, null]);
});

test("unchanged drafts are recognised and timed drafts can fall back to their day", () => {
  const base = activity("a", "2026-11-12T01:00:00.000Z");
  assert.ok(sameSchedule(base, { kind: "timed", starts_at: base.starts_at, ends_at: base.ends_at }));
  assert.ok(!sameSchedule(base, { kind: "day", date: "2026-11-12" }));
  assert.ok(sameSchedule(activity("b", null, "2026-11-12"), { kind: "day", date: "2026-11-12" }));
  assert.ok(sameSchedule(activity("c"), { kind: "unscheduled" }));
  assert.deepEqual(withoutTime({ kind: "timed", starts_at: "2026-11-12T20:00:00.000Z", ends_at: "2026-11-12T21:00:00.000Z" }, tz), { kind: "day", date: "2026-11-13" });
});

test("placement: timed goes to its slot, untimed to the end, lone timed stays put", () => {
  const day = [
    activity("a", "2026-11-12T01:00:00.000Z"),
    activity("x", "2026-11-12T00:00:00.000Z"),
    activity("b", "2026-11-12T03:00:00.000Z"),
    activity("all", null, "2026-11-12"),
  ];
  assert.deepEqual(placeInDay(day, "x"), ["x", "a", "b", "all"]);
  assert.deepEqual(placeInDay([activity("all", null, "2026-11-12"), activity("a", "2026-11-12T01:00:00.000Z")], "all"), ["a", "all"]);
  assert.deepEqual(placeInDay([activity("p", null, "2026-11-12"), activity("t", "2026-11-12T05:00:00.000Z"), activity("q", null, "2026-11-12")], "t"), ["p", "t", "q"]);
});
