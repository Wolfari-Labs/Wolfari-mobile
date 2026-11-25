import assert from "node:assert/strict";
import test from "node:test";
import { planCalendar, planText } from "../src/features/trips/model/share-plan.ts";
import { tripReminderPlan } from "../src/features/trips/model/trip-reminder-plan.ts";

const now = Date.parse("2026-12-01T00:00:00Z");
const trip = { id: "t", name: "Đà Nẵng, 3N2Đ", start_at: "2026-12-09T17:00:00Z", end_at: "2026-12-12T17:00:00Z", timezone: "Asia/Ho_Chi_Minh" };
const activity = { id: "a", title: "Ăn tối; hải sản", description: "ghi chú riêng", starts_at: "2026-12-10T12:00:00Z", ends_at: null, selected_location_id: "l", position: 0, status: "TODO" };
const plan = {
  activities: [activity, { ...activity, id: "b", title: "Tắm biển", starts_at: null, scheduled_date: "2026-12-31", selected_location_id: null, position: 1 }, { ...activity, id: "c", title: "Dự phòng", starts_at: null, position: 2 }],
  selected_locations: [{ id: "l", name: "Bé Mặn", address: null }],
  packing_items: [{ id: "p", name: "Áo", due_at: "2026-12-09T10:00:00Z", status: "TODO" }, { id: "q", name: "Vé", due_at: "2026-12-05T10:00:00Z", status: "TODO" }],
};
test("shared text groups days and leaves private notes out", () => {
  const text = planText(trip, plan);
  assert.match(text, /10\/12\/2026\n• 19:00 Ăn tối; hải sản · Bé Mặn/);
  assert.match(text, /Chưa xếp ngày\n• Dự phòng/);
  assert.doesNotMatch(text, /ghi chú riêng/);
});
test("calendar escapes text, folds long lines and skips unscheduled activities", () => {
  const ics = planCalendar({ ...trip, name: "Đ".repeat(90) }, plan, now);
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 2);
  assert.match(ics, /SUMMARY:Ăn tối\\; hải sản/);
  assert.match(ics, /DTSTART:20261210T120000Z\r\nDTEND:20261210T130000Z/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101/);
  for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
  assert.equal(planCalendar(trip, { ...plan, activities: [plan.activities[2]] }, now), undefined);
});
test("reminder switches only own reminders at their exact time", () => {
  const mine = { id: "r", source_type: "ACTIVITY", source_id: "a", remind_at: "2026-12-10T11:30:00Z", status: "PENDING" };
  const custom = { ...mine, id: "x", remind_at: "2026-12-10T11:00:00Z" };
  assert.equal(tripReminderPlan("ACTIVITY", plan, trip.start_at, [custom], now).missing.length, 1);
  const on = tripReminderPlan("ACTIVITY", plan, trip.start_at, [custom, mine], now);
  assert.deepEqual([on.missing.length, on.active.map(row => row.id)], [0, ["r"]]);
  assert.equal(tripReminderPlan("ACTIVITY", plan, trip.start_at, [{ ...mine, status: "CANCELLED" }], now).missing.length, 1);
  assert.deepEqual(tripReminderPlan("PACKING", plan, trip.start_at, [], now).missing, [{ source_type: "PACKING", source_id: "p", remind_at: "2026-12-08T17:00:00.000Z" }]);
});
