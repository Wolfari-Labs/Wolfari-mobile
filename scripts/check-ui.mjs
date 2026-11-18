import http from "node:http";
import { closeSync, openSync, readFileSync } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const root = path.resolve(process.env.WOLFARI_EXPORT_DIR ?? "dist");
const available = [
  "auth",
  "trip",
  "order",
  "backend-features",
  "finance",
  "payment-simulation",
  "finance-price-watch",
  "dress-code",
  "packing",
  "mobile-completion",
  "reliability",
];
const selected = process.argv.slice(2);
const suites = selected.length ? selected : available;
if (suites.some((name) => !available.includes(name)))
  throw Error("Unknown UI suite. Choose: " + available.join(", "));
await stat(path.join(root, "index.html"));
await mkdir(".cache/ui", { recursive: true });
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".wasm": "application/wasm",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    let target = path.resolve(root, "." + decodeURIComponent(url.pathname));
    if (target !== root && !target.startsWith(root + path.sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      response.writeHead(502);
      response.end("UI fixture did not intercept this API request");
      return;
    }
    if (!(await stat(target).catch(() => undefined))?.isFile())
      target = path.join(root, "index.html");
    response.writeHead(200, {
      "Content-Type": mime[path.extname(target)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(await readFile(target));
  } catch {
    response.writeHead(500);
    response.end();
  }
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const appUrl = `http://127.0.0.1:${server.address().port}`;
const children = new Set();
const stop = () => {
  for (const child of children) child.kill();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
let failed = false;
try {
  const queue = [...suites];
  await Promise.all(
    Array.from({ length: Math.min(2, queue.length) }, async () => {
      while (queue.length) {
        const name = queue.shift(),
          logPath = `.cache/ui/${name}.log`,
          output = openSync(logPath, "w");
        let result;
        try {
          result = await new Promise((resolve, reject) => {
            const child = spawn(process.execPath, [`tests/ui/${name}-flow.mjs`], {
              env: { ...process.env, WOLFARI_PREVIEW_URL: appUrl },
              stdio: ["ignore", output, output],
              windowsHide: true,
              timeout: 300000,
            });
            children.add(child);
            child.once("error", reject);
            child.once("exit", (code, signal) => {
              children.delete(child);
              resolve({ code, signal });
            });
          });
        } finally {
          closeSync(output);
        }
        console.log(`${result.code === 0 ? "PASS" : "FAIL"} ${name}`);
        if (result.code !== 0) {
          failed = true;
          console.error(readFileSync(logPath, "utf8").split("\n").slice(-45).join("\n"));
        }
      }
    }),
  );
} finally {
  stop();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
process.exitCode = failed ? 1 : 0;
