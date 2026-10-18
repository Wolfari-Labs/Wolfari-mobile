import http from "node:http";
import os from "node:os";
import { pathToFileURL } from "node:url";

export function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat().filter(address => address && !address.internal && address.family === "IPv4").map(address => address.address);
}

export function createDevGateway({ target = "http://127.0.0.1:3000", webOrigin = "http://127.0.0.1:3000", previewPorts = [8081, 8082], hosts = ["localhost", "127.0.0.1", ...lanAddresses()] } = {}) {
  const upstream = new URL(target);
  if (upstream.protocol !== "http:" || upstream.hostname !== "127.0.0.1" || upstream.pathname !== "/" || upstream.username || upstream.password || upstream.search || upstream.hash) throw new Error("The development bridge only forwards to the local Gateway.");
  const origins = new Set(hosts.flatMap(host => previewPorts.map(port => `http://${host}:${port}`)));
  return http.createServer((request, response) => {
    const reject = (status, code) => { response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); response.end(JSON.stringify({ error: { code, message: "Development Gateway unavailable", retryable: status === 503 }, meta: {} })); };
    const path = request.url ?? "/";
    // Keep the bridge scoped to this app; it is never an arbitrary forward proxy.
    if (!/^\/(?:api\/v1(?:\/|\?|$)|health\/ready(?:\?|$)|invitations\/local(?:\?|$))/.test(path) || path.startsWith("//") || path.includes("\\")) return reject(404, "RESOURCE_NOT_FOUND");
    const origin = request.headers.origin;
    if (origin && !origins.has(origin)) return reject(403, "PERMISSION_DENIED");
    const cors = origin ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Type, X-CSRF-Token, Idempotency-Key", "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS", Vary: "Origin" } : {};
    if (request.method === "OPTIONS") { response.writeHead(204, cors); response.end(); return; }
    const headers = { ...request.headers, host: upstream.host, ...(origin ? { origin: webOrigin } : {}) };
    delete headers["x-forwarded-host"]; delete headers["x-forwarded-for"];
    const outgoing = http.request({ hostname: upstream.hostname, port: upstream.port || 80, path, method: request.method, headers, timeout: 30_000 }, incoming => {
      response.writeHead(incoming.statusCode ?? 502, { ...incoming.headers, ...cors });
      incoming.pipe(response);
      incoming.on("error", () => response.destroy());
    });
    outgoing.on("timeout", () => outgoing.destroy(new Error("Gateway timeout")));
    outgoing.on("error", () => { if (!response.headersSent) { Object.entries(cors).forEach(([key, value]) => response.setHeader(key, value)); reject(503, "SERVICE_UNAVAILABLE"); } else response.destroy(); });
    request.on("aborted", () => outgoing.destroy());
    request.on("error", () => outgoing.destroy());
    request.pipe(outgoing);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.NODE_ENV === "production") throw new Error("Use a deployed HTTPS Gateway in production.");
  const port = Number(process.env.WOLFARI_LAN_PORT ?? 3001);
  const server = createDevGateway({ target: process.env.WOLFARI_GATEWAY_TARGET, webOrigin: process.env.WOLFARI_GATEWAY_WEB_ORIGIN });
  server.on("error", error => { console.error(`LAN bridge: ${error.message}`); process.exitCode = 1; });
  server.listen(port, "0.0.0.0", () => {
    console.log(`Wolfari development Gateway → ${process.env.WOLFARI_GATEWAY_TARGET ?? "http://127.0.0.1:3000"}`);
    for (const host of ["127.0.0.1", ...lanAddresses()]) console.log(`  http://${host}:${port}/api/v1`);
    console.log("Keep this terminal open, then run npm run start:go and scan the Expo Go QR code on the same Wi-Fi.");
  });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { server.close(); server.closeAllConnections(); });
}
