import assert from "node:assert/strict";
import test from "node:test";
import {
  activityDay,
  activitySchedule,
  activityTimeLabel,
  calendarLabel,
  isTripDay,
  lastTripDay,
  tripPeriod,
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
  // A day without a time is "not timed yet", not an all-day event.
  assert.equal(activityTimeLabel({ starts_at: null, scheduled_date: "2026-11-02" }, trip.timezone), "Chưa định giờ");
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

test("trip date label shows the last covered day, matching web (end_at - 1 ms)", () => {
  // Web-created: exclusive end at next-day 00:00 local.
  assert.deepEqual(tripPeriod(trip), { label: "1–2 tháng 11, 2026", days: 2 });
  // Mobile-created: end at 23:59 of the last day shows the same day.
  assert.deepEqual(tripPeriod({ ...trip, end_at: "2026-11-02T16:59:00Z" }), tripPeriod(trip));
  // Never shows a day before the start.
  assert.deepEqual(tripPeriod({ ...trip, end_at: trip.start_at }), { label: "1 tháng 11, 2026", days: 1 });
});

test("trip periods retain both months or years when needed and count local calendar days across DST", () => {
  assert.deepEqual(tripPeriod({ ...trip, start_at: "2026-10-30T17:00:00Z" }), {
    label: "31 tháng 10 – 2 tháng 11, 2026", days: 3,
  });
  assert.deepEqual(tripPeriod({ ...trip, start_at: "2026-12-30T17:00:00Z", end_at: "2027-01-02T17:00:00Z" }), {
    label: "31 tháng 12, 2026 – 2 tháng 1, 2027", days: 3,
  });
  assert.deepEqual(tripPeriod({ start_at: "2026-10-31T04:00:00Z", end_at: "2026-11-02T05:00:00Z", timezone: "America/New_York" }), {
    label: "31 tháng 10 – 1 tháng 11, 2026", days: 2,
  });
});
