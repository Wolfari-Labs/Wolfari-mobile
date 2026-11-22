import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { assertPublicText } from "./assert-public-text.mjs";

const appUrl = process.env.WOLFARI_PREVIEW_URL ?? "http://localhost:8082";
let executablePath;
for (const candidate of [
  process.env.WOLFARI_BROWSER_PATH,
  chromium.executablePath(),
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean))
  if (await access(candidate).then(() => true, () => false)) {
    executablePath = candidate;
    break;
  }
assert.ok(executablePath);
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 402, height: 874 }, reducedMotion: "reduce" });
// Map tiles are third-party images; keep the test hermetic.
await context.route("https://tile.openstreetmap.org/**", (route) => route.abort());
const output = path.resolve(".cache/visual/places");
await mkdir(output, { recursive: true });

const uid = (n) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tripId = uid(1), userId = uid(2), memberId = uid(3);
let version = 4;
const locations = [
  { id: uid(10), name: "Chợ Cồn", address: "290 Hùng Vương, Đà Nẵng", latitude: "16.067800", longitude: "108.214000", source: "WOLFARI", metadata: {} },
  { id: uid(11), name: "Cầu Rồng", address: "Nguyễn Văn Linh, Đà Nẵng", latitude: "16.061000", longitude: "108.227000", source: "WOLFARI", metadata: {} },
];
const activity = (n, title, starts, locationId) => ({
  id: uid(n), trip_id: tripId, title, description: null, public_description: null, activity_type: "SIGHTSEEING",
  selected_location_id: locationId, starts_at: starts, ends_at: null, scheduled_date: null, status: "TODO", position: n, plan_version: version,
});
const activities = [
  activity(20, "Ăn sáng ở chợ", "2026-12-01T01:00:00Z", uid(10)),
  activity(21, "Nghỉ trưa", "2026-12-01T05:00:00Z", null),
  activity(22, "Xem cầu phun lửa", "2026-12-01T12:00:00Z", uid(11)),
];
const poi = (id, name, lat, lon, extra) => ({
  id, name, address: "Đà Nẵng", coordinates: { latitude: lat, longitude: lon }, selection_token: "token-" + id,
  attribution: "OpenStreetMap", provider: "WOLFARI", category: "museum", category_label: "Bảo tàng", category_group: "tourism",
  tier: 1, coord_verified: true, activity_type: "MUSEUM", dress_code_hint: "", province_name: "Đà Nẵng", ...extra,
});
const results = [
  poi("cham", "Bảo tàng Điêu khắc Chăm", 16.0604, 108.2235, {
    typical_duration_min: 90, dress_code_hint: "kín đáo",
    hero_image: {
      url: `/api/v1/travel/poi-images/${"d".repeat(64)}/1280.webp`, thumbnail_url: `/api/v1/travel/poi-images/${"d".repeat(64)}/640.webp`,
      small_url: `/api/v1/travel/poi-images/${"d".repeat(64)}/320.webp`, width: 1280, height: 853, author: "Nguyễn An",
      license: "CC-BY-SA-4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0", source_url: "https://commons.wikimedia.org/wiki/File:Cham_Museum.jpg",
      attribution: "Ảnh: Nguyễn An · CC BY-SA 4.0 · Wikimedia Commons", source: "wikidata", is_placeholder: false,
    },
  }),
  poi("mykhe", "Bãi biển Mỹ Khê", 16.0544, 108.2472, { category: "beach", category_label: "Bãi biển", typical_duration_min: 120, activity_type: "BEACH" }),
];
const searches = [], saves = [], routes = [], errors = [], imageRequests = [];
// 1×1 WebP so the photo actually renders in the fixture.
const tinyWebp = Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", "base64");
let routeFails = true;
const cors = {
  "Access-Control-Allow-Origin": appUrl,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Type, X-CSRF-Token, Idempotency-Key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};
