import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { once } from "node:events";
import { createDevGateway } from "../scripts/dev-gateway.mjs";

test("LAN bridge forwards API writes, supports web CSRF/cookies, and blocks foreign origins and proxy paths", async () => {
  const received = [];
  const target = http.createServer((request, response) => {
    const chunks = []; request.on("data", chunk => chunks.push(chunk));
    request.on("end", () => { received.push({ url: request.url, method: request.method, headers: request.headers, body: Buffer.concat(chunks).toString() }); response.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": "refresh=fixture; HttpOnly; Path=/api/v1/auth" }); response.end(JSON.stringify({ data: { ok: true }, meta: {} })); });
  });
  target.listen(0, "127.0.0.1"); await once(target, "listening");
  const bridge = createDevGateway({ target: `http://127.0.0.1:${target.address().port}`, webOrigin: "http://127.0.0.1:3000", hosts: ["localhost"], previewPorts: [8082] });
  bridge.listen(0, "127.0.0.1"); await once(bridge, "listening");
  const base = `http://127.0.0.1:${bridge.address().port}`;
  try {
    const result = await fetch(`${base}/api/v1/auth/refresh`, { method: "POST", headers: { Origin: "http://localhost:8082", "X-Client-Type": "web", "X-CSRF-Token": "fixture-csrf", Cookie: "refresh=fixture", "Content-Type": "application/json" }, body: "{}" });
    assert.equal(result.status, 200); await result.text();
    assert.equal(result.headers.get("Access-Control-Allow-Origin"), "http://localhost:8082");
    assert.match(result.headers.get("set-cookie"), /HttpOnly/);
    assert.equal(received[0].headers.origin, "http://127.0.0.1:3000");
    assert.equal(received[0].headers["x-csrf-token"], "fixture-csrf");
    assert.equal(received[0].body, "{}");
    const preflight = await fetch(`${base}/api/v1/trips`, { method: "OPTIONS", headers: { Origin: "http://localhost:8082" } });
    assert.equal(preflight.status, 204); assert.match(preflight.headers.get("access-control-allow-headers"), /Idempotency-Key/);
    assert.equal((await fetch(`${base}/api/v1/me`, { headers: { Origin: "https://foreign.test" } })).status, 403);
    assert.equal((await fetch(`${base}/internal/identity/me`)).status, 404);
    assert.equal(received.length, 1);
  } finally { bridge.close(); bridge.closeAllConnections(); target.close(); target.closeAllConnections(); }
});

test("LAN email pages can confirm from their own known origin while foreign hosts and ports stay blocked", async () => {
  const received = [];
  const target = http.createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    received.push({ path: request.url, origin: request.headers.origin, body });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: { message_code: "REQUEST_ACCEPTED" }, meta: {} }));
  });
  target.listen(0, "127.0.0.1");
  await once(target, "listening");
  const bridge = createDevGateway({
    target: `http://127.0.0.1:${target.address().port}`,
    webOrigin: "http://127.0.0.1:3000",
    hosts: ["127.0.0.1", "192.0.2.10"],
    previewPorts: [8082],
  });
  bridge.listen(0, "127.0.0.1");
  await once(bridge, "listening");
  const port = bridge.address().port;
  const base = `http://127.0.0.1:${port}`;
  const confirm = (origin, path = "/api/v1/auth/email-verifications/confirm", extra = {}) => fetch(`${base}${path}`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", ...extra },
    body: JSON.stringify({ token: "fixture-token" }),
  });
  try {
    for (const origin of [base, `http://192.0.2.10:${port}`]) {
      const result = await confirm(origin);
      assert.equal(result.status, 200);
      assert.equal(result.headers.get("access-control-allow-origin"), origin);
      await result.text();
    }
    const reset = await confirm(base, "/api/v1/auth/password-resets");
    assert.equal(reset.status, 200);
    await reset.text();
    const preflight = await fetch(`${base}/api/v1/auth/email-verifications/confirm`, {
      method: "OPTIONS", headers: { Origin: base },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), base);
    assert.equal(received.length, 3);
    assert.ok(received.every(request => request.origin === "http://127.0.0.1:3000"));
    assert.deepEqual(JSON.parse(received[0].body), { token: "fixture-token" });
    assert.equal(received[2].path, "/api/v1/auth/password-resets");
    for (const origin of [
      `http://foreign.test:${port}`,
      `http://127.0.0.1:${port === 65535 ? port - 1 : port + 1}`,
      `https://127.0.0.1:${port}`,
      "null",
    ]) {
      const denied = await confirm(origin, undefined, { Host: `foreign.test:${port}` });
      assert.equal(denied.status, 403);
      assert.equal((await denied.json()).error.code, "PERMISSION_DENIED");
    }
    assert.equal(received.length, 3);
  } finally {
    bridge.close(); bridge.closeAllConnections(); target.close(); target.closeAllConnections();
  }
});
import { Buffer } from "node:buffer";
