import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const appUrl = process.env.WOLFARI_PREVIEW_URL ?? "http://localhost:8084";
const output = path.resolve(".cache/visual/pastel-d");
await mkdir(output, { recursive: true });
let executablePath;
for (const candidate of [process.env.WOLFARI_BROWSER_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean)) {
  if (await access(candidate).then(() => true, () => false)) { executablePath = candidate; break; }
}
assert.ok(executablePath, "Set WOLFARI_BROWSER_PATH to an installed Chromium browser.");
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
const unexpectedRequests = [];
await context.route("**/api/v1/**", route => {
  const request = route.request();
  if (!new URL(request.url()).pathname.startsWith("/api/v1/auth/")) unexpectedRequests.push(request.url());
  return route.fulfill({ status: 401, headers: { "Access-Control-Allow-Origin": appUrl, "Access-Control-Allow-Credentials": "true" }, contentType: "application/json", body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Anonymous design fixture" } }) });
});
const page = await context.newPage();
page.setDefaultTimeout(30_000);
page.setDefaultNavigationTimeout(90_000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));

try {
  for (const viewport of [{ width: 320, height: 740 }, { width: 375, height: 812 }, { width: 402, height: 874 }, { width: 874, height: 402 }]) {
    await page.setViewportSize(viewport);
    for (const screen of [
      { route: "/", name: "guest", action: "Bắt đầu hành trình" },
      { route: "/sign-in", name: "sign-in", action: "Đăng nhập" },
      { route: "/demo-trip", name: "overview", action: "Hành lý mẫu" },
    ]) {
      await page.goto(`${appUrl}${screen.route}`, { waitUntil: "networkidle" });
      const action = page.getByRole("button", { name: screen.action, exact: true });
      await action.waitFor();
      await page.waitForFunction(() => !document.querySelector('[data-testid="app-splash"]'));
      await page.waitForFunction(() => document.images.length > 0 && Array.from(document.images).every(img => img.complete && img.naturalWidth > 0));
      await page.evaluate(() => document.fonts.ready);
      assert.ok(await page.evaluate(() => ["Nunito-SemiBold", "Nunito-Bold", "Nunito-ExtraBold"].every(family => Array.from(document.fonts).some(font => font.family.replaceAll('"', "") === family && font.status === "loaded"))), "All local Nunito weights loaded");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${screen.name}: no horizontal overflow at ${viewport.width}`);
      assert.ok(await page.locator("img").evaluateAll(images => images.every(img => !img.src.includes("figma.com"))), "No expiring Figma URLs");
      await page.screenshot({ path: path.join(output, `${screen.name}-${viewport.width}.png`) });
      await action.scrollIntoViewIfNeeded();
      const box = await action.boundingBox();
      assert.ok(box && box.width >= 44 && box.height >= 44, "Primary actions retain a 44pt target");
      assert.ok(box.y >= 0 && box.y + box.height <= viewport.height + 1, "Primary action is fully reachable in portrait and landscape");
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpectedRequests, [], "Visual checks never access Trip or Finance APIs");
  console.log("PASS design D: 320/375/402px and landscape, local fonts/images, reachable 44pt actions, reduced-motion mode, no overflow or runtime errors.");
} finally {
  await browser.close();
}
