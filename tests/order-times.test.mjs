import assert from "node:assert/strict";
import test from "node:test";
import { conflictingOrderTimes } from "../src/features/trips/model/order-times.ts";
import { activityDay } from "../src/features/trips/utils.ts";

const day = "2026-11-12";
const timed = (id, hour, date = day) => ({
  id, day: date, starts_at: `${date}T${String(hour).padStart(2, "0")}:00:00Z`,
});

test("8h before 7h clears the trailing 7h, retaining the requested order", () => {
  const activities = [timed("seven", 7), timed("eight", 8), timed("nine", 9)];
  const before = structuredClone(activities);
  assert.deepEqual(conflictingOrderTimes(activities, ["eight", "seven", "nine"]), ["seven"]);
  assert.deepEqual(activities, before);
});

test("undoing a draft restores all times; no-op and already chronological orders retain times", () => {
  const activities = [timed("eight", 8), timed("seven", 7), timed("nine", 9)];
  assert.deepEqual(conflictingOrderTimes(activities, ["eight", "seven", "nine"]), []);
  assert.deepEqual(conflictingOrderTimes(activities, ["seven", "eight", "nine"]), []);
});

test("day-only gaps do not hide backwards times and equal starts are retained", () => {
  const activities = [timed("seven", 7), { id: "day", day, starts_at: null }, timed("eight", 8), timed("equal", 8)];
  assert.deepEqual(conflictingOrderTimes(activities, ["eight", "day", "seven", "equal"]), ["seven"]);
});

test("other days and unscheduled activities retain times despite global slot changes", () => {
  const activities = [timed("a", 7), timed("x", 9, "2026-11-13"), timed("b", 8), timed("y", 7, "2026-11-13"), { id: "draft", day: null, starts_at: null }];
  assert.deepEqual(conflictingOrderTimes(activities, ["b", "x", "draft", "a", "y"]), ["a"]);
  assert.deepEqual(conflictingOrderTimes(activities, ["x", "a", "y", "b", "draft"]), []);
});

test("reversing several times only keeps nondecreasing starts on each changed day", () => {
  const activities = [timed("a", 7), timed("b", 8), timed("c", 9), timed("d", 10)];
  assert.deepEqual(conflictingOrderTimes(activities, ["c", "b", "a", "d"]), ["b", "a"]);
  assert.deepEqual(conflictingOrderTimes([], []), []);
});

test("Trip-local days and overnight starts use instants rather than UTC dates or end times", () => {
  const zone = "Asia/Ho_Chi_Minh";
  const activities = [
    { id: "early", starts_at: "2026-11-11T23:00:00Z", ends_at: "2026-11-12T00:30:00Z" },
    { id: "late", starts_at: "2026-11-12T01:00:00Z", ends_at: "2026-11-12T19:00:00Z" },
    { id: "next", starts_at: "2026-11-12T18:00:00Z", ends_at: "2026-11-12T20:00:00Z" },
  ].map(item => ({ ...item, day: activityDay(item, zone) }));
  assert.deepEqual(activities.map(item => item.day), [day, day, "2026-11-13"]);
  assert.deepEqual(conflictingOrderTimes(activities, ["late", "early", "next"]), ["early"]);
});

test("offsets, Date values and DST compare actual instants", () => {
  const activities = [
    { id: "first", day: "2026-11-01", starts_at: "2026-11-01T01:30:00-04:00" },
    { id: "second", day: "2026-11-01", starts_at: new Date("2026-11-01T01:30:00-05:00") },
  ];
  assert.deepEqual(conflictingOrderTimes(activities, ["second", "first"]), ["first"]);
});
