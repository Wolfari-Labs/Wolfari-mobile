import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, createApiClient } from "../src/shared/api/api-client.ts";

const baseUrl = "http://127.0.0.1:3000/api/v1/";

test("mobile login uses the Gateway envelope and never sends cookies", async () => {
  const requests = [];
  const client = createApiClient({
    getBaseUrl: () => baseUrl,
    fetch: async (url, options) => {
      requests.push({ url, options });
      return Response.json({ data: { access_token: "test-access" }, meta: {} });
    },
  });
  const payload = await client.request("/auth/login", {
    method: "POST", body: { email: "demo@example.test", password: "test password" },
  });
  assert.equal(payload.access_token, "test-access");
  assert.equal(requests[0].url, "http://127.0.0.1:3000/api/v1/auth/login");
  assert.equal(requests[0].options.credentials, "omit");
  assert.equal(requests[0].options.headers["X-Client-Type"], "mobile");
  assert.equal(requests[0].options.headers["Content-Type"], "application/json");
});

test("web requests use the cookie contract and allow CSRF headers", async () => {
  const client = createApiClient({
    getBaseUrl: () => baseUrl, clientType: "web",
    fetch: async (_url, options) => {
      assert.equal(options.credentials, "include");
      assert.equal(options.headers["X-Client-Type"], "web");
      assert.equal(options.headers["X-CSRF-Token"], "test-csrf");
      return Response.json({ data: {}, meta: {} });
    },
  });
  await client.request("/auth/refresh", { method: "POST", body: {}, headers: { "X-CSRF-Token": "test-csrf" } });
});

test("backend errors preserve status, code and correlation ID without automatic POST retry", async () => {
  let requests = 0;
  const client = createApiClient({
    getBaseUrl: () => baseUrl,
    fetch: async () => {
      requests++;
      return Response.json({
        error: { code: "UNAUTHENTICATED", message: "Invalid credentials", retryable: false },
        meta: { correlation_id: "test-correlation" },
      }, { status: 401 });
    },
  });
  await assert.rejects(client.request("/auth/login", { method: "POST", body: {} }), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 401);
    assert.equal(error.code, "UNAUTHENTICATED");
    assert.equal(error.correlationId, "test-correlation");
    return true;
  });
  assert.equal(requests, 1);
});

test("a successful HTML response is not interpreted as an authenticated session", async () => {
  const client = createApiClient({ getBaseUrl: () => baseUrl, fetch: async () => new Response("<html>proxy</html>") });
  await assert.rejects(client.request("/auth/login"), (error) => error.code === "INVALID_RESPONSE");
});

test("network failure and request timeout are distinguishable", async () => {
  const offline = createApiClient({ getBaseUrl: () => baseUrl, fetch: async () => { throw new TypeError("offline"); } });
  await assert.rejects(offline.request("/me"), (error) => error.code === "NETWORK_ERROR");
  const timeout = createApiClient({
    getBaseUrl: () => baseUrl, timeoutMs: 5,
    fetch: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }),
  });
  await assert.rejects(timeout.request("/me"), (error) => error.code === "REQUEST_TIMEOUT");
});

test("absolute URLs are rejected before any credential-bearing request", async () => {
  let called = false;
  const client = createApiClient({ getBaseUrl: () => baseUrl, fetch: async () => { called = true; return Response.json({ data: {} }); } });
  await assert.rejects(client.request("https://example.test", { accessToken: "test-access" }));
  await assert.rejects(client.request("//example.test", { accessToken: "test-access" }));
  assert.equal(called, false);
});
