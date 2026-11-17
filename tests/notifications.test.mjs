import test from "node:test";
import assert from "node:assert/strict";
import { createNotificationsApi } from "../src/features/notifications/api.ts";
import { userNamer, memberName } from "../src/features/trips/model/member-name.ts";
import { markAllNotificationsRead } from "../src/features/notifications/inbox.ts";
import { createDeviceQueue } from "../src/features/notifications/device-queue.ts";

test("notifications list reads next_cursor from meta and mark-read sends no body", async () => {
  const calls = [];
  const client = {
    requestWithMeta: async (path, options) => { calls.push({ path, options }); return { data: [{ id: "n1", read_at: null }], meta: { next_cursor: "c2" } }; },
    request: async (path, options) => { calls.push({ path, options }); return { id: "n1" }; },
  };
  const api = createNotificationsApi(client);
  const page = await api.list({ unread: true, limit: 1 });
  assert.equal(page.next_cursor, "c2");
  assert.equal(calls[0].path, "/me/notifications?limit=1&unread=true");
  await api.markRead("n1");
  assert.deepEqual(calls[1], { path: "/me/notifications/n1/read", options: { method: "PATCH" } });
});

test("member names prefer display_name and never fall back to internal identifiers", () => {
  const members = [{ user_id: "a2b68654-f84d-417f-912b-fb26dadd05db", display_name: "Lan" }, { user_id: "ffff0000-0000-0000-0000-000000000000", display_name: null }];
  const who = userNamer(members, "self");
  assert.equal(who("self"), "Bạn");
  assert.equal(who(members[0].user_id), "Lan");
  assert.equal(who(members[1].user_id), "Bạn đồng hành");
  assert.equal(memberName({ user_id: "abcd1234", display_name: "  " }), "Bạn đồng hành");
});

test("mark all traverses unread keyset pages and bounds concurrent writes", async () => {
  const calls = [], read = [], rows = Array.from({ length: 235 }, (_, i) => ({ id: String(i), read_at: null }));
  let active = 0, max = 0;
  await markAllNotificationsRead({
    list: async ({ cursor, unread }) => {
      assert.equal(unread, true); calls.push(cursor);
      const start = cursor ? Number(cursor) : 0;
      return { items: rows.slice(start, start + 100), next_cursor: start + 100 < rows.length ? String(start + 100) : null };
    },
    markRead: async id => { max = Math.max(max, ++active); await new Promise(resolve => setTimeout(resolve, 1)); read.push(id); active--; },
  });
  assert.deepEqual(calls, [null, "100", "200"]);
  assert.equal(new Set(read).size, 235); assert.ok(max <= 4);
});
test("read all stops on errors or a cancelled account without claiming completion", async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(markAllNotificationsRead({ list: () => { throw Error("must not fetch"); } }, controller.signal), /abort/i);
  await assert.rejects(markAllNotificationsRead({ list: async () => ({ items: [{ id: "a" }], next_cursor: "next" }), markRead: async () => { throw Error("offline"); } }), /offline/);
});
test("account registration and logout stay serialized even after a failed request", async () => {
  const enqueue = createDeviceQueue(), events = [];
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const old = enqueue(async () => { events.push("old start"); await wait; events.push("old done"); throw Error("offline"); }).catch(() => {});
  const remove = enqueue(async () => { events.push("unregister"); });
  const next = enqueue(async () => { events.push("new account"); });
  release(); await Promise.all([old, remove, next]);
  assert.deepEqual(events, ["old start", "old done", "unregister", "new account"]);
});
