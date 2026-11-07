import test from "node:test";
import assert from "node:assert/strict";
import { createNotificationsApi } from "../src/features/notifications/api.ts";
import { userNamer, memberName } from "../src/features/trips/model/member-name.ts";

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

test("member names prefer display_name and fall back to a short tag", () => {
  const members = [{ user_id: "a2b68654-f84d-417f-912b-fb26dadd05db", display_name: "Lan" }, { user_id: "ffff0000-0000-0000-0000-000000000000", display_name: null }];
  const who = userNamer(members, "self");
  assert.equal(who("self"), "Bạn");
  assert.equal(who(members[0].user_id), "Lan");
  assert.equal(who(members[1].user_id), "Bạn đồng hành #FFFF");
  assert.equal(memberName({ user_id: "abcd1234", display_name: "  " }), "Bạn đồng hành #ABCD");
});
