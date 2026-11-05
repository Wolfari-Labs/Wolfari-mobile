import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../src/shared/api/api-client.ts";
import { createAuthenticatedClient } from "../src/shared/api/authenticated-client.ts";
import { createFinanceApi } from "../src/features/finance/api.ts";
import { createPriceWatchApi } from "../src/features/price-watch/api.ts";

test("Authenticated clients cannot send/replay the previous account's financial intent after account switch", async () => {
  let user = "A", calls = 0, refreshes = 0;
  const session = { getSessionSnapshot: () => ({ profile: user ? { id: user } : null }), getAccessToken: async () => "A-token", refreshAccessToken: async () => { refreshes++; user = "B"; return "B-token"; } };
  const client = createAuthenticatedClient({ requestWithMeta: async () => { calls++; throw new ApiError("UNAUTHENTICATED", "Expired", 401); } }, session, "A");
  await assert.rejects(client.request("/funds/id/budget", { method: "PATCH" }), { code: "SESSION_CHANGED" });
  assert.equal(calls, 1); assert.equal(refreshes, 1);
  await assert.rejects(client.request("/funds/id/budget", { method: "PATCH" }), { code: "SESSION_CHANGED" });
  assert.equal(calls, 1);
});
test("Account switch while awaiting a token prevents sending; late reads cannot return to another account", async () => {
  let user = "A", calls = 0;
  const session = { getSessionSnapshot: () => ({ profile: { id: user } }), getAccessToken: async () => { user = "B"; return "B-token"; }, refreshAccessToken: async () => "unused" };
  const transport = { requestWithMeta: async () => { calls++; user = "B"; return { data: "A-private", meta: {} }; } };
  const api = createAuthenticatedClient(transport, session, "A");
  await assert.rejects(api.request("/funds/id/destinations"), { code: "SESSION_CHANGED" }); assert.equal(calls, 0);
  user = "A"; session.getAccessToken = async () => "A-token";
  await assert.rejects(api.request("/funds/id/destinations"), { code: "SESSION_CHANGED" }); assert.equal(calls, 1);
});
test("Ordinary token refresh preserves body and idempotency; credential requests never auto-retry", async () => {
  const calls = []; let refreshes = 0;
  const session = { getSessionSnapshot: () => ({ profile: { id: "A" } }), getAccessToken: async () => "old", refreshAccessToken: async () => { refreshes++; return "new"; } };
  const api = createAuthenticatedClient({ requestWithMeta: async (path, options) => { calls.push({ path, ...options }); if (options.accessToken === "old") throw new ApiError("UNAUTHENTICATED", "Expired", 401); return { data: { id: "fund" }, meta: {} }; } }, session, "A");
  const body = { budget_amount: "10" }, headers = { "Idempotency-Key": "same-key" };
  await api.request("/funds/id/budget", { method: "PATCH", body, headers });
  assert.equal(calls.length, 2); assert.equal(calls[0].body, calls[1].body); assert.equal(calls[0].headers, calls[1].headers);
  await assert.rejects(api.request("/me/password-change", { method: "POST", retryAuth: false }), { status: 401 });
  assert.equal(refreshes, 1);
});

test("Merged Finance and Price Watch factories retain account-switch protection", async () => {
  let calls = 0;
  const session = { getSessionSnapshot: () => ({ profile: { id: 'new-account' } }),
    getAccessToken: async () => 'new-token', refreshAccessToken: async () => 'unused' };
  const client = createAuthenticatedClient({ requestWithMeta: async () => { calls++; return { data: {}, meta: {} }; } }, session, 'old-account');
  const finance = createFinanceApi(client), watches = createPriceWatchApi(client);
  await assert.rejects(watches.list('trip'), { code: 'SESSION_CHANGED' });
  await assert.rejects(finance.write({ path: '/price-watches/watch/pause', method: 'POST', body: { expected_version: 1 }, key: 'same-key' }), { code: 'SESSION_CHANGED' });
  await assert.rejects(finance.execute({ path: '/funds/fund/budget', method: 'PATCH', body: { budget_amount: '10' } }, 'same-key'), { code: 'SESSION_CHANGED' });
  assert.equal(calls, 0);
});
