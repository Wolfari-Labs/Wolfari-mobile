import test from "node:test";
import assert from "node:assert/strict";
import { createTripRequest } from "../src/features/trips/model/create-trip-request.ts";
import { ApiError } from "../src/shared/api/api-client.ts";

const key = "10000000-0000-4000-8000-000000000001", tripId = "20000000-0000-4000-8000-000000000001";
const input = { name: "Đà Nẵng", start_at: "2027-01-01T00:00:00Z", end_at: "2027-01-02T00:00:00Z", timezone: "Asia/Ho_Chi_Minh" };
function storage() {
  const rows = new Map();
  return { rows, get: async key => rows.get(key) ?? null, set: async (key, value) => { rows.set(key, value); }, remove: async key => { rows.delete(key); } };
}
test("a committed create with a lost response replays the exact request after restart", async () => {
  const disk = storage(), commits = new Map();
  let lose = true;
  const execute = async (body, id) => {
    assert.equal(disk.rows.size, 1, "request must be durable before network IO");
    assert.deepEqual(body, input);
    if (!commits.has(id)) commits.set(id, { id: tripId });
    if (lose) { lose = false; throw new ApiError("NETWORK_ERROR", "lost"); }
    return commits.get(id);
  };
  const first = createTripRequest(disk, "account-one", () => key, execute);
  await first.load();
  await first.start(input);
  const restarted = createTripRequest(disk, "account-one", () => { throw Error("must reuse key"); }, execute);
  await restarted.load();
  assert.equal(await restarted.start({ ...input, name: "Different" }), undefined);
  assert.equal(await restarted.retry(), tripId);
  assert.equal(commits.size, 1);
  assert.equal(await restarted.acknowledge(), true);
  assert.equal(disk.rows.size, 0);
});
test("a storage failure prevents creation; an unreadable journal blocks new requests", async () => {
  const disk = storage(); let calls = 0;
  const request = createTripRequest({ ...disk, set: async () => { throw Error("disk full"); } }, "a", () => key, async () => { calls++; return { id: tripId }; });
  await request.load(); await request.start(input);
  assert.equal(calls, 0);
  disk.rows.set("a", "broken");
  const reload = createTripRequest(disk, "a", () => key, async () => { calls++; return { id: tripId }; });
  await reload.load(); await reload.start(input);
  assert.equal(reload.getSnapshot().ready, false);
  assert.equal(calls, 0);
});
test("a replay denial preserves uncertainty and one account cannot see another request", async () => {
  const disk = storage();
  const first = createTripRequest(disk, "a", () => key, async () => { throw new ApiError("NETWORK_ERROR", "lost"); });
  await first.load(); await first.start(input);
  const replay = createTripRequest(disk, "a", () => key, async () => { throw new ApiError("RESOURCE_NOT_FOUND", "gone", 404); });
  await replay.load(); await replay.retry();
  assert.ok(replay.getSnapshot().pending);
  assert.equal(await replay.acknowledge(), false);
  const another = createTripRequest(disk, "b", () => key, async () => ({ id: tripId }));
  await another.load();
  assert.equal(another.getSnapshot().pending, undefined);
});
test("success survives restart and duplicate taps never submit twice", async () => {
  const disk = storage(); let release, calls = 0;
  const wait = new Promise(resolve => { release = resolve; });
  const request = createTripRequest(disk, "a", () => key, async () => { calls++; await wait; return { id: tripId }; });
  await request.load();
  const first = request.start(input);
  await request.start(input); release(); await first;
  assert.equal(calls, 1);
  const restarted = createTripRequest(disk, "a", () => key, async () => { throw Error("already created"); });
  await restarted.load(); assert.equal(await restarted.retry(), tripId);
});
