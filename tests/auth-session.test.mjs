import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuthSession } from "../src/features/auth/session/auth-session.ts";
import { validateRegistration } from "../src/features/auth/validation.ts";

const result = (refreshToken = "refresh-one", accessToken = "access-one") => ({
  access_token: accessToken, refresh_token: refreshToken, token_type: "Bearer", expires_in: 900,
  profile: { id: "user-one", email: "demo@example.test", full_name: "Demo" },
});

function storage(initial = null) {
  let value = initial;
  return {
    get: async () => value,
    set: async (next) => { value = next; },
    clear: async () => { value = null; },
  };
}

test("startup without a refresh token stays in guest mode", async () => {
  let refreshed = false;
  const session = createAuthSession({ storage: storage(), login: async () => result(), refresh: async () => { refreshed = true; return result(); } });
  await session.restore();
  assert.equal(session.getSnapshot().status, "guest");
  assert.equal(refreshed, false);
});

test("simultaneous expired-token requests rotate exactly once", async () => {
  const saved = storage();
  let clock = 0;
  let rotations = 0;
  const session = createAuthSession({
    storage: saved, now: () => clock, login: async () => result(),
    refresh: async (token) => { rotations++; assert.equal(token, "refresh-one"); return result("refresh-two", "access-two"); },
  });
  await session.signIn({ email: "demo@example.test", password: "test" });
  clock = 901_000;
  assert.deepEqual(await Promise.all([session.getAccessToken(), session.getAccessToken(), session.getAccessToken()]), ["access-two", "access-two", "access-two"]);
  assert.equal(rotations, 1);
  assert.equal(await saved.get(), "refresh-two");
});

test("an offline startup preserves the saved refresh token for another attempt", async () => {
  const saved = storage("refresh-one");
  let offline = true;
  const session = createAuthSession({
    storage: saved, login: async () => result(),
    refresh: async () => { if (offline) throw new Error("offline"); return result("refresh-two"); },
  });
  await session.restore();
  assert.equal(session.getSnapshot().status, "unavailable");
  assert.equal(await saved.get(), "refresh-one");
  offline = false;
  await session.restore();
  assert.equal(session.getSnapshot().status, "authenticated");
});

test("revoked refresh tokens are cleared instead of retried", async () => {
  const saved = storage("revoked");
  const session = createAuthSession({
    storage: saved, login: async () => result(),
    refresh: async () => { throw Object.assign(new Error("revoked"), { status: 401 }); },
  });
  await session.restore();
  assert.equal(session.getSnapshot().status, "guest");
  assert.equal(await saved.get(), null);
});

test("a late refresh cannot restore a session after local cleanup", async () => {
  const saved = storage();
  let finish;
  const session = createAuthSession({
    storage: saved, login: async () => result(),
    refresh: () => new Promise((resolve) => { finish = resolve; }),
  });
  await session.signIn({ email: "demo@example.test", password: "test" });
  const pending = session.refreshAccessToken();
  await Promise.resolve();
  await session.clearLocalSession();
  finish(result("late-refresh"));
  await assert.rejects(pending);
  assert.equal(session.getSnapshot().status, "guest");
  assert.equal(await saved.get(), null);
});

test("signup enforces the backend Unicode password length and confirmation", () => {
  assert.equal(validateRegistration("Demo", "demo@example.test", "short", "short").password, "Mật khẩu phải có từ 15 đến 128 ký tự.");
  const password = "🙂".repeat(15);
  assert.deepEqual(validateRegistration(" Demo ", "demo@example.test", password, password), {});
  assert.ok(validateRegistration("Demo", "demo@example.test", password, "different").confirm_password);
});
