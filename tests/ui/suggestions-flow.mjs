import { assertPublicText } from "./assert-public-text.mjs";
import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

// FR-TI01 weather row and FR-DS01/03 suggestions. Every API request is intercepted.
const appUrl = process.env.WOLFARI_PREVIEW_URL ?? "http://localhost:8082";
let executablePath;
for (const candidate of [process.env.WOLFARI_BROWSER_PATH,
  chromium.executablePath(), "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean)) {
  if (await access(candidate).then(() => true, () => false)) { executablePath = candidate; break; }
}
assert.ok(executablePath);
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 402, height: 874 }, reducedMotion: "reduce" });
const tripId = "20000000-0000-4000-8000-000000000001";
const userId = "10000000-0000-4000-8000-000000000001";
const templeId = "40000000-0000-4000-8000-000000000001";
const placeId = "70000000-0000-4000-8000-000000000001";
const recId = "80000000-0000-4000-8000-000000000001";
const membership = { id: "30000000-0000-4000-8000-000000000001", trip_id: tripId, user_id: userId, role: "OWNER", joined_at: "2026-10-01T00:00:00Z", left_at: null };
const trip = { id: tripId, name: "Đà Nẵng cùng nhau", description: null, public_description: null, start_at: "2026-11-30T17:00:00Z", end_at: "2026-12-03T16:59:00Z", timezone: "Asia/Ho_Chi_Minh", lifecycle: "UPCOMING", archived_at: null, plan_edit_policy: "OWNER_ONLY", plan_version: 4, export_revision: 4, membership_revision: 1, current_membership: membership };
const server = { version: 4, conflictNext: false, packing: [{ id: "50000000-0000-4000-8000-000000000001", name: "Áo mưa", quantity: "1", unit: null, note: null, category: null, assigned_member_id: null, due_at: null, status: "TODO" }] };
const items = [
  { id: "a".repeat(24), kind: "PACKING", reasons: ["01/12 có khả năng mưa 70%"], rule_ids: ["PK-RAIN"], warnings: [], packing_item: { name: "Ô", quantity: "1", category: "Thời tiết" } },
  { id: "b".repeat(24), kind: "PACKING", reasons: ["01/12 có khả năng mưa 70%"], rule_ids: ["PK-RAIN"], warnings: ["ALREADY_IN_PLAN"], packing_item: { name: "Áo mưa", quantity: "1", category: "Thời tiết" } },
  { id: "c".repeat(24), kind: "PACKING", reasons: ["UV 9 vào 02/12"], rule_ids: ["PK-UV"], warnings: [], packing_item: { name: "Kem chống nắng", quantity: "1" } },
  { id: "d".repeat(24), kind: "DRESS_CODE", reasons: ["Chùa Linh Ứng là nơi thờ tự: nên mặc kín vai và gối"], rule_ids: ["DC-MODEST"], warnings: [], date: "2026-12-01", dress_code: { label: "Kín đáo, lịch sự", activity_id: templeId } },
];
const source = { provider: "OPEN_METEO", fetched_at: "2026-11-25T03:05:00Z", stale: false, is_mock: false, attribution: [{ text: "Weather data by Open-Meteo.com", url: "https://open-meteo.com/" }] };
const recommendation = (extra = {}) => ({ id: recId, trip_id: tripId, type: "ALL", status: "PREVIEWED", rule_version: "dss-2026.11.1", base_plan_version: server.version, applied_plan_version: null, created_at: "2026-11-25T03:05:00Z", expires_at: "2026-11-25T03:35:00Z", can_apply: true, items, warnings: [], sources: [source], ...extra });
const calls = [], errors = [];
await context.route("**/api/v1/**", async route => {
  const req = route.request(), url = new URL(req.url()), pathname = url.pathname.replace("/api/v1", ""), method = req.method();
  const headers = { "Access-Control-Allow-Origin": appUrl, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Type, X-CSRF-Token, Idempotency-Key", "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS" };
  const respond = (data, status = 200, meta = {}) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify({ data, meta }) });
  const fail = (status, code, details = null) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify({ error: { code, message: code, details }, meta: {} }) });
  if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
  const body = req.postData() ? req.postDataJSON() : null;
  calls.push({ pathname, method, body, query: url.search, key: req.headers()["idempotency-key"] });
  if (pathname === "/auth/csrf") return respond({ csrf_token: "fixture" });
  if (pathname === "/auth/refresh" || pathname === "/auth/login") return respond({ access_token: "fixture-access", token_type: "Bearer", expires_in: 900, profile: { id: userId, email: "fixture@example.test", full_name: "Người kiểm thử", avatar: null, version: 1 } });
  if (pathname === "/me") return respond({ id: userId, email: "fixture@example.test", full_name: "Người kiểm thử", avatar: null, version: 1 });
  if (pathname === "/trips/" + tripId) return respond({ ...trip, plan_version: server.version });
  if (pathname.endsWith("/members")) return respond({ items: [membership], next_cursor: null });
  if (pathname.endsWith("/plan")) return respond({
    trip_id: tripId, plan_version: server.version, export_revision: server.version,
    activities: [{ id: templeId, trip_id: tripId, title: "Chùa Linh Ứng", description: null, public_description: null, activity_type: "TEMPLE", selected_location_id: placeId, starts_at: "2026-12-01T01:00:00Z", ends_at: null, position: 0, status: "TODO", source: "MANUAL", plan_version: server.version }],
    selected_locations: [{ id: placeId, name: "Chùa Linh Ứng", address: "Sơn Trà", latitude: "16.1003", longitude: "108.2775", source: "MANUAL" }],
    packing_items: server.packing.map(row => ({ ...row, plan_version: server.version })), dress_codes: [],
    permissions: { can_read: true, can_edit: true, can_complete: true },
    capabilities: { dress_codes_write: true, packing_write: true, locations_write: true },
  });
  if (pathname === "/travel/weather") {
    const date = url.searchParams.get("date");
    if (date === "2026-12-03") return respond(null, 200, { status: "NO_RESULT", provider: "OPEN_METEO", fetched_at: null, stale: false, is_mock: false, warnings: ["FORECAST_OUT_OF_RANGE"], attribution: source.attribution });
    return respond({ date, temperature_max_c: 29.6, temperature_min_c: 23.2, rain_probability: 0.7, uv_index: 6.4 }, 200, { status: "SUCCESS", provider: "OPEN_METEO", fetched_at: source.fetched_at, stale: false, is_mock: false, warnings: [], attribution: source.attribution });
  }
  if (pathname === `/trips/${tripId}/recommendations` && method === "POST") return respond(recommendation({ type: body.type }), 201);
  if (pathname === `/recommendations/${recId}/apply`) {
    if (server.conflictNext) { server.conflictNext = false; server.version++; return fail(409, "VERSION_CONFLICT", { plan_version: server.version }); }
    if (body.expected_plan_version !== server.version) return fail(409, "VERSION_CONFLICT", { plan_version: server.version });
    server.version++;
    const chosen = items.filter(item => body.item_ids.includes(item.id) && item.packing_item);
    for (const item of chosen) server.packing.push({ id: "5000000" + server.packing.length + "-0000-4000-8000-000000000001", name: item.packing_item.name, quantity: "1", unit: null, note: null, category: null, assigned_member_id: null, due_at: null, status: "TODO" });
    return respond(recommendation({ status: "APPLIED", applied_plan_version: server.version, applied: { item_ids: body.item_ids, created: body.item_ids.map(id => ({ item_id: id, entity_type: "PACKING_ITEM", id })), skipped: [] } }));
  }
  if (pathname === `/recommendations/${recId}/ignore`) return respond(recommendation({ status: "REJECTED" }));
  return fail(404, "RESOURCE_NOT_FOUND");
});
const page = await context.newPage();
page.setDefaultTimeout(30_000);
page.setDefaultNavigationTimeout(120_000);
page.on("pageerror", error => errors.push(error.message));
const button = name => page.getByRole("button", { name, exact: true });
const box = name => page.getByRole("checkbox", { name, exact: true });
const text = value => page.getByText(value, { exact: true });
const goto = async route => { await page.goto(appUrl + route, { waitUntil: "networkidle" }); };
const output = path.resolve(".cache/visual/suggestions");
await mkdir(output, { recursive: true });
async function screenshot(name) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal page overflow");
  await assertPublicText(page);
  await page.screenshot({ path: path.join(output, name + ".png"), fullPage: true });
}
const previews = () => calls.filter(call => call.pathname.endsWith("/recommendations"));
const applies = () => calls.filter(call => call.pathname.endsWith("/apply"));
try {
  // FR-TI01: the itinerary day shows the forecast at its first located stop.
  await goto(`/trip/${tripId}/itinerary?day=2026-12-01`);
  await text("30° / 23° · Mưa 70% · UV 6 cao").waitFor();
  await text("Nhớ mang ô hoặc áo mưa.").waitFor();
  await text("Thời tiết: Open-Meteo · cập nhật 10:05").waitFor();
  const weather = calls.find(call => call.pathname === "/travel/weather");
  assert.equal(weather.query, "?latitude=16.1003&longitude=108.2775&date=2026-12-01");
  await screenshot("itinerary-weather");
  await page.getByRole("tab", { name: /Ngày 3/ }).click();
  await text(/Dự báo có trước tối đa 16 ngày/).waitFor();

  // FR-DS01: open from Packing; preview never changes the Plan.
  await goto(`/trip/${tripId}/packing`);
  await button("Gợi ý theo thời tiết").click();
  await box("Ô").waitFor();
  assert.equal(previews()[0].body.type, "PACKING");
  assert.equal(await box("Ô").getAttribute("aria-checked"), "true");
  assert.equal(await box("Áo mưa").getAttribute("aria-checked"), "false", "Already packed starts unticked");
  await text("Đã có trong danh sách").waitFor();
  await text("• 01/12 có khả năng mưa 70%").first().waitFor();
  await text("Chùa Linh Ứng · 01/12").waitFor();
  await text("Weather data by Open-Meteo.com").waitFor();
  await screenshot("preview");

  // Untick one, then a version conflict asks for a fresh preview instead of writing.
  await box("Kem chống nắng").click();
  await button("Thêm 2 mục đã chọn").waitFor();
  server.conflictNext = true;
  await button("Thêm 2 mục đã chọn").click();
  await text(/Tạo gợi ý mới để xem lại/).waitFor();
  assert.equal(applies().length, 1);
  await button("Tạo gợi ý mới").click();
  await box("Ô").waitFor();
  assert.equal(previews().length, 2);
  assert.equal(await box("Kem chống nắng").getAttribute("aria-checked"), "true", "A new preview resets the ticks");

  // Apply the chosen rows with the preview's Plan version and one idempotency key.
  await box("Kem chống nắng").click();
  await button("Thêm 2 mục đã chọn").click();
  await text(/Đã thêm 2 gợi ý vào chuyến đi/).waitFor();
  const apply = applies()[1];
  assert.deepEqual(apply.body, { item_ids: ["a".repeat(24), "d".repeat(24)], expected_plan_version: 5 });
  assert.match(apply.key, /^[0-9a-f-]{36}$/i);
  await text("Ô").first().waitFor();

  // Dress code entry opens the same screen filtered; ignoring only closes it.
  await goto(`/trip/${tripId}/dress-code`);
  await button("Gợi ý trang phục").click();
  await box("Kín đáo, lịch sự").waitFor();
  assert.equal(previews().at(-1).body.type, "DRESS_CODE");
  await button("Bỏ qua lần này").click();
  await button("Gợi ý trang phục").waitFor();
  assert.ok(calls.some(call => call.pathname.endsWith("/ignore")));
  assert.deepEqual(errors, []);
  console.log("Suggestions UI passed: itinerary weather + out-of-range, packing/dress entry, reasons and sources, default ticks, conflict refresh, idempotent apply, ignore, 402px layout.");
} catch (error) {
  await page.screenshot({ path: path.join(output, "failure.png") });
  console.error((await page.locator("body").innerText()).slice(-2000));
  throw error;
} finally { await browser.close(); }
