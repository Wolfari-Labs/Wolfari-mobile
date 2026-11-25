import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { dynamicQr, staticQr } from "../fixtures/payment-qr.mjs";

// Every API request is intercepted. This suite never modifies a real trip/account.
const appUrl = process.env.WOLFARI_PREVIEW_URL ?? "http://localhost:8082";
let executablePath;
for (const candidate of [process.env.WOLFARI_BROWSER_PATH,
  chromium.executablePath(), "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean)) {
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
const fundId = "50000000-0000-4000-8000-000000000001";
let fundPresent = true, expenseCount = 0;
let activeUser = userId, editable = true, version = 1, qrSandboxUnavailable = true, qrSandboxNotConfigured = false;
const membership = { id: "30000000-0000-4000-8000-000000000001", trip_id: tripId, user_id: userId, role: "OWNER", joined_at: "2026-10-01T00:00:00Z", left_at: null };
const trip = { id: tripId, name: "Đà Nẵng cùng nhau", description: null, public_description: null, start_at: "2026-11-11T17:00:00Z", end_at: "2026-11-14T16:59:00Z", timezone: "Asia/Ho_Chi_Minh", lifecycle: "UPCOMING", archived_at: null, plan_edit_policy: "ALL_MEMBERS", plan_version: 1, membership_revision: 1, export_revision: 1, current_membership: membership, permissions: { can_read: true, can_update: true } };
const calls = [], errors = [];
const walletOrder = "251125_w" + "c".repeat(24);
let walletPaid = false, walletReturn = "";
await context.route("**/api/v1/**", async route => {
  const req = route.request(), url = new URL(req.url()), pathname = url.pathname.replace("/api/v1", ""), method = req.method();
  const headers = { "Access-Control-Allow-Origin": appUrl, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Type, X-CSRF-Token, Idempotency-Key", "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS" };
  const respond = data => route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify({ data, meta: {} }) });
  if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
  calls.push({ pathname, method, body: req.postData() ? req.postDataJSON() : null });
  if (pathname === "/auth/csrf") return respond({ csrf_token: "fixture" });
  if (pathname === "/auth/refresh" || pathname === "/auth/login") return respond({ access_token: "fixture-access", token_type: "Bearer", expires_in: 900, profile: { id: activeUser, email: "fixture@example.test", full_name: "Người kiểm thử", avatar: null, system_role: "USER", status: "ACTIVE", email_verified_at: null, version: 1 } });
  if (pathname === `/trips/${tripId}/fund` && fundPresent) return respond({
    id: fundId, trip_id: tripId, holder_user_id: userId, currency: 'VND', status: 'OPEN',
    budget_amount: null, current_balance: '0', reserved_refund: '0', available_balance: '0',
    finance_version: 1, closed_at: null,
  });
  if (pathname === `/trips/${tripId}/members`) return respond({ items: [membership], next_cursor: null });
  if (pathname === `/funds/${fundId}/destinations`) return respond([]);
  if (pathname === `/trips/${tripId}/qr-payments/momo-sandbox` && method === 'POST') {
    const body = req.postDataJSON();
    assert.deepEqual(Object.keys(body).sort(), ['amount', 'note', 'request_id']);
    assert.equal(req.headers()['idempotency-key'], body.request_id);
    if (qrSandboxNotConfigured) return route.fulfill({ status: 503, headers, contentType: 'application/json', body: JSON.stringify({ error: { code: 'PAYMENT_PROVIDER_NOT_CONFIGURED', retryable: false }, meta: {} }) });
    if (qrSandboxUnavailable) return route.fulfill({ status: 503, headers, contentType: 'application/json', body: JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE' }, meta: {} }) });
    return respond({ request_id: body.request_id, order_id: 'wqr-' + 'a'.repeat(40), amount: body.amount, payment_url: 'https://test-payment.momo.vn/v2/gateway/pay?t=qr-fixture', environment: 'SANDBOX' });
  }
  const wallet = /^\/trips\/[^/]+\/qr-payments\/(momo-checkout)$/.exec(pathname)?.[1];
  if (wallet && pathname.startsWith(`/trips/${tripId}/`) && method === 'POST') {
    const body = req.postDataJSON();
    assert.deepEqual(Object.keys(body).sort(), ['amount', 'note', 'redirect_url', 'request_id']);
    assert.equal(req.headers()['idempotency-key'], body.request_id);
    const page = new URL(body.redirect_url);
    assert.match(page.pathname, /^\/api\/v1\/qr-payments\/payment-return\/[A-Za-z0-9_-]+$/);
    walletReturn = Buffer.from(page.pathname.split('/').at(-1), 'base64url').toString('utf8');
    return route.fulfill({ status: 201, headers, contentType: 'application/json', body: JSON.stringify({ data: { request_id: body.request_id, order_id: walletOrder, amount: body.amount, payment_url: 'https://test-payment.momo.vn/v2/gateway/pay?t=fixture', environment: 'SANDBOX' }, meta: {} }) });
  }
  if (new RegExp(`^/trips/${tripId}/qr-payments/momo-checkout/${walletOrder}$`).test(pathname) && method === 'GET')
    return respond({ order_id: walletOrder, status: walletPaid ? 'PAID' : 'PENDING', amount: '20000', provider_transaction_id: walletPaid ? '251125000123' : null, environment: 'SANDBOX' });
  if (pathname === `/funds/${fundId}/expenses` && method === "POST") {
    const body = req.postDataJSON(), id = "60000000-0000-4000-8000-00000000000" + (++expenseCount);
    return respond({ id, fund_id: fundId, title: body.title, amount: body.amount, description: body.description, category: body.category, status: "DRAFT", created_by_user_id: activeUser, receipt_available: false, submitted_at: null, paid_at: body.paid_at, payment_method: body.payment_method, paid_by_user_id: null, confirmed_at: null, confirmed_by_user_id: null, rejected_reason: null, created_at: "2026-11-25T03:13:00Z", updated_at: "2026-11-25T03:13:00Z", version: 1, finance_version: body.expected_finance_version + 1 });
  }
  const expenseAction = /^\/expenses\/([^/]+)(?:\/(submit|confirm))?$/.exec(pathname);
  if (expenseAction && method !== "GET") {
    const body = req.postData() ? req.postDataJSON() : {};
    if (method === "DELETE") return respond({ id: expenseAction[1], deleted: true });
    const status = expenseAction[2] === "submit" ? "SUBMITTED" : "CONFIRMED";
    return respond({ id: expenseAction[1], fund_id: fundId, title: "x", amount: "180000", description: null, category: "Di chuyển", status, created_by_user_id: activeUser, receipt_available: false, submitted_at: "2026-11-25T03:14:00Z", paid_at: body.paid_at ?? null, payment_method: body.payment_method ?? null, paid_by_user_id: null, confirmed_at: null, confirmed_by_user_id: null, rejected_reason: null, created_at: "2026-11-25T03:13:00Z", updated_at: "2026-11-25T03:14:00Z", version: body.expected_version + 1, finance_version: body.expected_finance_version + 1 });
  }
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
// Only assert external handoff URLs. Never contact VietQR or MoMo from this suite.
await context.route('https://cdn.vietqr.io/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#1e40af"/><circle cx="32" cy="32" r="16" fill="#fbbf24"/></svg>' }));
await context.route('https://dl.vietqr.io/**', route => route.fulfill({ status: 200, body: 'Bank handoff fixture' }));
await context.route('https://test-payment.momo.vn/**', route => route.fulfill({ status: 200, body: 'MoMo handoff fixture' }));
page.setDefaultTimeout(30_000);
page.setDefaultNavigationTimeout(120_000);
page.on("pageerror", error => errors.push(error.message));
const button = name => page.getByRole("button", { name, exact: true });
const field = name => page.getByLabel(name, { exact: true });
const tab = name => page.getByRole("tab", { name, exact: true });
const goto = async route => { await page.goto(appUrl + route, { waitUntil: "networkidle" }); };
const tripRoute = suffix => "/trip/" + tripId + "/" + suffix;
const output = path.resolve(".cache/visual/mobile-parity");
await mkdir(output, { recursive: true });
async function screenshot(name) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal page overflow");
  await page.screenshot({ path: path.join(output, name + ".png") });
}
try {
  await goto("/trips");
  await field("Tìm chuyến đi").fill("da nang");
  await button("Mở chuyến đi Đà Nẵng cùng nhau").waitFor();
  await field("Tìm chuyến đi").fill("da lat");
  // The second page is fetched automatically; there is no "load more" step while searching.
  await button("Mở chuyến đi Đà Lạt mùa đông").waitFor();
  assert.ok(calls.some(call => call.pathname === "/trips" && call.method === "GET"), "Trip list loaded");
  await screenshot("trip-search");

  await goto(tripRoute("packing"));
  await page.getByText("Giấy tờ chung", { exact: true }).waitFor();
  assert.equal(await page.getByText(/Bản nháp riêng/).count(), 0, "Packing has no device-only draft mode");
  await screenshot("packing");

  // The shared list is covered by dress-code-flow; a server without the capability only explains why.
  await goto(tripRoute("dress-code"));
  await page.getByText(/chưa hỗ trợ dress code dùng chung/).waitFor();
  assert.equal(await button("Thêm dress code").count(), 0, "No device-only dress code drafts");
  await screenshot("dress-code");

  fundPresent = false;
  await goto(tripRoute('fund'));
  await page.getByText('Quỹ chung cho cả nhóm', { exact: true }).waitFor();
  assert.equal(await button('Quét QR thanh toán').count(), 0, 'A trip without a fund cannot offer fund payments.');
  fundPresent = true;
  await goto(tripRoute('fund'));
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
  // Scan → check → open the bank with everything filled in → the payment is kept as a fund expense.
  await page.getByText("Kiểm tra khoản chi", { exact: true }).waitFor();
  await page.getByText(/· 0011012345678$/).waitFor();
  await page.getByText("180.000đ", { exact: true }).waitFor();
  await page.getByText("Số tiền theo mã QR", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Ghi chú", { exact: true }).inputValue(), "thanh toan don hang");
  assert.equal(await button("1").count(), 0, "A fixed QR amount has no keypad");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("radio", { name: "Di chuyển", exact: true }).click();
  await screenshot("quick-transfer-check");
  await button("Chuyển khoản").click();
  await page.getByText(/Số tiền lớn hơn quỹ khả dụng/).waitFor(); // a note, not an error
  await page.getByRole("radio", { name: "VietinBank", exact: true }).click();
  await page.getByText(/VietinBank sẽ điền sẵn người nhận, số tiền và nội dung/).waitFor();
  await screenshot("quick-transfer-source");
  const bankPopupPromise = context.waitForEvent("page");
  await button("Mở VietinBank để chuyển").click();
  const bankPopup = await bankPopupPromise;
  await bankPopup.waitForLoadState();
  const bankLink = new URL(bankPopup.url());
  assert.equal(bankLink.origin, "https://dl.vietqr.io");
  assert.deepEqual([bankLink.searchParams.get("app"), bankLink.searchParams.get("am"), bankLink.searchParams.get("tn")], ["icb", "180000", "thanh toan don hang"]);
  assert.match(bankLink.searchParams.get("ba"), /^0011012345678@/);
  await bankPopup.close();
  const created = calls.find(call => call.pathname === `/funds/${fundId}/expenses` && call.method === "POST");
  assert.equal(created.body.amount, "180000");
  assert.equal(created.body.category, "Di chuyển");
  assert.equal(created.body.payment_method, "BANK_TRANSFER");
  assert.match(created.body.description, /Tài khoản: 0011012345678[\s\S]*Chuyển qua: VietinBank/);
  await page.getByText("−180.000đ", { exact: true }).waitFor();
  await page.getByText("Chờ bạn xác nhận đã chuyển", { exact: true }).waitFor();
  assert.equal(calls.some(call => /\/expenses\/[^/]+\/(submit|confirm)$/.test(call.pathname)), false, "Nothing leaves the fund before the holder says it was paid");
  await button("Hiện mã QR để quét bằng app ngân hàng").click();
  await page.getByRole("img", { name: /Mã VietQR chuyển 180\.000đ đến 0011012345678/ }).waitFor();
  await screenshot("quick-transfer-receipt");
  await button("Đã chuyển xong · ghi chi").click();
  await page.getByText("Đã ghi chi · trừ vào quỹ", { exact: true }).waitFor();
  const actions = calls.filter(call => /\/expenses\/[^/]+\/(submit|confirm)$/.test(call.pathname)).map(call => call.pathname.split("/").at(-1));
  assert.deepEqual(actions, ["submit", "confirm"]);
  assert.equal(calls.find(call => call.pathname.endsWith("/confirm")).body.payment_method, "BANK_TRANSFER");
  await button("Xong").click();
  // An open-only bank copies the note; deleting a draft leaves the fund untouched.
  await button("Quét QR thanh toán").click();
  await button("Dán nội dung QR").click();
  await field("Nội dung QR").fill(staticQr);
  await button("Đọc thông tin QR").click();
  for (const key of ["5", "0", "000"]) await button(key).click();
  await page.getByText("50.000đ", { exact: true }).waitFor();
  await button("Chuyển khoản").click();
  await page.getByRole("radio", { name: "Vietcombank", exact: true }).click();
  const vcbPopup = context.waitForEvent("page");
  await button("Mở Vietcombank để chuyển").click();
  await (await vcbPopup).close();
  await page.getByText(/Wolfari đã sao chép nội dung chuyển khoản/).waitFor();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /^Chuyển khoản/);
  await button("Chưa chuyển · xoá khoản này").click();
  await page.getByText("Đã xoá", { exact: true }).waitFor();
  assert.equal(calls.filter(call => call.method === "DELETE" && call.pathname.startsWith("/expenses/")).length, 1);
  // Sandbox build: a stand-in bank app takes over the screen; its success records the expense by itself.
  await button("Chuyển khoản mới").click();
  await button("Dán nội dung QR").click();
  await field("Nội dung QR").fill(staticQr);
  await button("Đọc thông tin QR").click();
  for (const key of ["2", "0", "000"]) await button(key).click();
  await button("Chuyển khoản").click();
  await page.getByRole("radio", { name: "Ngân hàng thử", exact: true }).click();
  const pagesBefore = context.pages().length;
  const confirmsBefore = calls.filter(call => call.method === "POST" && /\/expenses\/[^/]+\/confirm$/.test(call.pathname)).length;
  await button("Mở Ngân hàng thử để chuyển").click();
  await page.getByLabel("Đang mở Ngân hàng thử").waitFor();
  assert.equal(context.pages().length, pagesBefore, "The test bank never leaves the app");
  await button("Đăng nhập bằng vân tay").click();
  await button("Tiếp tục").click();
  await page.getByText("20.000đ", { exact: true }).first().waitFor();
  assert.equal(await button("Xác nhận chuyển").isDisabled(), true);
  await page.getByLabel("Mã OTP", { exact: true }).fill("000000");
  await screenshot("quick-transfer-test-bank");
  await button("Xác nhận chuyển").click();
  await page.getByText("Giao dịch thành công", { exact: true }).waitFor();
  await screenshot("quick-transfer-test-bank-done");
  await button("Quay về Wolfari").click();
  await page.getByText("Đã ghi chi · trừ vào quỹ", { exact: true }).waitFor();
  await page.getByText(/^FT\d{14}$/).waitFor();
  assert.equal(calls.filter(call => call.method === "POST" && /\/expenses\/[^/]+\/confirm$/.test(call.pathname)).length, confirmsBefore + 1, "Bank success confirms once, with no extra tap");
  // Cancelling in the bank keeps the draft and asks, like coming back from a real bank app.
  await button("Chuyển khoản mới").click();
  await button("Dán nội dung QR").click();
  await field("Nội dung QR").fill(staticQr);
  await button("Đọc thông tin QR").click();
  for (const key of ["2", "0", "000"]) await button(key).click();
  await button("Chuyển khoản").click();
  await page.getByRole("radio", { name: "Ngân hàng thử", exact: true }).click();
  await button("Mở Ngân hàng thử để chuyển").click();
  await button("Huỷ giao dịch").click();
  await page.getByText(/Bạn vừa quay lại từ Ngân hàng thử/).waitFor();
  await button("Chưa chuyển · xoá khoản này").click();
  await page.getByText("Đã xoá", { exact: true }).waitFor();
  // MoMo test gateway: Wolfari records the expense only after MoMo reports the order PAID.
  await button("Chuyển khoản mới").click();
  await button("Dán nội dung QR").click();
  await field("Nội dung QR").fill(staticQr);
  await button("Đọc thông tin QR").click();
  for (const key of ["2", "0", "000"]) await button(key).click();
  await button("Chuyển khoản").click();
  assert.equal(await page.getByRole("radio", { name: "ZaloPay", exact: true }).count(), 0);
  await page.getByRole("radio", { name: "MoMo", exact: true }).click();
  const momoPopup = context.waitForEvent("page");
  await button("Mở MoMo để chuyển").click();
  const momoGateway = await momoPopup;
  assert.equal(new URL(momoGateway.url()).hostname, "test-payment.momo.vn");
  assert.match(walletReturn, /payment-return$/);
  await momoGateway.close();
  await button("Kiểm tra thanh toán MoMo").click();
  await page.getByText(/MoMo chưa báo thanh toán xong/).waitFor();
  walletPaid = true;
  await button("Kiểm tra thanh toán MoMo").click();
  await page.getByText("Đã ghi chi · trừ vào quỹ", { exact: true }).waitFor();
  await page.getByText("251125000123", { exact: true }).waitFor();
  await screenshot("quick-transfer-momo-paid");
  await page.setViewportSize({ width: 360, height: 740 });
  await screenshot("payment-qr-review-small-phone");
  await button("Đóng").click();
  await button("Quét QR thanh toán").click();
  assert.equal(await page.getByText(/0011012345678/).count(), 0, "Closed scans do not persist");
  await page.evaluate(() => { qrFixture.deny = false; });
  await button("Cho phép camera").click();
  await page.waitForFunction(() => !!document.querySelector("video")?.videoWidth);
  await screenshot("payment-qr-camera");
  // Two different detections from the same frame: only the first can win.
  await page.evaluate(codes => { qrFixture.codes = codes; }, [staticQr, dynamicQr]);
  await page.getByText(/· 0099999999$/).waitFor();
  assert.equal(await page.getByText(/0011012345678/).count(), 0);
  await button("1").waitFor(); // a QR without an amount opens the keypad
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
  await goto(tripRoute("places"));
  await page.getByText("Bãi biển", { exact: true }).waitFor();
  // Without the shared-location capability nothing is offered as a device-only substitute.
  await page.getByText(/Máy chủ chưa hỗ trợ lưu địa điểm/).waitFor();
  assert.equal(await page.getByText(/trên thiết bị/).count(), 0, "No device-only place controls");
  assert.equal(await button("Thêm địa điểm cho nhóm").count(), 0);
  await screenshot("places");
  editable = false;
  await goto(tripRoute("packing"));
  await page.getByText("Giấy tờ chung", { exact: true }).waitFor();
  assert.equal(await button("Thêm vật dụng").count(), 0);
  editable = true;

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
  assert.equal(await field("Ngân sách dự kiến (VND)").inputValue(), "3.000.000");
  await page.setViewportSize({ width: 360, height: 740 });
  await screenshot("create-small-phone");
  await button("Tạo chuyến đi").click();
  await button("Mở chuyến đi").click();
  await page.waitForURL("**/trip/" + tripId);
  const create = calls.find(call => call.pathname === "/trips" && call.method === "POST");
  for (const key of ["client_request_id", "end_at", "name", "start_at", "timezone"]) assert.ok(key in create.body, key);
  for (const key of ["members", "style", "template", "destination"]) assert.equal(key in create.body, false, key + " is not a Trip field");
  assert.match(create.body.client_request_id, /^[0-9a-f-]{36}$/i);
  assert.equal(await page.evaluate(() => Object.keys(localStorage).some(key => key.includes(":new-trip:create"))), false);
  const writes = calls.filter(call => call.pathname.startsWith("/trips") && call.method !== "GET" && !/\/qr-payments\/(?:momo-sandbox|momo-checkout)$/.test(call.pathname));
  assert.equal(writes.length, 1, "All parity edits except explicit Create Trip stay local");
  assert.deepEqual(errors, []);
  console.log("Mobile parity UI passed: trip search across pages, shared packing and places without device drafts, dress-code drafts, fund QR handoff, viewer permissions, create-trip request, 360px layout.");
} finally { await browser.close(); }
