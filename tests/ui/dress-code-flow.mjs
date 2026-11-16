import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

// Every API request is intercepted. This suite never modifies a real trip/account.
const appUrl = process.env.WOLFARI_PREVIEW_URL ?? "http://localhost:8082";
let executablePath;
for (const candidate of [process.env.WOLFARI_BROWSER_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean)) {
  if (await access(candidate).then(() => true, () => false)) { executablePath = candidate; break; }
}
assert.ok(executablePath);
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 402, height: 874 }, reducedMotion: "reduce" });
const tripId = "20000000-0000-4000-8000-000000000001";
const userId = "10000000-0000-4000-8000-000000000001";
const activityId = "40000000-0000-4000-8000-000000000001";
const membership = { id: "30000000-0000-4000-8000-000000000001", trip_id: tripId, user_id: userId, role: "OWNER", joined_at: "2026-10-01T00:00:00Z", left_at: null };
const trip = { id: tripId, name: "Đà Nẵng cùng nhau", description: null, public_description: null, start_at: "2026-11-11T17:00:00Z", end_at: "2026-11-14T16:59:00Z", timezone: "Asia/Ho_Chi_Minh", lifecycle: "UPCOMING", archived_at: null, plan_edit_policy: "OWNER_ONLY", plan_version: 1, export_revision: 1, membership_revision: 1, current_membership: membership };
// The fixture is a small server: writes change rows and raise the Plan version like API051–053.
const server = { version: 3, editable: true, capability: true, conflictNext: false, rows: [{ id: "50000000-0000-4000-8000-000000000001", trip_id: tripId, scope_type: "TRIP", plan_date: null, activity_id: null, label: "Thoải mái", description: "Giày thể thao", public_description: null, source: "MANUAL" }] };
const calls = [], errors = [];
await context.route("**/api/v1/**", async route => {
  const req = route.request(), url = new URL(req.url()), pathname = url.pathname.replace("/api/v1", ""), method = req.method();
  const headers = { "Access-Control-Allow-Origin": appUrl, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Type, X-CSRF-Token, Idempotency-Key", "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS" };
  const respond = (data, status = 200) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify({ data, meta: {} }) });
  const fail = (status, code, details = null) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify({ error: { code, message: code, details }, meta: {} }) });
  if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
  const body = req.postData() ? req.postDataJSON() : null;
  calls.push({ pathname, method, body, key: req.headers()["idempotency-key"] });
  if (pathname === "/auth/csrf") return respond({ csrf_token: "fixture" });
  if (pathname === "/auth/refresh" || pathname === "/auth/login") return respond({ access_token: "fixture-access", token_type: "Bearer", expires_in: 900, profile: { id: userId, email: "fixture@example.test", full_name: "Người kiểm thử", avatar: null, version: 1 } });
  if (pathname === "/me") return respond({ id: userId, email: "fixture@example.test", full_name: "Người kiểm thử", avatar: null, version: 1 });
  if (pathname === "/trips/" + tripId) return respond(trip);
  if (pathname.endsWith("/plan")) return respond({
    trip_id: tripId, plan_version: server.version, export_revision: server.version,
    activities: [{ id: activityId, trip_id: tripId, title: "Chùa Linh Ứng", description: null, public_description: null, activity_type: "OTHER", selected_location_id: null, starts_at: null, ends_at: null, position: 0, status: "TODO", source: "MANUAL", plan_version: server.version }],
    selected_locations: [], packing_items: [],
    dress_codes: server.rows.map(row => ({ ...row, plan_version: server.version })),
    permissions: { can_read: true, can_edit: server.editable, can_complete: server.editable },
    ...(server.capability ? { capabilities: { dress_codes_write: true } } : {}),
  });
  const dress = /\/dress-codes(?:\/([^/]+))?$/.exec(pathname);
  if (dress && method !== "GET") {
    if (server.conflictNext) { server.conflictNext = false; server.version++; return fail(409, "VERSION_CONFLICT", { plan_version: server.version }); }
    if (body.expected_plan_version !== server.version) return fail(409, "VERSION_CONFLICT", { plan_version: server.version });
    server.version++;
    if (method === "DELETE") { server.rows = server.rows.filter(row => row.id !== dress[1]); return respond({ trip_id: tripId, plan_version: server.version, export_revision: server.version }); }
    const { expected_plan_version: _version, ...fields } = body;
    if (method === "POST") {
      const row = { id: "50000000-0000-4000-8000-00000000000" + (server.rows.length + 2), trip_id: tripId, public_description: null, source: "MANUAL", ...fields };
      server.rows.push(row);
      return respond({ ...row, plan_version: server.version }, 201);
    }
    const row = server.rows.find(item => item.id === dress[1]);
    Object.assign(row, fields);
    return respond({ ...row, plan_version: server.version });
  }
  return fail(404, "RESOURCE_NOT_FOUND");
});
const page = await context.newPage();
page.setDefaultTimeout(30_000);
page.setDefaultNavigationTimeout(120_000);
page.on("pageerror", error => errors.push(error.message));
const button = name => page.getByRole("button", { name, exact: true });
const field = name => page.getByLabel(name, { exact: true });
const tab = name => page.getByRole("tab", { name, exact: true });
const text = value => page.getByText(value, { exact: true });
const goto = async route => { await page.goto(appUrl + route, { waitUntil: "networkidle" }); };
const output = path.resolve(".cache/visual/dress-code");
await mkdir(output, { recursive: true });
async function screenshot(name) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal page overflow");
  await page.screenshot({ path: path.join(output, name + ".png") });
}
const writes = () => calls.filter(call => call.pathname.includes("/dress-codes") && call.method !== "GET");
try {
  await goto("/trip/" + tripId + "/dress-code");
  await text("Thoải mái").waitFor();
  assert.equal(await text("Bản nháp trên thiết bị · Riêng tài khoản này · Không đồng bộ với nhóm, tự hết hạn sau 30 ngày.").count(), 0, "Server mode has no device-draft notice");
  await screenshot("list");

  // Validation happens before any request.
  await button("Thêm dress code").click();
  await button("Thêm cho cả nhóm").click();
  await text("Nhập tên dress code.").waitFor();
  assert.equal(writes().length, 0);

  // Create for one day.
  await field("Tên dress code").fill("Trắng bên biển");
  await tab("Theo ngày").last().click();
  await tab("13/11").click();
  await field("Mô tả trang phục").fill("Áo trắng, quần be");
  await screenshot("form-day");
  await button("Thêm cho cả nhóm").click();
  await text("Đã thêm dress code cho cả nhóm.").waitFor();
  await text("Trắng bên biển").waitFor();
  await text("Ngày 13/11").waitFor();
  assert.deepEqual(writes()[0].body, { scope_type: "DAY", plan_date: "2026-11-13", activity_id: null, label: "Trắng bên biển", description: "Áo trắng, quần be", expected_plan_version: 3 });
  assert.match(writes()[0].key, /^[0-9a-f-]{36}$/i);

  // Edit: move it to an activity; the day reference is cleared explicitly.
  await button("Sửa Trắng bên biển").click();
  await tab("Hoạt động").last().click();
  await button("Lưu thay đổi").click();
  await text("Đã lưu thay đổi cho cả nhóm.").waitFor();
  await text("Chùa Linh Ứng").waitFor();
  const patch = writes()[1];
  assert.equal(patch.method, "PATCH");
  assert.deepEqual([patch.body.scope_type, patch.body.plan_date, patch.body.activity_id, patch.body.expected_plan_version], ["ACTIVITY", null, activityId, 4]);

  // Suggestions: November in Đà Nẵng defaults to the rainy season; a pick only fills the form.
  await button("Thêm dress code").click();
  await button("Dùng gợi ý Gọn nhẹ ngày mưa").waitFor();
  await button("Dùng gợi ý Trắng – xanh biển").waitFor();
  await tab("Nắng nóng").click();
  await button("Dùng gợi ý Mát mẻ ngày nắng").click();
  assert.equal(await field("Tên dress code").inputValue(), "Mát mẻ ngày nắng");
  assert.match(await field("Mô tả trang phục").inputValue(), /^Tông màu: trắng, be, xanh nhạt./);
  assert.equal(writes().length, 2, "Picking a suggestion does not save");
  await screenshot("suggestions");
  await button("Đóng").click();

  // Filter by scope.
  await tab("Cả chuyến").click();
  await text("Thoải mái").waitFor();
  assert.equal(await text("Trắng bên biển").count(), 0);
  await tab("Tất cả").click();

  // A stale Plan shows the server message and offers the latest Plan; nothing is lost silently.
  server.conflictNext = true;
  await button("Xóa Thoải mái").click();
  await button("Xóa dress code").click();
  await button("Tải kế hoạch mới nhất").waitFor();
  await screenshot("conflict");
  await button("Tải kế hoạch mới nhất").click();
  await text("Thoải mái").waitFor();
  await button("Xóa Thoải mái").click();
  await button("Xóa dress code").click();
  await text("Đã xóa dress code.").waitFor();
  assert.equal(await text("Thoải mái").count(), 0);
  assert.deepEqual(writes().at(-1).body, { expected_plan_version: server.version - 1 });

  // Viewers read the shared list without any write control.
  server.editable = false;
  await goto("/trip/" + tripId + "/dress-code");
  await text("Trắng bên biển").waitFor();
  assert.equal(await button("Thêm dress code").count(), 0);
  assert.equal(await button("Sửa Trắng bên biển").count(), 0);
  await screenshot("viewer");

  // An older backend without the capability keeps the device-draft experience.
  server.capability = false;
  server.editable = true;
  const before = writes().length;
  await goto("/trip/" + tripId + "/dress-code");
  await text("Bản nháp trên thiết bị · Riêng tài khoản này · Không đồng bộ với nhóm, tự hết hạn sau 30 ngày.").waitFor();
  assert.equal(writes().length, before);
  assert.deepEqual(errors, []);
  console.log("Dress code UI passed: server list, validation, create/edit/delete, scope filter, version conflict recovery, viewer mode, draft fallback, 402px layout.");
} finally { await browser.close(); }
