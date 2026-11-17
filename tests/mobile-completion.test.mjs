import assert from "node:assert/strict";
import test from "node:test";
import { reminderSources, reminderInput, defaultReminderTime } from "../src/features/trips/model/reminders.ts";
import { privateFileName } from "../src/shared/files/private-file-model.ts";
import { notificationDestination } from "../src/features/notifications/destination.ts";
import { createNotificationsApi } from "../src/features/notifications/api.ts";
import { createOperationController, operationCommitted } from "../src/shared/operations/controller.ts";

const now = Date.parse("2026-12-01T00:00:00Z"), zone = "Asia/Ho_Chi_Minh";
const activity = { id: "a", title: "Ăn sáng", starts_at: "2026-12-02T02:00:00Z", status: "TODO" };
const packing = { id: "p", name: "Áo", due_at: "2026-12-01T16:59:00Z", status: "TODO" };
test("reminders use actual future sources and the Trip timezone, excluding completed/unscheduled sources", () => {
  const sources = reminderSources({ activities: [activity, { ...activity, id: "done", status: "COMPLETED" }, { ...activity, id: "none", starts_at: null }], packing_items: [packing] }, now);
  assert.deepEqual(sources.map(s => s.id), ["p", "a"]);
  const source = sources[1], defaults = defaultReminderTime(source, zone, now);
  assert.deepEqual(defaults, { date: "02/12/2026", time: "08:30" });
  assert.deepEqual(reminderInput(source, defaults.date, defaults.time, zone, now), { source_type: "ACTIVITY", source_id: "a", remind_at: "2026-12-02T01:30:00.000Z" });
  assert.throws(() => reminderInput(source, "31/11/2026", "08:30", zone, now));
  assert.throws(() => reminderInput(source, "01/12/2026", "06:00", zone, now));
  assert.throws(() => reminderInput(source, "02/12/2026", "09:01", zone, now));
});
test("notification taps only navigate to recognized app routes and valid Trip IDs", () => {
  const trip_id = "10000000-0000-4000-8000-000000000001";
  assert.deepEqual(notificationDestination({ type: "PACKING_REMINDER", trip_id }), { screen: "packing", tripId: trip_id });
  assert.equal(notificationDestination({ type: "ACTIVITY_REMINDER", trip_id }).screen, "itinerary");
  assert.equal(notificationDestination({ type: "CONTRIBUTION_REQUESTED", trip_id }).screen, "fund");
  assert.equal(notificationDestination({ type: "PACKING_REMINDER", trip_id: "../profile" }).screen, "notifications");
  assert.equal(notificationDestination({ url: "https://untrusted.invalid" }).screen, "notifications");
});
test("private downloads restrict types, size and generated filenames", () => {
  assert.equal(privateFileName(new Blob(["%PDF-1.7"], { type: "application/pdf" }), "../../trip.pdf"), "------trip.pdf");
  assert.throws(() => privateFileName(new Blob(["<html>"], { type: "text/html" }), "receipt"));
  assert.throws(() => privateFileName(new Blob([], { type: "image/png" }), "receipt"));
  assert.throws(() => privateFileName({ type: "application/pdf", size: 10 * 1024 * 1024 + 1 }, "receipt"));
});
test("personal reminder APIs use Self-authenticated Gateway requests with idempotent creation", async () => {
  const calls = [], api = createNotificationsApi({ request: async (path, options) => { calls.push({ path, ...options }); return {}; } });
  await api.reminders("trip");
  assert.equal(calls.at(-1).path, "/trips/trip/reminders");
  await api.createReminder("trip", { source_type: "ACTIVITY", source_id: "a", remind_at: "time" }, "key");
  assert.equal(calls.at(-1).headers["Idempotency-Key"], "key");
  await api.cancelReminder("trip", "reminder");
  assert.equal(calls.at(-1).method, "DELETE");
  assert.equal(calls.at(-1).body, undefined);
});

test("a deletion committed before a lost reply remains recoverable after restarting mobile", async () => {
  const tripId = "10000000-0000-4000-8000-000000000001", key = "10000000-0000-4000-8000-000000000002";
  const stored = new Map();
  const storage = { getItem: async name => stored.get(name) ?? null, setItem: async (name, value) => stored.set(name, value), removeItem: async name => stored.delete(name) };
  let committed = false, writes = 0;
  const deps = { tripId, storageKey: "receipt", storage, uuid: () => key, message: error => error.message,
    execute: async () => { writes++; committed = true; throw Error("Lost response"); },
    poll: async () => { assert.equal(committed, true); return { operation_id: key, trip_id: tripId, state: "SUCCEEDED", outcome: { status: "COMMITTED" } }; } };
  const first = createOperationController(deps);
  await first.load();
  await first.run({ kind: "trip", title: "Xóa chuyến đi", targetId: "DELETE", method: "DELETE", path: `/trips/${tripId}`, body: { reason: "private reason" } });
  assert.equal(first.getSnapshot().pending.key, key);
  assert.ok(!stored.get("receipt").includes("private reason"));
  const restarted = createOperationController(deps);
  await restarted.load();
  assert.equal(restarted.getSnapshot().pending.kind, "trip");
  assert.equal(restarted.getSnapshot().pending.command, undefined);
  await restarted.check();
  assert.equal(operationCommitted(restarted.getSnapshot().pending), true);
  assert.equal(writes, 1);
  assert.equal(await restarted.acknowledge(), true);
});
