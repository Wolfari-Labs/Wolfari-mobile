import assert from "node:assert/strict";
import test from "node:test";
import {
  createOrderSession,
  moveItem,
  replaceDayOrder,
} from "../src/features/trips/order-session.ts";
import { createTripsApi } from "../src/features/trips/api/trips.api.ts";
import { sortedActivities } from "../src/features/trips/utils.ts";
import { createApiClient } from "../src/shared/api/api-client.ts";

const plan = (version = 1, edit = true) => ({
  plan_version: version,
  activities: [
    { id: "a", position: 0, starts_at: "2026-11-12T03:00:00Z" },
    { id: "other-day", position: 1, starts_at: "2026-11-13T00:00:00Z" },
    { id: "b", position: 2, starts_at: "2026-11-12T01:00:00Z" },
  ],
  permissions: { can_edit: edit },
});
const failure = (status) => Object.assign(new Error("fixture"), { status });
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

test("a day reorder preserves all other slots, IDs, timestamps and server order", () => {
  const value = plan(),
    before = structuredClone(value);
  assert.deepEqual(
    replaceDayOrder(["a", "other-day", "b"], ["a", "b"], ["b", "a"]),
    ["b", "other-day", "a"],
  );
  assert.deepEqual(
    sortedActivities(value.activities).map((a) => a.id),
    ["a", "other-day", "b"],
  );
  assert.deepEqual(value, before);
  for (const ids of [["b", "b"], ["b"], ["b", "unknown"]])
    assert.throws(() => replaceDayOrder(["a", "b"], ["a", "b"], ids));
  assert.throws(() => replaceDayOrder(["a"], ["a", "b"], ["b", "a"]));
  assert.deepEqual(moveItem(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
  assert.deepEqual(moveItem(["a", "b"], 0, -1), ["a", "b"]);
});

test("the full order is sent atomically with version and Idempotency-Key", async () => {
  const requests = [];
  const api = createTripsApi(
    createApiClient({
      getBaseUrl: () => "https://gateway.test/api/v1",
      fetch: async (url, options) => {
        requests.push({ url, ...options, body: JSON.parse(options.body) });
        return Response.json({ data: { plan_version: 2 }, meta: {} });
      },
    }),
  );
  await api.reorder("trip", ["b", "other-day", "a"], 1, "key");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, "PUT");
  assert.match(requests[0].url, /\/trips\/trip\/activities\/order$/);
  assert.equal(requests[0].headers["Idempotency-Key"], "key");
  assert.deepEqual(requests[0].body, {
    expected_plan_version: 1,
    activity_ids: ["b", "other-day", "a"],
  });
});

test("concurrent collaborators: a conflict keeps the draft and blocks overwrite until explicit reload", async () => {
  let latest = plan(),
    writes = 0;
  const session = createOrderSession({
    load: async () => latest,
    newKey: () => "key",
    save: async () => {
      writes++;
      throw failure(409);
    },
  });
  await session.reload();
  session.reorder(["a", "b"], ["b", "a"]);
  latest = plan(2);
  assert.equal(await session.save(), false);
  assert.equal(session.getSnapshot().conflict, true);
  assert.deepEqual(session.getSnapshot().ids, ["b", "other-day", "a"]);
  assert.equal(await session.save(), false);
  assert.equal(writes, 1);
  await session.reload(true);
  assert.equal(session.getSnapshot().plan.plan_version, 2);
  assert.equal(session.dirty(), false);
  assert.equal(session.getSnapshot().conflict, false);
});

test("polling never replaces a dirty draft; clean views adopt collaborator changes", async () => {
  let latest = plan();
  const session = createOrderSession({
    load: async () => latest,
    newKey: () => "key",
    save: async () => {},
  });
  await session.reload();
  latest = plan(2);
  await session.reload();
  assert.equal(session.getSnapshot().plan.plan_version, 2);
  session.reorder(["a", "b"], ["b", "a"]);
  latest = plan(3);
  await session.reload();
  assert.equal(session.getSnapshot().conflict, true);
  assert.equal(session.getSnapshot().plan.plan_version, 2);
  assert.deepEqual(session.getSnapshot().ids, ["b", "other-day", "a"]);
});

test("lost response freezes the intent; retry uses the same key, payload and version", async () => {
  const writes = [];
  let keyCount = 0;
  const session = createOrderSession({
    load: async () => plan(),
    newKey: () => `key-${++keyCount}`,
    save: async (...args) => {
      writes.push(args);
      if (writes.length === 1) throw failure(503);
    },
  });
  await session.reload();
  session.reorder(["a", "b"], ["b", "a"]);
  assert.equal(await session.save(), false);
  assert.equal(session.getSnapshot().uncertain, true);
  session.reorder(["b", "a"], ["a", "b"]);
  await session.reload();
  assert.equal(await session.save(), true);
  assert.deepEqual(writes[0], writes[1]);
  assert.equal(keyCount, 1);
});

test("duplicate save and edits during an in-flight save are blocked", async () => {
  const gate = deferred();
  let writes = 0;
  const session = createOrderSession({
    load: async () => plan(),
    newKey: () => "key",
    save: async () => {
      writes++;
      await gate.promise;
    },
  });
  await session.reload();
  session.reorder(["a", "b"], ["b", "a"]);
  const first = session.save();
  assert.equal(await session.save(), false);
  session.reorder(["b", "a"], ["a", "b"]);
  assert.deepEqual(session.getSnapshot().ids, ["b", "other-day", "a"]);
  gate.resolve();
  await first;
  assert.equal(writes, 1);
  assert.equal(session.dirty(), false);
  assert.equal(await session.save(), false);
  assert.equal(writes, 1);
});

test("revocation after a lost reply does not claim the first write never committed", async () => {
  let writes = 0;
  const session = createOrderSession({
    load: async () => plan(),
    newKey: () => "key",
    save: async () => {
      writes++;
      throw failure(writes === 1 ? 503 : 403);
    },
  });
  await session.reload();
  session.reorder(["a", "b"], ["b", "a"]);
  await session.save();
  await session.save();
  assert.equal(session.getSnapshot().conflict, true);
  assert.equal(session.getSnapshot().uncertain, true);
  assert.match(session.getSnapshot().error, /có thể đã thành công/);
  assert.equal(await session.save(), false);
  await session.reload(true);
  assert.equal(session.getSnapshot().uncertain, false);
});

test("read-only and revoked editing permissions cannot write", async () => {
  let latest = plan(1, false),
    writes = 0;
  const session = createOrderSession({
    load: async () => latest,
    newKey: () => "key",
    save: async () => {
      writes++;
      throw failure(403);
    },
  });
  await session.reload();
  session.reorder(["a", "b"], ["b", "a"]);
  assert.equal(session.dirty(), false);
  assert.equal(await session.save(), false);
  latest = plan(2);
  await session.reload(true);
  session.reorder(["a", "b"], ["b", "a"]);
  latest = plan(2, false);
  await session.reload();
  assert.equal(session.getSnapshot().conflict, true);
  assert.equal(await session.save(), false);
  assert.equal(writes, 0);
  latest = plan(3);
  await session.reload(true);
  session.reorder(["a", "b"], ["b", "a"]);
  await session.save();
  assert.equal(session.getSnapshot().conflict, true);
});

test("an old polling response cannot overwrite a newer reload or a save", async () => {
  const gate = deferred();
  let calls = 0;
  const session = createOrderSession({
    load: async () => {
      calls++;
      return calls === 2 ? gate.promise : plan(calls);
    },
    newKey: () => "key",
    save: async () => {},
  });
  await session.reload();
  const old = session.reload();
  await session.reload(true);
  gate.resolve(plan(2));
  await old;
  assert.equal(session.getSnapshot().plan.plan_version, 3);
  session.dispose();
  await session.reload();
  assert.equal(calls, 3);
});