const trip = {
  id: tripId, name: "Đà Nẵng ba ngày", description: null, start_at: "2026-11-30T17:00:00Z", end_at: "2026-12-03T16:59:00Z",
  timezone: "Asia/Ho_Chi_Minh", lifecycle: "UPCOMING", plan_edit_policy: "OWNER_ONLY",
  current_membership: { id: memberId, user_id: userId, role: "OWNER" }, permissions: { can_read: true, can_update: true },
};
await context.route("**/api/v1/**", async (route) => {
  const req = route.request(), url = new URL(req.url()), endpoint = url.pathname.replace("/api/v1", ""), method = req.method();
  const respond = (data, status = 200, meta = {}) =>
    route.fulfill({ headers: cors, status, contentType: "application/json", body: JSON.stringify({ data, meta }) });
  const fail = (status, code) =>
    route.fulfill({ headers: cors, status, contentType: "application/json", body: JSON.stringify({ error: { code, message: "Fixture", retryable: status === 503 }, meta: {} }) });
  if (method === "OPTIONS") return route.fulfill({ headers: cors, status: 204 });
  if (endpoint === "/auth/refresh" || endpoint === "/auth/login")
    return respond({ access_token: "fixture", token_type: "Bearer", expires_in: 900, profile: { id: userId, full_name: "Người kiểm thử", email: "fixture@example.test", version: 1 } });
  if (endpoint === "/auth/csrf") return respond({ csrf_token: "fixture" });
  if (endpoint === `/trips/${tripId}`) return respond({ ...trip, plan_version: version, export_revision: version, membership_revision: 1 });
  if (endpoint.endsWith("/members")) return respond({ items: [{ ...trip.current_membership, trip_id: tripId, joined_at: "2026-11-01T00:00:00Z", left_at: null }], next_cursor: null });
  if (endpoint.endsWith("/plan"))
    return respond({
      trip_id: tripId, plan_version: version, export_revision: version, activities, selected_locations: locations, dress_codes: [], packing_items: [],
      permissions: { can_read: true, can_edit: true, can_complete: true }, capabilities: { locations_write: true },
    });
  if (endpoint === `/trips/${tripId}/places/search`) {
    searches.push(Object.fromEntries(url.searchParams));
    const q = url.searchParams.get("q");
    const data = q ? results.filter((p) => p.name.includes(q)) : results;
    return respond(data, 200, { provider: "WOLFARI", status: data.length ? "SUCCESS" : "NO_RESULT", stale: false, is_mock: false, warnings: [], bbox_truncated: false });
  }
  if (endpoint === `/trips/${tripId}/selected-locations` && method === "POST") {
    const body = req.postDataJSON();
    saves.push(body);
    assert.equal(body.expected_plan_version, version);
    const place = results.find((p) => p.selection_token === body.selection_token);
    assert.ok(place, "Search results are saved by their selection token");
    const row = { id: uid(12), name: place.name, address: place.address, latitude: place.coordinates.latitude.toFixed(6), longitude: place.coordinates.longitude.toFixed(6), source: "WOLFARI", metadata: {}, plan_version: ++version };
    locations.push(row);
    return respond(row, 201);
  }
  if (endpoint.startsWith("/travel/poi-images/")) {
    imageRequests.push(endpoint);
    return route.fulfill({ status: 200, headers: { ...cors, "Cache-Control": "public, max-age=31536000, immutable" }, contentType: "image/webp", body: tinyWebp });
  }
  if (endpoint === "/travel/route" && method === "POST") {
    const body = req.postDataJSON();
    routes.push(body);
    if (routeFails) return fail(503, "SERVICE_UNAVAILABLE");
    return respond({ distance_m: 2500, duration_seconds: 600, geometry: [...body.coordinates.map((c) => c)] }, 200, { status: "SUCCESS", provider: "OSRM", stale: false, is_mock: false, warnings: ["ESTIMATED_BY_CAR_PROFILE"] });
  }
  return fail(404, "RESOURCE_NOT_FOUND");
});
const page = await context.newPage();
page.setDefaultTimeout(30000);
page.setDefaultNavigationTimeout(90000);
page.on("pageerror", (error) => errors.push(error.message));
const button = (name) => page.getByRole("button", { name, exact: true });
const tab = (name) => page.getByRole("tab", { name, exact: true });
const shot = async (name) => {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal page overflow");
  await assertPublicText(page);
  await page.screenshot({ path: path.join(output, name) });
};
try {
  await page.goto(`${appUrl}/trip/${tripId}/places`, { waitUntil: "networkidle" });
  // The group's places, with how many activities use each one.
  await tab("Của nhóm · 2").waitFor();
  await page.getByText("Chợ Cồn", { exact: true }).waitFor();
  await page.getByText("Đã gắn với 1 hoạt động", { exact: true }).first().waitFor();
  await page.getByLabel("Bản đồ các địa điểm của hành trình", { exact: true }).waitFor();
  await shot("places-saved.png");

  // Nearby search starts around the group's places, with the default "Tham quan" group.
  await tab("Tìm quanh đây").click();
  await page.getByText("Bảo tàng Điêu khắc Chăm", { exact: true }).waitFor();
  assert.equal(searches[0].category, "tourism");
  assert.equal(searches[0].radius_m, "5000");
  assert.ok(Math.abs(Number(searches[0].latitude) - 16.0644) < 0.001, "Centred on the group's places");
  await page.getByText("Bảo tàng · ~1 giờ 30 phút", { exact: true }).waitFor();
  await page.getByText("👗 Nên mặc: kín đáo", { exact: true }).waitFor();
  // Licensed photo from our Gateway, always with its credit line.
  // Photos load lazily: bring the card into view first.
  await page.getByText("Bảo tàng · ~1 giờ 30 phút", { exact: true }).scrollIntoViewIfNeeded();
  await page.getByAltText("Ảnh Bảo tàng Điêu khắc Chăm", { exact: true }).waitFor();
  await shot("places-explore.png");
  await page.getByText("ⓘ Ảnh: Nguyễn An · CC BY-SA 4.0 · Wikimedia Commons", { exact: true }).waitFor();
  assert.equal(await page.getByAltText("Ảnh Bãi biển Mỹ Khê", { exact: true }).count(), 0, "No photo, no placeholder pretending to be one");
  await tab("Ăn uống").click();
  await page.getByText("Bãi biển Mỹ Khê", { exact: true }).waitFor();
  assert.equal(searches.at(-1).category, "restaurant");
  await page.getByLabel("Khám phá địa điểm", { exact: true }).fill("Mỹ Khê");
  await button("Tìm địa điểm").click();
  await page.getByText("Bảo tàng Điêu khắc Chăm", { exact: true }).waitFor({ state: "hidden" });
  assert.equal(searches.at(-1).q, "Mỹ Khê");
  assert.ok(imageRequests.some((p) => p.endsWith("/640.webp")), "Cards load the 640 px variant");

  // Saving uses the server's token; the card then shows it is shared.
  await button("Lưu Bãi biển Mỹ Khê cho nhóm").click();
  await page.getByText("Đã lưu “Bãi biển Mỹ Khê” cho cả nhóm.", { exact: true }).waitFor();
  assert.deepEqual(saves[0], { selection_token: "token-mykhe", expected_plan_version: 4 });
  await page.getByText("✓ Đã lưu cho nhóm", { exact: true }).waitFor();
  await tab("Của nhóm · 3").waitFor();

  // Adding an activity carries the suggested type and visit length into the form.
  await button("Thêm hoạt động tại Bãi biển Mỹ Khê").click();
  await page.waitForURL(/\/activity\?/);
  const params = new URL(page.url()).searchParams;
  assert.equal(params.get("title"), "Bãi biển Mỹ Khê");
  assert.equal(params.get("locationId"), uid(12));
  assert.equal(params.get("activityType"), "SIGHTSEEING");
  assert.equal(params.get("duration"), "120");
  assert.equal(await page.getByLabel("Kết thúc", { exact: true }).inputValue(), "10:00");
  await page.goBack({ waitUntil: "networkidle" });

  // Day route: stops are the day's activities that have a place; no road data → dashed straight line.
  await tab("Lộ trình").click();
  await page.getByText(/Đường chim bay \(nét đứt\)/).waitFor();
  assert.equal(routes[0].coordinates.length, 2);
  assert.equal(routes[0].mode, "DRIVING");
  await page.getByText("Ăn sáng ở chợ · 08:00", { exact: true }).waitFor();
  await page.getByText(/Chưa có trên lộ trình: Nghỉ trưa/).waitFor();
  await shot("places-route-estimated.png");
  routeFails = false;
  await tab("🚶 Đi bộ").click();
  // Road path from the server; walking time is estimated from distance (~4.5 km/h), not the car timing.
  await page.getByText("2,5 km · ~35 phút", { exact: true }).waitFor();
  await page.getByText(/thời gian đi bộ ước tính/).waitFor();
  assert.equal(routes.at(-1).mode, "WALKING");
  await shot("places-route.png");

  assert.deepEqual(errors, []);
  console.log("PASS places map: saved places, nearby/category/text POI search, token save, activity prefill, day route with straight-line fallback and road route. API fixtures only.");
} catch (error) {
  console.error(error);
  await page.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
