import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const appUrl = process.env.WOLFARI_PREVIEW_URL ?? "http://127.0.0.1:8083";
const output = path.resolve(".cache/visual/splash");
await mkdir(output, { recursive: true });
let executablePath;
for (const candidate of [process.env.WOLFARI_BROWSER_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean)) {
  if (await access(candidate).then(() => true, () => false)) { executablePath = candidate; break; }
}
assert.ok(executablePath, "An installed Chromium browser is required");
const browser = await chromium.launch({ executablePath, headless: true });

async function run({ reduced = false, brokenImage = false, deepLink = false } = {}) {
  const context = await browser.newContext({
    viewport: reduced ? { width: 320, height: 568 } : { width: 402, height: 874 },
    reducedMotion: reduced ? "reduce" : "no-preference",
    // Recording is opt-in: the standard suite needs only an installed browser,
    // not Playwright's optional FFmpeg download.
    ...(process.env.WOLFARI_RECORD_SPLASH === "1" && !reduced && !brokenImage && !deepLink ? { recordVideo: { dir: output, size: { width: 402, height: 874 } } } : {}),
  });
  let releaseAuth;
  const authGate = new Promise(resolve => { releaseAuth = resolve; });
  const writes = [], errors = [], external = [];
  await context.route("**/api/v1/**", async route => {
    const request = route.request();
    const headers = { "Access-Control-Allow-Origin": appUrl, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Content-Type, X-Client-Type, Authorization, X-CSRF-Token", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (request.method() !== "GET") writes.push(request.url());
    // Keep auth pending to prove launch has its own bounded timeout.
    await authGate;
    return route.fulfill({ status: 401, headers, contentType: "application/json", body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Fixture", retryable: false }, meta: {} }) });
  });
  if (brokenImage) await context.route(/\/mascot\.[^/]+\.png$/, route => route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && url.origin !== appUrl && !url.pathname.startsWith("/api/v1/")) external.push(url.origin);
  });
  const suffix = deepLink ? "deep-link" : brokenImage ? "image-failure" : reduced ? "reduced-320" : "animated";
  try {
    await page.goto(`${appUrl}${deepLink ? "/demo-trip/packing" : "/"}`, { waitUntil: "domcontentloaded" });
    const splash = page.getByTestId("app-splash");
    await splash.waitFor();
    assert.equal(await splash.getAttribute("aria-busy"), "true");
    assert.equal(await page.getByRole("button", { name: "Bắt đầu hành trình", exact: true }).count(), 0, "Covered controls must not enter accessibility navigation");
    if (!brokenImage) await page.waitForFunction(() => {
      const element = document.querySelector('[data-testid="splash-mascot"]');
      const img = element?.matches("img") ? element : element?.querySelector("img");
      return img?.complete && img.naturalWidth > 0;
    });
    await page.waitForTimeout(150);
    const mascot = page.getByTestId("splash-mascot-motion");
    const before = await mascot.evaluate(node => getComputedStyle(node).transform);
    await page.waitForTimeout(180);
    const after = await mascot.evaluate(node => getComputedStyle(node).transform);
    if (reduced) {
      assert.equal(after, before);
      assert.ok(after === "none" || after === "matrix(1, 0, 0, 1, 0, 0)");
    } else if (!brokenImage) {
      assert.notEqual(after, before, "The mascot entrance must actually animate");
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (reduced) assert.equal(await page.getByText("Những kỷ niệm đẹp đang chờ bạn").count(), 0, "Omit the footer on compact screens to avoid overlapping the tagline");
    await page.screenshot({ path: path.join(output, `${suffix}.png`) });
    await splash.waitFor({ state: "hidden", timeout: 5000 });
    releaseAuth();
    if (deepLink) {
      assert.equal(new URL(page.url()).pathname, "/demo-trip/packing");
      await page.getByRole("heading", { name: /Hành lý/ }).first().waitFor();
    } else {
      await page.getByRole("button", { name: "Bắt đầu hành trình", exact: true }).click();
      await page.waitForURL("**/sign-up");
      assert.equal(await splash.count(), 0, "Do not replay splash during navigation");
      await page.goBack();
      assert.equal(await splash.count(), 0);
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(writes, []);
  } catch (error) {
    console.error(suffix, errors, error.message);
    await page.screenshot({ path: path.join(output, `failure-${suffix}.png`), timeout: 5000 }).catch(() => {});
    throw error;
  } finally {
    releaseAuth();
    const video = page.video();
    await context.close();
    if (video) await video.saveAs(path.join(output, "splash-preview.webm"));
  }
}

try {
  await run(); await run({ reduced: true }); await run({ brokenImage: true }); await run({ deepLink: true });
  console.log("PASS splash: actual motion, reduced motion, 320px layout, native asset safe circle (unit test), bounded pending auth, image failure, deep-link preservation, no replay on navigation, no backend writes.");
} finally { await browser.close(); }
