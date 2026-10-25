import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { dynamicQr, staticQr } from "../fixtures/payment-qr.mjs";

// Every API request is intercepted. This suite never modifies a real trip/account.
const appUrl = process.env.WOLFARI_PREVIEW_URL ?? "http://localhost:8082";
let executablePath;
for (const candidate of [process.env.WOLFARI_BROWSER_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean)) {
  if (await access(candidate).then(() => true, () => false)) { executablePath = candidate; break; }
}
assert.ok(executablePath);
const browser = await chromium.launch({ executablePath, headless: true, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
const context = await browser.newContext({ viewport: { width: 402, height: 874 }, reducedMotion: "reduce" });
await context.addInitScript(() => {
  // Only the hardware/decoder boundary is simulated; the real Expo CameraView,
  // scan callback, parser, permission UI and review component run unchanged.
  const fixture = { deny: true, codes: [], streams: [], requests: 0, mountError: false };
  globalThis.qrFixture = fixture;
  const query = navigator.permissions.query.bind(navigator.permissions);
  navigator.permissions.query = descriptor => descriptor.name === "camera"
    ? Promise.resolve({ state: fixture.deny ? "denied" : "granted" }) : query(descriptor);
  const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async constraints => {
    fixture.requests++;
    if (fixture.deny) throw new DOMException("Fixture permission denied", "NotAllowedError");
    if (fixture.mountError) throw new DOMException("Fixture camera busy", "NotReadableError");
    const stream = await getUserMedia(constraints);
    fixture.streams.push(stream);
    return stream;
  };
  globalThis.BarcodeDetector = class {
    static async getSupportedFormats() { return ["qr_code"]; }
    async detect() {
      return fixture.codes.splice(0).map(rawValue => ({ rawValue, format: "qr_code", boundingBox: { x: 0, y: 0, width: 100, height: 100 }, cornerPoints: [] }));
    }
  };
});
const tripId = "20000000-0000-4000-8000-000000000001";
const secondId = "20000000-0000-4000-8000-000000000002";
const userId = "10000000-0000-4000-8000-000000000001";
let activeUser = userId, editable = true, version = 1;
const membership = { id: "30000000-0000-4000-8000-000000000001", trip_id: tripId, user_id: userId, role: "OWNER", joined_at: "2026-10-01T00:00:00Z", left_at: null };
const trip = { id: tripId, name: "Đà Nẵng cùng nhau", description: null, public_description: null, start_at: "2026-11-11T17:00:00Z", end_at: "2026-11-14T16:59:00Z", timezone: "Asia/Ho_Chi_Minh", lifecycle: "UPCOMING", archived_at: null, plan_edit_policy: "ALL_MEMBERS", plan_version: 1, membership_revision: 1, export_revision: 1, current_membership: membership, permissions: { can_read: true, can_update: true } };
const calls = [], errors = [];
await context.route("**/api/v1/**", async route => {
  const req = route.request(), url = new URL(req.url()), pathname = url.pathname.replace("/api/v1", ""), method = req.method();
  const headers = { "Access-Control-Allow-Origin": appUrl, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Type, X-CSRF-Token, Idempotency-Key", "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS" };
  const respond = data => route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify({ data, meta: {} }) });
  if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
  calls.push({ pathname, method, body: req.postData() ? req.postDataJSON() : null });
  if (pathname === "/auth/csrf") return respond({ csrf_token: "fixture" });
  if (pathname === "/auth/refresh" || pathname === "/auth/login") return respond({ access_token: "fixture-access", token_type: "Bearer", expires_in: 900, profile: { id: activeUser, email: "fixture@example.test", full_name: "Người kiểm thử", avatar: null, system_role: "USER", status: "ACTIVE", email_verified_at: null, version: 1 } });
  if (pathname === "/trips") {
    if (method === "POST") return respond({ ...trip, ...req.postDataJSON() });
    return respond(url.searchParams.has("cursor") ? { items: [{ ...trip, id: secondId, name: "Đà Lạt mùa đông" }], next_cursor: null } : { items: [trip], next_cursor: "second" });
  }
  if (pathname.endsWith("/plan")) return respond({
    trip_id: pathname.includes(secondId) ? secondId : tripId, plan_version: version, export_revision: version,
    activities: [{ id: "activity-1", trip_id: tripId, title: "Ăn sáng cùng nhóm", description: null, public_description: null, activity_type: "OTHER", selected_location_id: "location-1", starts_at: null, ends_at: null, position: 0, status: "TODO", source: "MANUAL", plan_version: version }],
    selected_locations: [{ id: "location-1", name: "Bãi biển", address: "Đà Nẵng", latitude: "16.05", longitude: "108.2", source: "MANUAL" }],
    packing_items: [{ id: "packing-1", name: "Giấy tờ chung", quantity: "1", unit: "bộ", note: null, category: "Giấy tờ", assigned_member_id: null, due_at: null, status: "TODO" }],
    dress_codes: [],
    permissions: { can_read: true, can_edit: editable, can_complete: editable },
  });
  if (pathname === "/trips/" + tripId || pathname === "/trips/" + secondId) return respond({ ...trip, id: pathname.split("/").at(-1) });
  return route.fulfill({ status: 404, headers, contentType: "application/json", body: JSON.stringify({ error: { code: "RESOURCE_NOT_FOUND", message: "Fixture unavailable" }, meta: {} }) });
});
const page = await context.newPage();
page.setDefaultTimeout(30_000);
page.setDefaultNavigationTimeout(120_000);
page.on("pageerror", error => errors.push(error.message));
const button = name => page.getByRole("button", { name, exact: true });
const field = name => page.getByLabel(name, { exact: true });
const tab = name => page.getByRole("tab", { name, exact: true });
const goto = async route => { await page.goto(appUrl + route, { waitUntil: "networkidle" }); };
const tripRoute = suffix => "/trip/" + tripId + "/" + suffix;
const saveDraft = async () => { await button("Lưu bản nháp").click(); await page.getByText("Đã lưu bản nháp trên thiết bị này.", { exact: true }).waitFor(); };
const output = path.resolve(".cache/visual/mobile-parity");
await mkdir(output, { recursive: true });
async function screenshot(name) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal page overflow");
  await page.screenshot({ path: path.join(output, name + ".png") });
}
try {
  await goto("/trips");
  await field("Tìm chuyến đi đã tải").fill("da nang");
  await button("Mở chuyến đi Đà Nẵng cùng nhau").waitFor();
  await field("Tìm chuyến đi đã tải").fill("da lat");
  await button("Xem thêm chuyến đi").click();
  await button("Mở chuyến đi Đà Lạt mùa đông").waitFor();
  await screenshot("trip-search");

  await goto(tripRoute("packing"));
  await button("Thêm vật dụng").click();
  await field("Tên vật dụng").fill("Áo khoác riêng");
  await field("Số lượng").fill("0");
  await button("Lưu bản nháp").click();
  await page.getByText(/Số lượng phải lớn hơn 0/).waitFor();
  await field("Số lượng").fill("2");
  await tab("Tôi chuẩn bị").click();
  await saveDraft();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Áo khoác riêng", { exact: true }).waitFor();
  await tab("Của tôi").click();
  assert.equal(await page.getByText("Giấy tờ chung", { exact: true }).count(), 0);
  await button("Đã chuẩn bị (nháp)").click();
  await screenshot("packing");
  await button("Sửa bản nháp").click();
  await field("Ghi chú").fill("Mang thêm cho bạn");
  await saveDraft();
  // A different account or trip cannot see this private draft.
  activeUser = "10000000-0000-4000-8000-000000000002";
  await goto(tripRoute("packing"));
  await page.getByText("Giấy tờ chung", { exact: true }).waitFor();
  assert.equal(await page.getByText("Áo khoác riêng", { exact: true }).count(), 0);
  activeUser = userId;
  await goto("/trip/" + secondId + "/packing");
  await page.getByText("Giấy tờ chung", { exact: true }).waitFor();
  assert.equal(await page.getByText("Áo khoác riêng", { exact: true }).count(), 0);

  await goto(tripRoute("dress-code"));
  await button("Thêm dress code").click();
  await field("Tên dress code").fill("Trắng bên biển");
  await tab("Theo ngày").last().click();
  await button("Trắng · Be").click();
  await saveDraft();
  await tab("Theo ngày").click();
  await page.getByText("Trắng bên biển", { exact: true }).waitFor();
  await screenshot("dress-code");

  await goto(tripRoute("fund"));
  assert.equal(await page.evaluate(() => qrFixture.requests), 0, "No camera before explicit entry");
  await button("Quét QR thanh toán").click();
  await button("Cho phép camera").click();
  await button("Dán nội dung QR").click();
  await field("Nội dung QR").fill("https://untrusted.example.test/pay");
  await button("Đọc thông tin QR").click();
  await page.getByText(/Chỉ hỗ trợ VietQR chuyển khoản/).waitFor();
  assert.equal(page.url().endsWith(tripRoute("fund")), true, "QR URLs never navigate");
  await button("Dán nội dung QR").click();
  await field("Nội dung QR").fill(dynamicQr);
  await button("Đọc thông tin QR").click();
  await page.getByText("Kiểm tra thông tin chuyển khoản", { exact: true }).waitFor();
  await page.getByText("0011012345678", { exact: true }).waitFor();
  await page.getByText("180.000 ₫", { exact: true }).waitFor();
  await page.getByText("thanh toan don hang", { exact: true }).waitFor();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await button("Sao chép số tài khoản").click();
  await page.getByText("Đã sao chép số tài khoản.", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "0011012345678");
  await page.setViewportSize({ width: 360, height: 740 });
  await screenshot("payment-qr-review-small-phone");
  await button("Đóng").click();
  await button("Quét QR thanh toán").click();
  assert.equal(await page.getByText("0011012345678", { exact: true }).count(), 0, "Closed scans do not persist");
  await page.evaluate(() => { qrFixture.deny = false; });
  await button("Cho phép camera").click();
  await page.waitForFunction(() => !!document.querySelector("video")?.videoWidth);
  await screenshot("payment-qr-camera");
  // Two different detections from the same frame: only the first can win.
  await page.evaluate(codes => { qrFixture.codes = codes; }, [staticQr, dynamicQr]);
  await page.getByText("0099999999", { exact: true }).waitFor();
  assert.equal(await page.getByText("0011012345678", { exact: true }).count(), 0);
  await page.getByText(/QR chưa có số tiền/).waitFor();
  await page.waitForFunction(() => qrFixture.streams.every(stream => stream.getTracks().every(track => track.readyState === "ended")));
  await button("Quét mã khác").click();
  await page.waitForFunction(() => !!document.querySelector("video")?.videoWidth);
  await page.evaluate(code => { qrFixture.codes = [code.slice(0, -1) + "0"]; }, staticQr);
  await page.getByText(/Mã kiểm tra QR không khớp/).waitFor();
  await button("Đóng").click();
  await page.waitForFunction(() => qrFixture.streams.every(stream => stream.getTracks().every(track => track.readyState === "ended")));
  assert.equal(await page.evaluate(() => Object.values(localStorage).some(value => value.includes("0011012345678") || value.includes("0099999999"))), false, "No bank details in storage");
  await page.evaluate(() => { qrFixture.mountError = true; });
  await button("Quét QR thanh toán").click();
  await page.getByText(/Không mở được camera/).waitFor();
  await page.evaluate(() => { qrFixture.mountError = false; });
  await button("Thử lại camera").click();
  await page.waitForFunction(() => !!document.querySelector("video")?.videoWidth);
  await button("Đóng").click();
  await page.waitForFunction(() => qrFixture.streams.every(stream => stream.getTracks().every(track => track.readyState === "ended")));
  await page.setViewportSize({ width: 402, height: 874 });
  await button("Thêm khoản dự kiến").click();
  await field("Nội dung khoản dự kiến").fill("Bữa tối dự kiến");
  await field("Số tiền dự kiến (VND)").fill("250000");
  await saveDraft();
  await page.getByText("Bữa tối dự kiến", { exact: true }).waitFor();
  await tab("Lịch sử nháp").click();
  await page.getByText(/Lưu Bữa tối dự kiến/).waitFor();
  await screenshot("fund");

  await goto(tripRoute("price-watch"));
  await button("Thêm yêu cầu giá vé").click();
  await field("Điểm đi").fill("Hà Nội");
  await field("Điểm đến").fill("Đà Nẵng");
  await tab("Khứ hồi").click();
  await field("Ngày quay về").fill("2026-11-01");
  await field("Ngưỡng giá (VND)").fill("2000000");
  await button("Lưu bản nháp").click();
  await page.getByText(/Ngày về phải hợp lệ/).waitFor();
  await field("Ngày quay về").fill("2026-11-14");
  await saveDraft();
  await button("Tạm dừng yêu cầu nháp").click();
  await tab("Tạm dừng").click();
  await button("Tiếp tục yêu cầu nháp").waitFor();
  await screenshot("price-watch");

  await goto(tripRoute("places"));
  await button("Thêm địa điểm thủ công (nháp)").click();
  await field("Tên địa điểm").fill("Quán riêng trên máy");
  await field("Vĩ độ").fill("100");
  await field("Kinh độ").fill("108.2");
  await button("Lưu địa điểm trên thiết bị").click();
  await page.getByText(/Nhập đủ vĩ độ/).waitFor();
  await field("Vĩ độ").fill("16.05");
  await button("Lưu địa điểm trên thiết bị").click();
  await page.getByText("Quán riêng trên máy", { exact: true }).waitFor();
  await button("Thêm hoạt động tại đây").click();
  assert.equal(new URL(page.url()).searchParams.has("locationId"), false, "Local IDs never become backend location IDs");
  await goto(tripRoute("places"));
  await button("Lên bản nháp từ địa điểm đã chọn").click();
  await button("Thêm hoạt động nháp").click();
  await button("Quán riêng trên máy").click();
  await tab("Ngày 2 · 2026-11-13").last().click();
  await field("Giờ dự kiến").fill("25:00");
  await button("Lưu bản nháp").click();
  await page.getByText(/Giờ cần đúng định dạng/).waitFor();
  await field("Giờ dự kiến").fill("09:00");
  await saveDraft();
  await screenshot("plan-draft");
  version++;
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText(/Dữ liệu nhóm đã thay đổi/).waitFor();
  assert.equal(await button("Thêm hoạt động nháp").isDisabled(), true);
  editable = false;
  await goto(tripRoute("packing"));
  await page.getByText(/Bạn có quyền xem/).waitFor();
  assert.equal(await button("Thêm vật dụng").count(), 0);
  assert.equal(await button("Sửa bản nháp").count(), 0);
  editable = true;

  await goto(tripRoute("packing"));
  await tab("Của tôi").click();
  await button("Sửa bản nháp").click();
  await field("Ghi chú").fill("Kiểm tra lưu thất bại");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    globalThis.restoreTestStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("wolfari:draft:")) throw new Error("Fixture disk full");
      return original.call(this, key, value);
    };
  });
  await button("Lưu bản nháp").click();
  await page.getByText(/Chưa lưu được trên thiết bị/).last().waitFor();
  await page.evaluate(() => globalThis.restoreTestStorage());
  await saveDraft();
  await button("Xóa khỏi bản nháp").click();
  await button("Xác nhận bỏ bản nháp").click();
  await page.getByText("Chưa có mục phù hợp", { exact: true }).waitFor();
  assert.equal(await page.getByText("Áo khoác riêng", { exact: true }).count(), 0);
  await button("Bỏ bản nháp trên thiết bị").click();
  await button("Xác nhận bỏ bản nháp").click();
  await tab("Tất cả").click();
  await page.getByText("Giấy tờ chung", { exact: true }).waitFor();
  await page.evaluate(({ userId, tripId }) => {
    localStorage.setItem("wolfari:draft:v1:" + userId + ":" + tripId + ":packing", "{broken");
  }, { userId, tripId });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText(/Không thể đọc bản nháp/).waitFor();
  assert.equal(await button("Thêm vật dụng").isDisabled(), true);
  await button("Bỏ bản nháp trên thiết bị").click();
  await button("Xác nhận bỏ bản nháp").click();
  assert.equal(await button("Thêm vật dụng").isEnabled(), true);

  await goto("/create-trip");
  await field("Tên chuyến đi").fill("Khám phá mùa đông");
  await field("Ngày đi").fill("12/11/2026");
  await field("Ngày về").fill("14/11/2026");
  await button("Tiếp tục").click();
  await field("Ngân sách dự kiến (VND)").fill("3000000");
  await button("Lưu bản nháp chuyến đi").click();
  await page.getByText("Đã lưu bản nháp chuyến đi trên thiết bị.", { exact: true }).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await field("Tên chuyến đi").inputValue(), "Khám phá mùa đông");
  await button("Tiếp tục").click();
  assert.equal(await field("Ngân sách dự kiến (VND)").inputValue(), "3000000");
  await page.setViewportSize({ width: 360, height: 740 });
  await screenshot("create-small-phone");
  await button("Tạo chuyến đi").click();
  await page.waitForURL("**/trip/" + tripId);
  const create = calls.find(call => call.pathname === "/trips" && call.method === "POST");
  assert.deepEqual(Object.keys(create.body).sort(), ["client_request_id", "end_at", "name", "start_at", "timezone"]);
  assert.match(create.body.client_request_id, /^[0-9a-f-]{36}$/i);
  assert.equal(await page.evaluate(() => Object.keys(localStorage).some(key => key.includes(":new-trip:create"))), false);
  const writes = calls.filter(call => call.pathname.startsWith("/trips") && call.method !== "GET");
  assert.equal(writes.length, 1, "All parity edits except explicit Create Trip stay local");
  assert.deepEqual(errors, []);
  console.log("Mobile parity UI passed: eight feature groups, persistence, account/trip isolation, validation, permissions, stale plan guard, no unsupported writes, 360px layout.");
} finally { await browser.close(); }
