import assert from "node:assert/strict";
import test from "node:test";
import { createApiClient, ApiError } from "../src/shared/api/api-client.ts";
import { createAccountApi } from "../src/features/auth/api/account.api.ts";
import { accountToken, passwordError } from "../src/features/auth/account-validation.ts";
import { createTripsApi } from "../src/features/trips/api/trips.api.ts";
import { membershipCommitted, membershipPending, membershipMessage } from "../src/features/trips/membership-operation.ts";

test("account links are parsed locally and password rules count Unicode code points", () => {
  const token = "a".repeat(43);
  assert.equal(accountToken(token), token);
  assert.equal(accountToken(`https://gateway.test/api/v1/auth/local/reset?token=${token}`), token);
  assert.equal(accountToken(`wolfarimobile://verify-email#token=${token}`), token);
  for (const invalid of ["", "bad", "http://a.test?token=", "https://a.test/no-token", "a".repeat(201)]) assert.equal(accountToken(invalid), undefined);
  assert.equal(passwordError("😀".repeat(15), "😀".repeat(15)), undefined);
  assert.ok(passwordError("😀".repeat(14), "😀".repeat(14)));
  assert.ok(passwordError("a".repeat(129), "a".repeat(129)));
  assert.ok(passwordError("a".repeat(15), "b".repeat(15)));
});

test("account APIs match the strict Identity DTOs and do not retry a wrong current password as expired auth", async () => {
  const calls = [];
  const api = createAccountApi({ request: async (path, options) => { calls.push({ path, ...options }); return {}; } });
  await api.requestReset("  DEMO@EXAMPLE.TEST ");
  assert.deepEqual(calls.at(-1).body, { email: "demo@example.test" });
  await api.resetPassword("token", "new-password");
  assert.equal(calls.at(-1).path, "/auth/password-resets");
  assert.deepEqual(calls.at(-1).body, { token: "token", new_password: "new-password" });
  await api.confirmEmail("token");
  assert.deepEqual(calls.at(-1).body, { token: "token" });
  await api.resendVerification();
  assert.deepEqual(calls.at(-1).body, {});
  await api.changePassword("old", "new");
  assert.deepEqual(calls.at(-1).body, { current_password: "old", new_password: "new" });
  assert.equal(calls.at(-1).retryAuth, false);
  await api.updateAvatar("users/user/avatars/one.png", 9);
  assert.deepEqual(calls.at(-1).body, { avatar_object_key: "users/user/avatars/one.png", expected_version: 9 });
  await api.updateAvatar(null, 10);
  assert.deepEqual(calls.at(-1).body, { avatar_object_key: null, expected_version: 10 });
});

test("avatar upload preserves FormData boundary, and authenticated binary download still handles error envelopes", async () => {
  const form = new FormData();
  form.append("file", new Blob(["png"], { type: "image/png" }), "avatar.png");
  const client = createApiClient({ getBaseUrl: () => "https://gateway.test/api/v1", fetch: async (url, options) => {
    assert.equal(options.credentials, "omit");
    assert.equal(options.headers.Authorization, "Bearer private-token");
    if (options.method === "POST") {
      assert.equal(options.body, form);
      assert.equal(options.headers["Content-Type"], undefined);
      return Response.json({ data: { object_key: "key" } });
    }
    return new Response("image-bytes", { headers: { "Content-Type": "image/png" } });
  } });
  await client.request("/me/avatar", { method: "POST", body: form, accessToken: "private-token" });
  assert.equal(await (await client.request("/me/avatar", { responseType: "blob", accessToken: "private-token" })).text(), "image-bytes");
  const denied = createApiClient({ getBaseUrl: () => "https://gateway.test/api/v1", fetch: async () => Response.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 }) });
  await assert.rejects(denied.request("/me/avatar", { responseType: "blob" }), error => error instanceof ApiError && error.status === 401);
});

test("LINK invitations omit email; permissions use membership IDs; member history is opt-in", async () => {
  const calls = [];
  const api = createTripsApi({ request: async (path, options) => { calls.push({ path, ...options }); return {}; } });
  const trip = { id: "trip", membership_revision: 12 };
  await api.inviteLink(trip, "same-key");
  assert.deepEqual(calls.at(-1).body, { invitation_type: "LINK", expected_membership_revision: 12 });
  assert.equal(calls.at(-1).headers["Idempotency-Key"], "same-key");
  await api.policy(trip, "SELECTED_MEMBERS", ["membership-id"], "key");
  assert.deepEqual(calls.at(-1).body.editor_member_ids, ["membership-id"]);
  await api.members("trip", undefined, undefined, true);
  assert.match(calls.at(-1).path, /include_left=true/);
  await api.members("trip");
  assert.doesNotMatch(calls.at(-1).path, /include_left/);
});

test("lifecycle retries preserve the exact body, revision and operation key; 202 is not success", async () => {
  const requests = [];
  const api = createTripsApi(createApiClient({ getBaseUrl: () => "https://gateway.test/api/v1", fetch: async (path, options) => {
    requests.push({ path, ...options });
    if (requests.length === 1) throw new Error("Lost reply");
    return Response.json({ data: { operation_id: "key", trip_id: "trip", state: "PROCESSING" } }, { status: 202 });
  } }));
  const trip = { id: "trip", membership_revision: 15 };
  await assert.rejects(api.removeMember(trip, "member", "  Reason  ", "key"));
  const response = await api.removeMember(trip, "member", "  Reason  ", "key");
  assert.equal(requests[0].body, requests[1].body);
  assert.equal(requests[0].headers["Idempotency-Key"], requests[1].headers["Idempotency-Key"]);
  assert.deepEqual(JSON.parse(requests[1].body), { reason: "Reason", expected_membership_revision: 15 });
  assert.equal(requests[1].method, "DELETE");
  assert.equal(membershipCommitted(response), false);
  await api.leave(trip, "Reason", "key2");
  assert.match(requests.at(-1).path, /\/trips\/trip\/leave$/);
  assert.equal(requests.at(-1).method, "POST");
  await api.operation("key2");
  assert.match(requests.at(-1).path, /\/operations\/key2$/);
  assert.equal(requests.at(-1).method, "GET");
});

test("only SUCCEEDED plus COMMITTED is completion; failures and review are never reported as success", () => {
  for (const state of ["PROCESSING", "PENDING_RECOVERY", "FAILED", "NEEDS_REVIEW", "SUCCEEDED"]) {
    assert.equal(membershipCommitted({ state }), false);
    assert.equal(membershipCommitted({ state, outcome: { status: "REJECTED" } }), false);
  }
  assert.equal(membershipCommitted({ state: "SUCCEEDED", outcome: { status: "COMMITTED" } }), true);
  assert.equal(membershipPending({ state: "NEEDS_REVIEW" }), false);
  assert.equal(membershipPending(undefined), true);
  assert.match(membershipMessage({ state: "FAILED", error_code: "FINANCE_OBLIGATION_BLOCKED" }), /nghĩa vụ tài chính/);
  assert.match(membershipMessage({ state: "NEEDS_REVIEW" }), /vận hành/);
});
