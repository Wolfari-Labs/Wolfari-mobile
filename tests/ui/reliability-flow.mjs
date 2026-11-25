import { assertPublicText } from "./assert-public-text.mjs";
import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

// Contract fixtures only: no emails, passwords, memberships or backend data are changed.
const appUrl = process.env.WOLFARI_PREVIEW_URL ?? "http://localhost:8082";
let executablePath;
for (const candidate of [process.env.WOLFARI_BROWSER_PATH,
  chromium.executablePath(), "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean)) {
  if (await access(candidate).then(() => true, () => false)) { executablePath = candidate; break; }
}
assert.ok(executablePath);
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 402, height: 874 }, reducedMotion: "reduce" });

const userId = "10000000-0000-4000-8000-000000000001", tripId = "20000000-0000-4000-8000-000000000001", activityId = "30000000-0000-4000-8000-000000000001";
const profile = { id: userId, full_name: "Minh Anh", email: "demo@example.test", status: "ACTIVE", system_role: "USER", version: 1, avatar: null };
let version = 1, created = false, loseReply = true;
const createRequests = [], notices = Array.from({ length: 65 }, (_, i) => ({ id: `40000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, title: `Thông báo ${i + 1}`, body: "Chuẩn bị cho chuyến đi", type: i === 0 ? "PACKING_REMINDER" : "ACTIVITY_REMINDER", trip_id: tripId, source_id: activityId, status: "AVAILABLE", created_at: new Date(Date.UTC(2027, 0, 1, 0, -i)).toISOString(), read_at: null }));
const locations = [], errors = [];
const trip = () => ({ id: tripId, name: "Chuyến đi kiểm chứng", start_at: "2027-01-01T00:00:00Z", end_at: "2027-01-03T00:00:00Z", timezone: "Asia/Ho_Chi_Minh", description: null, public_description: null, lifecycle: "UPCOMING", archived_at: null, plan_version: version, export_revision: version, membership_revision: 1, current_membership: { user_id: userId, role: "OWNER" }, permissions: { can_update: true, can_read: true } });
await context.route("**/api/v1/**", async route => {
  const request = route.request(), url = new URL(request.url()), pathname = url.pathname.replace("/api/v1", ""), method = request.method();
  const headers = { "Access-Control-Allow-Origin": appUrl, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Content-Type, X-Client-Type, Authorization, X-CSRF-Token, Idempotency-Key", "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS" };
  const respond = (data, meta = {}, status = 200) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify({ data, meta }) });
  const fail = () => route.fulfill({ status: 404, headers, contentType: "application/json", body: JSON.stringify({ error: { code: "RESOURCE_NOT_FOUND" } }) });
  if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
  const body = request.postData() ? request.postDataJSON() : undefined;
  if (pathname === "/auth/csrf") return respond({ csrf_token: "fixture" });
  if (pathname === "/auth/refresh" || pathname === "/auth/login") return respond({ session_id: activityId, access_token: "fixture", expires_in: 900, token_type: "Bearer", profile });
  if (pathname === "/trips" && method === "POST") {
    const key = request.headers()["idempotency-key"];
    createRequests.push({ key, body }); created = true;
    if (loseReply) { loseReply = false; return route.abort("failed"); }
    return respond(trip(), {}, 201);
  }
  if (pathname === "/trips") return respond({ items: created ? [trip()] : [], next_cursor: null });
  if (pathname === `/trips/${tripId}`) return respond(trip());
  if (pathname.endsWith("/plan")) return respond({ trip_id: tripId, plan_version: version, export_revision: version, activities: [{ id: activityId, trip_id: tripId, title: "Tham quan", activity_type: "CHECK_IN", description: null, public_description: null, selected_location_id: null, starts_at: null, ends_at: null, scheduled_date: null, status: "TODO", position: 0, plan_version: version }], selected_locations: locations, packing_items: [], dress_codes: [], capabilities: { locations_write: true, packing_write: true }, permissions: { can_read: true, can_edit: true, can_complete: true } });
  if (pathname.endsWith("/members")) return respond({ items: [], next_cursor: null });
  if (pathname.endsWith("/selected-locations") && method === "POST") {
    assert.equal(body.expected_plan_version, version);
    const row = { id: "50000000-0000-4000-8000-000000000001", trip_id: tripId, ...body, source: "MANUAL", metadata: { attribution: body.attribution }, plan_version: ++version };
    locations.push(row); return respond(row, {}, 201);
  }
  if (pathname === "/invitations/preview") return respond({ id: activityId, trip_name: "Hẹn ở Đà Lạt", inviter_display_name: "Trang Nguyễn", status: "PENDING", expires_at: new Date(Date.now() + (body.code === "K7PQ-4M2X" ? 86400000 : -86400000)).toISOString() });
  if (pathname === "/invitations/decline") { assert.equal(body.code, "K7PQ-4M2X"); return respond({}); }
  if (pathname === "/invitations/accept") { assert.equal(body.code, "K7PQ-4M2X"); return respond({ membership: { trip_id: tripId } }); }
  if (pathname === "/me/notifications") {
    const start = Number(url.searchParams.get("cursor") ?? "0"), limit = Number(url.searchParams.get("limit"));
    const available = notices.map((n, i) => ({ n, i })).filter(({ n, i }) => i >= start && (url.searchParams.get("unread") !== "true" || !n.read_at));
    const items = available.slice(0, limit);
    return respond(items.map(({ n }) => n), { next_cursor: available.length > limit ? String(items.at(-1).i + 1) : null });
  }
  if (/^\/me\/notifications\/[^/]+\/read$/.test(pathname)) {
    const row = notices.find(n => pathname.includes(n.id)); assert.ok(row);
    row.read_at = new Date().toISOString(); return respond(row);
  }
  return fail();
});
notices[0].created_at = new Date().toISOString();
notices[2] = { ...notices[2], type: "TRIP_INVITATION", title: "Lời mời chuyến đi", body: "K7PQ-4M2X", created_at: new Date().toISOString() };
notices[3] = { ...notices[3], type: "PRICE_DROP", title: "Giá vé vừa giảm", created_at: new Date().toISOString() };
const page = await context.newPage();
page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(120000);
page.on("pageerror", e => errors.push(e.message));
const button = name => page.getByRole("button", { name, exact: true });
try {
  await page.goto(`${appUrl}/create-trip?preview=1`, { waitUntil: "networkidle" });
  await page.getByLabel("Tên chuyến đi", { exact: true }).fill("Chuyến đi kiểm chứng");
  await page.getByLabel("Ngày đi", { exact: true }).fill("01/01/2027");
  await page.getByLabel("Ngày về", { exact: true }).fill("02/01/2027");
  await button("Tiếp tục").click(); await button("Tạo chuyến đi").click();
  await button("Gửi lại yêu cầu đã lưu").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await button("Gửi lại yêu cầu đã lưu").click();
  await button("Mở chuyến đi").click();
  await page.getByRole("tab", { name: "Tổng quan", exact: true }).waitFor();
  assert.equal(createRequests.length, 2); assert.deepEqual(createRequests[0], createRequests[1]);
  await page.goto(`${appUrl}/trip/${tripId}/activity?activityId=${activityId}&preview=1`, { waitUntil: "networkidle" });
  await button("Tùy chọn hoạt động").click();
  await page.getByRole("tab", { name: "Loại hoạt động khác", exact: true }).waitFor();
  await assertPublicText(page);
  await page.goto(`${appUrl}/trip/${tripId}/places?preview=1`, { waitUntil: "networkidle" });
  await button("Thêm địa điểm cho nhóm").click();
  await page.getByLabel("Tên địa điểm", { exact: true }).fill("Địa điểm chung");
  await page.getByLabel("Địa chỉ", { exact: true }).fill("Đà Nẵng");
  await button("Lưu địa điểm cho nhóm").click();
  await page.getByText("Địa điểm chung", { exact: true }).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Địa điểm chung", { exact: true }).waitFor(); assert.equal(locations.length, 1);
  await assertPublicText(page);
  await page.goto(`${appUrl}/notifications?preview=1`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Có gì mới?" }).waitFor();
  await page.getByText("30+ thông báo chưa đọc", { exact: true }).waitFor();
  await page.getByRole("heading", { name: "Hôm nay" }).waitFor();
  assert.equal(await page.getByText("K7PQ-4M2X", { exact: true }).count(), 0);
  await mkdir(".cache/visual/reliability", { recursive: true });
  await page.screenshot({ path: ".cache/visual/reliability/notifications.png" });
  await page.getByRole("tab", { name: "Chưa đọc", exact: true }).click();
  await page.getByRole("tab", { name: "Tất cả", exact: true }).click();
  await button("Thông báo cũ hơn").click(); await page.getByText("Thông báo 31", { exact: true }).waitFor();
  await button("Thông báo cũ hơn").click(); await page.getByText("Thông báo 65", { exact: true }).waitFor();
  await button("Tùy chọn thông báo").click();
  await button("Đánh dấu tất cả đã đọc").click();
  await page.getByText("Đã đánh dấu các thông báo đã đọc.", { exact: true }).waitFor();
  assert.equal(notices.filter(n => !n.read_at).length, 0);
  await button("Thông báo mới hơn").click(); await button("Thông báo mới hơn").click();
  await button("Thông báo 1").click(); await page.waitForURL(new RegExp(`/trip/${tripId}/packing`));
  await page.goto(`${appUrl}/notifications?preview=1`, { waitUntil: "networkidle" });
  await button("Thông báo 2").click(); await page.waitForURL(new RegExp(`/trip/${tripId}/itinerary`));
  await assertPublicText(page);
  await mkdir(".cache/visual/reliability", { recursive: true });
  await page.screenshot({ path: ".cache/visual/reliability/itinerary.png" });
  await page.goto(appUrl + "/invitation?code=K7PQ-4M2X", { waitUntil: "networkidle" });
  await page.getByText("Trang Nguyễn đã mời bạn", { exact: true }).waitFor();
  await page.getByRole("heading", { name: "Hẹn ở Đà Lạt" }).waitFor();
  await page.screenshot({ path: ".cache/visual/reliability/invitation.png" });
  await button("Từ chối").click();
  await page.getByText("Đã phản hồi lời mời.", { exact: true }).waitFor();
  await page.goto(appUrl + "/invitation?code=K7PQ-4M2X", { waitUntil: "networkidle" });
  await button("Chấp nhận lời mời").click();
  await page.waitForURL(new RegExp("/trip/" + tripId + "$"));
  await page.goto(appUrl + "/invitation?code=M7PQ-4M2X", { waitUntil: "networkidle" });
  await page.getByText("Lời mời này đã được phản hồi hoặc không còn hiệu lực.", { exact: true }).waitFor();
  assert.equal(await button("Chấp nhận lời mời").count(), 0);
  assert.deepEqual(errors, []);
  console.log("PASS durable create recovery, safe activity labels, shared places, inbox paging, mark-all and reminder navigation");
} catch (error) {
  console.error(error);
  await mkdir(".cache/visual/reliability", { recursive: true });
  await page.screenshot({ path: ".cache/visual/reliability/failure.png" }).catch(() => {});
  throw error;
} finally { await browser.close(); }
