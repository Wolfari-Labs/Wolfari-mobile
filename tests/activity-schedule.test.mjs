import assert from "node:assert/strict";
import test from "node:test";
import {
  activityDay,
  activitySchedule,
  activityTimeLabel,
  calendarLabel,
  isTripDay,
  lastTripDay,
  tripDays,
} from "../src/features/trips/utils.ts";

const trip = {
  start_at: "2026-10-31T17:00:00Z", // 01/11 00:00 Asia/Ho_Chi_Minh
  end_at: "2026-11-02T17:00:00Z", // 03/11 00:00 local, exclusive
  timezone: "Asia/Ho_Chi_Minh",
};

test("three backend schedule modes are distinguished", () => {
  assert.equal(activitySchedule({ starts_at: null, scheduled_date: null }), "unscheduled");
  assert.equal(activitySchedule({ starts_at: null }), "unscheduled");
  assert.equal(activitySchedule({ starts_at: null, scheduled_date: "2026-11-01" }), "day");
  assert.equal(activitySchedule({ starts_at: "2026-11-01T01:00:00Z", scheduled_date: null }), "timed");
});

test("day-only activities group by their calendar string, not a UTC instant", () => {
  assert.equal(activityDay({ starts_at: null, scheduled_date: "2026-11-02" }, "Pacific/Honolulu"), "2026-11-02");
  assert.equal(activityDay({ starts_at: "2026-10-31T18:00:00Z", scheduled_date: null }, trip.timezone), "2026-11-01");
  assert.equal(activityDay({ starts_at: null, scheduled_date: null }, trip.timezone), undefined);
  assert.equal(activityTimeLabel({ starts_at: null, scheduled_date: "2026-11-02" }, trip.timezone), "Cả ngày");
  assert.equal(activityTimeLabel({ starts_at: null, scheduled_date: null }, trip.timezone), "Chưa xếp");
  assert.equal(calendarLabel("2026-11-02"), "02/11/2026");
});

test("an end at local midnight does not add a trip day", () => {
  assert.equal(lastTripDay(trip), "2026-11-02");
  assert.deepEqual(tripDays(trip), ["2026-11-01", "2026-11-02"]);
  assert.equal(isTripDay("2026-11-01", trip), true);
  assert.equal(isTripDay("2026-11-02", trip), true);
  assert.equal(isTripDay("2026-11-03", trip), false);
  assert.equal(isTripDay("2026-10-31", trip), false);
  assert.equal(isTripDay("01/11/2026", trip), false);
});
