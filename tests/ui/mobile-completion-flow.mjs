import { assertPublicText } from "./assert-public-text.mjs";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { chromium } from "playwright-core";

const appUrl = process.env.WOLFARI_PREVIEW_URL ?? "http://localhost:8082";
let executablePath;
for (const candidate of [process.env.WOLFARI_BROWSER_PATH, chromium.executablePath(), "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean))
  if (await access(candidate).then(() => true, () => false)) { executablePath = candidate; break; }
assert.ok(executablePath);
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", acceptDownloads: true });
const uid = n => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tripId = uid(1), userId = uid(2), memberId = uid(3), otherMemberId = uid(4), activityId = uid(5);
let version = 1, owner = true, archived = false, deleted = false, fundClosed = false, lostTransfer = true;
let reminders = [];
const operations = new Map(), writes = [], errors = [];
const startsAt = new Date(Date.now() + 2 * 86400000).toISOString();
const trip = () => ({ id: tripId, name: "Chuyến đi hoàn thiện", start_at: new Date(Date.now() + 86400000).toISOString(), end_at: new Date(Date.now() + 3 * 86400000).toISOString(), timezone: "Asia/Ho_Chi_Minh", lifecycle: archived ? "ARCHIVED" : "UPCOMING", plan_edit_policy: "OWNER_ONLY", plan_version: version, export_revision: version, membership_revision: version, current_membership: { id: memberId, user_id: userId, role: owner ? "OWNER" : "MEMBER" }, permissions: { can_read: true, can_update: owner && !archived } });
const cors = { "Access-Control-Allow-Origin": appUrl, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Type, X-CSRF-Token, Idempotency-Key", "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS" };
await context.route("**/api/v1/**", async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname.replace("/api/v1", ""), method = request.method();
  const respond = (data, status = 200) => route.fulfill({ headers: cors, status, contentType: "application/json", body: JSON.stringify({ data, meta: {} }) });
  const fail = (status, code) => route.fulfill({ headers: cors, status, contentType: "application/json", body: JSON.stringify({ error: { code } }) });
  if (method === "OPTIONS") return route.fulfill({ headers: cors, status: 204 });
  if (path === "/auth/refresh" || path === "/auth/login") return respond({ access_token: "fixture", token_type: "Bearer", expires_in: 900, profile: { id: userId, full_name: "Người thử", email: "fixture@example.test", version: 1 } });
  if (path === "/auth/csrf") return respond({ csrf_token: "fixture" });
  if (path === "/trips") return respond({ items: deleted ? [] : [trip()], next_cursor: null });
  if (path === `/trips/${tripId}` && method === "GET") return deleted ? fail(404, "RESOURCE_NOT_FOUND") : respond(trip());
  if (path.endsWith("/plan")) return respond({ trip_id: tripId, plan_version: version, export_revision: version, activities: [{ id: activityId, title: "Đi dạo", starts_at: startsAt, ends_at: new Date(Date.parse(startsAt) + 3600000).toISOString(), status: "TODO", position: 0, scheduled_date: null, description: null, selected_location_id: null, activity_type: "OTHER" }], selected_locations: [], packing_items: [], dress_codes: [], permissions: { can_read: true, can_edit: owner && !archived, can_complete: !archived } });
  if (path.endsWith("/members")) return respond({ items: [{ id: memberId, user_id: userId, display_name: "Chủ cũ", role: owner ? "OWNER" : "MEMBER", left_at: null }, { id: otherMemberId, user_id: uid(7), display_name: "Bạn đồng hành", role: owner ? "MEMBER" : "OWNER", left_at: null }], next_cursor: null });
  if (path.endsWith("/plan-policy")) return respond({ policy: "OWNER_ONLY", editor_member_ids: [], membership_revision: version });
  if (path.endsWith("/plan.pdf")) return route.fulfill({ headers: cors, status: 200, contentType: "application/pdf", body: Buffer.from("%PDF-1.7\nfixture-download\n%%EOF") });
  if (path.endsWith("/reminders") && method === "GET") return respond(reminders);
  if (path.endsWith("/reminders") && method === "POST") {
    const body = request.postDataJSON();
    assert.equal(body.source_type, "ACTIVITY"); assert.equal(body.source_id, activityId);
    assert.ok(Date.parse(body.remind_at) > Date.now() && Date.parse(body.remind_at) <= Date.parse(startsAt));
    assert.match(request.headers()["idempotency-key"], /^[\da-f-]{36}$/i);
    const row = { ...body, id: uid(8), trip_id: tripId, source_at: startsAt, created_at: new Date().toISOString(), status: "PENDING", last_error: null };
    reminders = [row]; return respond(row, 201);
  }
  if (path.includes("/reminders/") && method === "DELETE") { assert.equal(request.postData(), null); reminders[0].status = "CANCELLED"; return respond(reminders[0]); }
  if (path.startsWith("/operations/")) { const key = path.split("/").at(-1); return operations.has(key) ? respond({ operation_id: key, trip_id: tripId, state: "SUCCEEDED", outcome: { status: "COMMITTED" } }) : fail(404, "RESOURCE_NOT_FOUND"); }
  if (["POST", "DELETE"].includes(method) && path.startsWith(`/trips/${tripId}`)) {
    const key = request.headers()["idempotency-key"], body = request.postDataJSON();
    writes.push({ key, body, path, method });
    if (operations.has(key)) return respond(operations.get(key));
    if (!owner) return fail(403, "PERMISSION_DENIED");
    assert.equal(body.expected_plan_version, version); assert.equal(body.expected_membership_revision, version); assert.equal(body.expected_export_revision, version);
    if (!path.endsWith("/ownership") && !fundClosed) return fail(409, "FINANCE_OBLIGATION_BLOCKED");
    version++;
    if (path.endsWith("/ownership")) { assert.equal(body.new_owner_member_id, otherMemberId); owner = false; }
    else if (method === "DELETE") deleted = true;
    else archived = path.endsWith("/archive");
    const result = { id: tripId, plan_version: version, membership_revision: version, export_revision: version, ...(deleted ? { deleted: true } : {}) };
    operations.set(key, result);
    if (path.endsWith("/ownership") && lostTransfer) { lostTransfer = false; return fail(503, "SERVICE_UNAVAILABLE"); }
    return respond(result);
  }
  return fail(404, "RESOURCE_NOT_FOUND");
});
const page = await context.newPage();
page.setDefaultTimeout(30_000);
page.on("pageerror", error => errors.push(error.message));
const button = name => page.getByRole("button", { name, exact: true });
const field = name => page.getByLabel(name, { exact: true });
const open = async path => page.goto(appUrl + path, { waitUntil: "networkidle" });
try {
  await open(`/trip/${tripId}/reminders`);
  await button("Đi dạo").click();
  await button("Lưu lịch nhắc").click();
  await page.getByText("Chờ đến giờ", { exact: true }).waitFor();
  await button("Hủy lịch nhắc Đi dạo").click();
  await page.getByText("Đã hủy", { exact: true }).waitFor();
  await open(`/trip/${tripId}/export`);
  const download = page.waitForEvent("download");
  await button("Xuất kế hoạch PDF").click();
  assert.equal((await download).suggestedFilename(), "wolfari-plan-Chuy-n--i-ho-n-thi-n.pdf");

  await open(`/trip/${tripId}/manage`);
  await field("Lý do thay đổi").fill("Lưu kế hoạch đã xong");
  await button("Lưu trữ chuyến đi").click();
  await button("Xác nhận thay đổi chuyến đi").click();
  await page.getByText(/Cần đóng quỹ trước/).waitFor();
  await button("Tải lại dữ liệu").click();
  await page.getByRole("tab", { name: "Chuyển chủ", exact: true }).click();
  await button("Bạn đồng hành").click();
  await button("Chuyển chủ nhóm").click();
  await button("Xác nhận thay đổi chuyến đi").click();
  await assertPublicText(page);
  await button("Gửi lại cùng yêu cầu").click();
  await page.getByText("Thao tác đã hoàn tất trên máy chủ.", { exact: true }).waitFor();
  const transferWrites = writes.filter(write => write.path.endsWith("/ownership"));
  assert.equal(transferWrites.length, 2); assert.equal(transferWrites[0].key, transferWrites[1].key);
  await button("Hoàn tất").click();
  await page.waitForURL("**/settings");
  await open(`/trip/${tripId}/manage`);
  await page.getByText("Chỉ chủ nhóm hiện tại được thực hiện các thao tác này.", { exact: true }).waitFor();
  owner = true; fundClosed = true;
  await open(`/trip/${tripId}/manage`);
  await page.getByRole("tab", { name: "Xóa", exact: true }).click();
  await field("Lý do thay đổi").fill("Đã lưu bản PDF");
  await field("Nhập đúng tên chuyến đi để xóa").fill("Sai tên");
  assert.equal(await button("Xóa chuyến đi").isDisabled(), true);
  await field("Nhập đúng tên chuyến đi để xóa").fill(trip().name);
  await button("Xóa chuyến đi").click();
  await button("Xác nhận thay đổi chuyến đi").click();
  await page.getByText("Thao tác đã hoàn tất trên máy chủ.", { exact: true }).waitFor();
  await button("Hoàn tất").click();
  await page.waitForURL("**/trips");
  await assertPublicText(page);
  assert.deepEqual(errors, []);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log("PASS mobile completion UI: personal reminders, PDF download, Fund blocker, owner transfer/lost-reply replay, owner permissions and confirmed deletion. HTTP fixtures only.");
} catch (error) {
  console.error(page.url(), (await page.locator("body").innerText()).slice(-2200), errors);
  throw error;
} finally { await browser.close(); }
