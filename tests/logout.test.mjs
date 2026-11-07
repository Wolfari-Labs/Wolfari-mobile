import assert from "node:assert/strict";
import test from "node:test";
import { createAuthSession } from "../src/features/auth/session/auth-session.ts";

const firstId = "10000000-0000-4000-8000-000000000001";
const rotatedId = "10000000-0000-4000-8000-000000000002";
const tokens = (id = firstId) => ({ session_id: id, access_token: `access-${id}`, refresh_token: `refresh-${id}`, token_type: "Bearer", expires_in: 900, profile: { id: "user" } });
function setup(logout, refresh = async () => tokens(rotatedId)) {
  let saved = null, clock = 0;
  const session = createAuthSession({ storage: { get: async () => saved, set: async value => { saved = value; }, clear: async () => { saved = null; } }, login: async () => tokens(), refresh, logout, now: () => clock });
  return { session, saved: () => saved, expire: () => { clock = 901_000; } };
}
test("logout revokes the actual rotated row once and clears local storage", async () => {
  const calls = [];
  const s = setup(async (...args) => { calls.push(args); });
  await s.session.signIn({ email: "demo@example.test", password: "Wolfari1" });
  s.expire();
  await Promise.all([s.session.signOut(), s.session.signOut()]);
  assert.deepEqual(calls, [[`access-${rotatedId}`, rotatedId]]);
  assert.equal(s.saved(), null);
  assert.equal(s.session.getSnapshot().status, "guest");
});
test("network failure preserves credentials; a retry seeing revoked 401 clears them", async () => {
  let count = 0;
  const s = setup(async () => { if (++count === 1) throw new Error("lost reply"); throw Object.assign(new Error("revoked"), { status: 401 }); });
  await s.session.signIn({ email: "demo@example.test", password: "Wolfari1" });
  await assert.rejects(s.session.signOut(), /lost reply/);
  assert.equal(s.session.getSnapshot().status, "authenticated");
  assert.ok(s.saved());
  await s.session.signOut();
  assert.equal(s.session.getSnapshot().status, "guest");
  assert.equal(s.saved(), null);
});
test("logout waits for an existing refresh and uses its returned session ID", async () => {
  let complete;
  const calls = [];
  const s = setup(async (...args) => { calls.push(args); }, () => new Promise(resolve => { complete = resolve; }));
  await s.session.signIn({ email: "demo@example.test", password: "Wolfari1" });
  const refresh = s.session.refreshAccessToken();
  await Promise.resolve();
  const logout = s.session.signOut();
  complete(tokens(rotatedId));
  await Promise.all([refresh, logout]);
  assert.deepEqual(calls, [[`access-${rotatedId}`, rotatedId]]);
});
test("a late logout cannot clear a newer login", async () => {
  let complete;
  const s = setup(() => new Promise(resolve => { complete = resolve; }));
  await s.session.signIn({ email: "demo@example.test", password: "Wolfari1" });
  const logout = s.session.signOut();
  await s.session.signIn({ email: "second@example.test", password: "Wolfari1" });
  complete();
  await logout;
  assert.equal(s.session.getSnapshot().status, "authenticated");
  assert.ok(s.saved());
});
test("missing session ID never guesses from JWT or claims remote logout", async () => {
  let called = false;
  const s = setup(async () => { called = true; }, async () => ({ ...tokens(), session_id: undefined }));
  await s.session.signIn({ email: "demo@example.test", password: "Wolfari1" });
  await s.session.refreshAccessToken();
  await assert.rejects(s.session.signOut(), /Thiếu mã phiên/);
  assert.equal(called, false);
  assert.equal(s.session.getSnapshot().status, "authenticated");
});
