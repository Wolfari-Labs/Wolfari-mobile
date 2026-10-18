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
