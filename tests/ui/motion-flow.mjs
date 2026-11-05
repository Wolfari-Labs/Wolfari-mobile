import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const appUrl = process.env.WOLFARI_PREVIEW_URL ?? "http://localhost:8082";
const output = path.resolve(".cache/visual/motion");
await mkdir(output, { recursive: true });
let executablePath;
for (const candidate of [process.env.WOLFARI_BROWSER_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean)) {
  if (await access(candidate).then(() => true, () => false)) { executablePath = candidate; break; }
}
assert.ok(executablePath);
const browser = await chromium.launch({ executablePath, headless: true });
const userId = "10000000-0000-4000-8000-000000000001";
const tripId = "20000000-0000-4000-8000-000000000001";
const profile = { id: userId, full_name: "Minh Anh", email: "motion@example.test", status: "ACTIVE", system_role: "USER", version: 1, avatar: null };
const trip = {
  id: tripId, name: "Đà Nẵng cùng nhau", lifecycle: "UPCOMING", timezone: "Asia/Ho_Chi_Minh",
  start_at: "2026-11-10T01:00:00.000Z", end_at: "2026-11-12T12:00:00.000Z",
  description: null, archived_at: null, version: 1,
  current_membership: { id: "30000000-0000-4000-8000-000000000001", user_id: userId, trip_id: tripId, role: "OWNER", left_at: null },
};

async function run({ reduced = false, blockCanvas = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 402, height: 874 }, reducedMotion: reduced ? "reduce" : "no-preference" });
  const errors = [], external = [], writes = [];
  let wasmRequests = 0;
  await context.route("**/api/v1/**", route => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace("/api/v1", "");
    const headers = { "Access-Control-Allow-Origin": appUrl, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Type, X-CSRF-Token", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    let data;
    if (p === "/auth/csrf") data = { csrf_token: "fixture-csrf" };
    else if (p === "/auth/refresh") data = { access_token: "fixture-access", token_type: "Bearer", expires_in: 900, profile };
    else if (p === "/me") data = profile;
    else if (p === "/trips") data = { items: [trip], next_cursor: null };
    else throw new Error(`Unexpected fixture request: ${p}`);
    if (req.method() !== "GET" && !p.startsWith("/auth/")) writes.push(p);
    return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify({ data, meta: {} }) });
  });
  if (blockCanvas) await context.route("**/canvaskit.wasm", route => route.abort("failed"));
  const page = await context.newPage();
  page.setDefaultTimeout(45_000); page.setDefaultNavigationTimeout(180_000);
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.origin === appUrl && url.pathname === "/canvaskit.wasm") wasmRequests++;
    if (url.protocol.startsWith("http") && url.origin !== appUrl && !url.pathname.startsWith("/api/v1/")) external.push(url.origin);
  });
  try {
    await page.goto(`${appUrl}/`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Đi đâu tiếp nhỉ?", exact: true }).waitFor();
    const hero = page.getByRole("button", { name: "Mở chuyến đi Đà Nẵng cùng nhau", exact: true });
    assert.equal(await hero.evaluate(node => getComputedStyle(node).backgroundColor), "rgb(255, 255, 255)", "The D featured trip uses an opaque clay card");
    assert.equal(await hero.locator("canvas").count(), 0, "The featured card must not allocate a decorative canvas");
    assert.equal(await page.getByRole("tab", { name: "Khám phá", exact: true }).evaluate(node => getComputedStyle(node).minHeight), "50px", "NativeWind tab styles must compile");
    await page.waitForTimeout(2600); // The finite entry animation must have settled.
    const suffix = blockCanvas ? "fallback" : reduced ? "reduced" : "animated";
    const first = await hero.screenshot({ path: path.join(output, `hero-${suffix}-settled-a.png`) });
    await page.waitForTimeout(350);
    const second = await hero.screenshot({ path: path.join(output, `hero-${suffix}-settled-b.png`) });
    // Chromium dithers CSS gradients by a few channel values between captures.
    // Compare pixels with a small tolerance, not the compressed PNG byte stream.
    const pixelDelta = await page.evaluate(async encoded => {
      const frames = await Promise.all(encoded.map(async source => {
        const bitmap = new Image(); bitmap.src = `data:image/png;base64,${source}`;
        await bitmap.decode();
        const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d"); ctx.drawImage(bitmap, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      }));
      if (frames[0].length !== frames[1].length) return { max: Infinity, mean: Infinity };
      let max = 0, sum = 0;
      for (let i = 0; i < frames[0].length; i++) {
        const delta = Math.abs(frames[0][i] - frames[1][i]); max = Math.max(max, delta); sum += delta;
      }
      return { max, mean: sum / frames[0].length };
    }, [first.toString("base64"), second.toString("base64")]);
    assert.ok(pixelDelta.max <= 8 && pixelDelta.mean <= 0.5, `Decorative drawing must settle: ${JSON.stringify(pixelDelta)}`);
    await page.screenshot({ path: path.join(output, `home-${suffix}.png`) });
    await page.getByRole("tab", { name: "Chuyến đi", exact: true }).click();
    await page.getByLabel("Tìm chuyến đi đã tải", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Mở chuyến đi Đà Nẵng cùng nhau" }).waitFor();
    await page.getByRole("tab", { name: "Chuyến đi", exact: true, selected: true }).waitFor();
    await page.getByLabel("Tìm chuyến đi đã tải", { exact: true }).fill("không tồn tại");
    await page.getByText("Trang hành trình còn trống", { exact: true }).waitFor();
    await page.getByLabel("Tìm chuyến đi đã tải", { exact: true }).fill("");
    await page.setViewportSize({ width: 320, height: 720 });
    await page.waitForTimeout(600);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(output, `trips-320-${suffix}.png`) });
    const button = page.getByRole("button", { name: "+ Tạo một hành trình mới", exact: true });
    // The floating dock overlays the viewport; "nearest" scrolling can leave
    // the button geometrically visible but covered by a tab. Center it as a
    // user would by scrolling further, then verify the actual hit target.
    await button.evaluate(node => node.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(150);
    const box = await button.boundingBox();
    assert.ok(box.height >= 44);
    assert.ok(await button.evaluate(node => {
      const rect = node.getBoundingClientRect();
      return node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }), "Primary action is reachable above the floating dock");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.waitForTimeout(150);
    const transform = await button.evaluate(node => getComputedStyle(node.parentElement).transform);
    if (reduced) {
      assert.ok(transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)", transform);
    } else {
      assert.ok(transform.startsWith("matrix(") && transform !== "matrix(1, 0, 0, 1, 0, 0)", `Press animation must run: ${transform}`);
    }
    await page.mouse.move(1, 1); await page.mouse.up();
    assert.equal(wasmRequests, 0, "Pastel screens do not load CanvasKit for decoration");
    assert.deepEqual(writes, []); assert.deepEqual(external, []); assert.deepEqual(errors, []);
  } catch (error) {
    console.error(`Motion case reduced=${reduced}, blockedWasm=${blockCanvas}:`, error.message);
    console.error("UI errors", errors, (await page.locator("body").innerText()).slice(-3500));
    await page.screenshot({ path: path.join(output, "failure.png"), timeout: 5000 }).catch(() => {});
    throw error;
  } finally { await context.close(); }
}
try {
  await run(); await run({ reduced: true }); await run({ blockCanvas: true });
  console.log("PASS motion UI: NativeWind computed styles, D featured card, settled animation, reduced motion, resilience without WASM, pastel tabs, search and 320px layout. No backend writes.");
} finally { await browser.close(); }
