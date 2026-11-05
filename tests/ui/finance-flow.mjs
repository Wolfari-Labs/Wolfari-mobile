import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

// Local contract fixtures only. Every Gateway request is intercepted; no real money or DB writes.
const appUrl = process.env.WOLFARI_PREVIEW_URL ?? "http://localhost:8082";
let executablePath;
for (const candidate of [process.env.WOLFARI_BROWSER_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean)) {
  if (await access(candidate).then(() => true, () => false)) { executablePath = candidate; break; }
}
assert.ok(executablePath, "A local Chromium browser is required");
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 402, height: 874 }, reducedMotion: "reduce" });
const uid = n => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000001`;
const tripId = uid(2), userId = uid(1), fundId = uid(5), memberUser = uid(4);
const owner = { id: uid(3), trip_id: tripId, user_id: userId, role: "OWNER", joined_at: "2026-10-01T00:00:00Z", left_at: null };
const member = { ...owner, id: uid(9), user_id: memberUser, role: "MEMBER" };
const trip = { id: tripId, name: "Quỹ nhóm · kiểm thử hợp đồng", lifecycle: "UPCOMING", current_membership: owner, membership_revision: 1, plan_version: 1, export_revision: 1, timezone: "Asia/Ho_Chi_Minh", permissions: { can_read: true, can_update: true } };
let profile = { id: userId, full_name: "Người kiểm thử", email: "finance@example.test", status: "ACTIVE", system_role: "USER", version: 1, avatar: null, email_verified_at: "2026-10-01T00:00:00Z" };
const now = "2026-10-28T03:00:00.000Z";
const calls = [], errors = [], unexpected = [], receipts = new Map();
let fund, destinations = [], contributions = [], requests = [], expenses = [], refunds = [], ledger = [], closures = [];
let sequence = 0, rowNumber = 10, conflictBudget = false, loseSubmit = true, settle = false, uncertainKey;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64");
const update = row => { fund.finance_version++; if (row) { row.version++; row.finance_version = fund.finance_version; } };
const balance = () => {
  fund.reserved_refund = refunds.filter(row => ["PENDING", "HOLDER_REPORTED"].includes(row.status)).reduce((sum, row) => sum + BigInt(row.amount), 0n).toString();
  fund.available_balance = (BigInt(fund.current_balance) - BigInt(fund.reserved_refund)).toString();
};
const post = (direction, type, amount, source) => {
  fund.current_balance = (BigInt(fund.current_balance) + (direction === "IN" ? 1n : -1n) * BigInt(amount)).toString();
  ledger.unshift({ id: uid(++rowNumber), fund_id: fundId, sequence: String(++sequence), direction, transaction_type: type, amount, balance_after: fund.current_balance, created_at: now, ...source });
  balance();
};
await context.route("**/api/v1/**", async route => {
  const request = route.request(), url = new URL(request.url()), p = url.pathname.replace("/api/v1", ""), method = request.method();
  const headers = { "Access-Control-Allow-Origin": appUrl, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Content-Type, X-Client-Type, Authorization, X-CSRF-Token, Idempotency-Key", "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS" };
  const respond = (status, data) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify({ data, meta: {} }) });
  const fail = (status, code) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify({ error: { code, message: "Fixture", retryable: status === 503 }, meta: {} }) });
  if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
  const multipart = request.headers()["content-type"]?.startsWith("multipart/form-data");
  const body = request.postData() && !multipart ? request.postDataJSON() : undefined;
  const key = request.headers()["idempotency-key"];
  calls.push({ p, method, body, key });
  if (p === "/auth/csrf") return respond(200, { csrf_token: "fixture-csrf" });
  if (p === "/auth/refresh" || p === "/auth/login") return respond(200, { access_token: "fixture-access", token_type: "Bearer", expires_in: 900, profile });
  if (p === "/me") return respond(200, profile);
  if (p === "/trips") return respond(200, { items: [trip], next_cursor: null });
  if (p === `/trips/${tripId}`) return respond(200, trip);
  if (p.endsWith("/members")) return respond(200, { items: [owner, member], next_cursor: null });
  if (p.endsWith("/plan")) return respond(200, { trip_id: tripId, activities: [], selected_locations: [], dress_codes: [], packing_items: [], permissions: { can_read: true, can_edit: true } });
  if (p.startsWith("/operations/")) return p.endsWith(uncertainKey ?? "never") ? respond(200, { operation_id: uncertainKey, trip_id: tripId, state: settle ? "SUCCEEDED" : "PENDING_RECOVERY", ...(settle ? { outcome: { status: "COMMITTED" } } : {}) }) : fail(404, "RESOURCE_NOT_FOUND");
  if (p.endsWith("/receipts") && method === "POST") {
    assert.ok(multipart); assert.match(request.postDataBuffer().toString(), /name="file"/);
    return respond(201, { object_key: `private/${fundId}/fixture.png`, mime_type: "image/png", size_bytes: png.length });
  }
  if (p.endsWith("/vietqr")) {
    const c = contributions.find(row => p.includes(row.id));
    const ref = "0000000000000000000000001";
    const qr = new URL("https://img.vietqr.io/image/970436-0012345678-compact2.svg");
    qr.searchParams.set("amount", c.amount); qr.searchParams.set("addInfo", ref); qr.searchParams.set("accountName", "TEST ACCOUNT");
    return respond(200, { contribution_id: c.id, amount: c.amount, currency: "VND", reference: ref, recipient_name: "TEST ACCOUNT", bank_code: "VCB", bank_bin: "970436", account_number: "0012345678", qr_url: qr.toString(), environment: "TEST", warning: "Dữ liệu thử nghiệm; không chuyển tiền thật." });
  }
  if (method === "GET") {
    if (p.endsWith("/fund")) return fund ? respond(200, fund) : fail(404, "RESOURCE_NOT_FOUND");
    if (p.endsWith("/destinations")) return respond(200, destinations);
    const collections = { contributions, "contribution-requests": requests, expenses, refunds, transactions: ledger, closures };
    const collection = p.split("/").at(-1);
    if (collections[collection]) {
      const rows = collections[collection].map(row => ({ ...row, finance_version: fund.finance_version }));
      return respond(200, { items: rows, next_cursor: null });
    }
    if (p.startsWith("/closures/")) return respond(200, closures.find(row => p.endsWith(row.id)));
    unexpected.push({ p, method }); return fail(404, "RESOURCE_NOT_FOUND");
  }
  assert.match(key, /^[a-f\d-]{36}$/);
  if (receipts.has(key)) {
    const stored = receipts.get(key);
    assert.deepEqual({ p, method, body }, stored.intent, "Replay must keep exact intent");
    if (key === uncertainKey) return respond(202, { operation_id: key, trip_id: tripId, state: "PENDING_RECOVERY" });
    return respond(200, stored.data);
  }
  if (p.endsWith("/budget") && conflictBudget) return fail(409, "VERSION_CONFLICT");
  if (body?.expected_finance_version !== undefined) assert.equal(body.expected_finance_version, fund.finance_version, "Exact finance revision");
  let result;
  if (p.endsWith("/fund")) {
    fund = { id: fundId, trip_id: tripId, holder_user_id: body.holder_user_id, currency: "VND", budget_amount: body.budget_amount ?? null, current_balance: "0", reserved_refund: "0", available_balance: "0", finance_version: 1, status: "OPEN", closed_at: null };
    destinations = [{ id: uid(6), fund_id: fundId, ...body.destination, confirmed_by_holder_at: null, version: 1 }];
    result = fund;
  } else if (p.includes("/destinations/") && p.endsWith("/confirm")) {
    result = destinations[0]; assert.equal(body.expected_version, result.version); result.confirmed_by_holder_at = now; update(result);
  } else if (p.endsWith("/budget")) { fund.budget_amount = body.budget_amount; update(); result = fund;
  } else if (p.endsWith("/contribution-requests")) {
    const rid = uid(++rowNumber);
    contributions = body.contributions.map(c => ({ ...c, id: uid(++rowNumber), request_id: rid, fund_id: fundId, version: 1, status: "PENDING", self_contribution: c.member_user_id === fund.holder_user_id }));
    update(); result = { id: rid, fund_id: fundId, title: body.title, status: "OPEN", contributions, version: 1, finance_version: fund.finance_version };
    requests.push(result);
  } else if (p.startsWith("/contributions/")) {
    result = contributions.find(row => p.includes(row.id)); assert.equal(body.expected_version, result.version);
    const action = p.split("/").at(-1);
    if (action === "report-transfer") { result.status = "TRANSFER_REPORTED"; assert.equal(body.evidence_object_key, `private/${fundId}/fixture.png`); }
    else if (action === "confirm-received") { result.status = "CONFIRMED"; post("IN", "CONTRIBUTION", result.amount, { contribution_id: result.id }); }
    else throw new Error(`Unhandled contribution ${action}`);
    update(result);
  } else if (p.endsWith("/expenses") && method === "POST") {
    update(); result = { ...body, id: uid(++rowNumber), fund_id: fundId, created_by_user_id: userId, receipt_available: false, version: 1, finance_version: fund.finance_version, status: "DRAFT" }; expenses.push(result);
  } else if (p.startsWith("/expenses/")) {
    result = expenses.find(row => p.includes(row.id)); assert.equal(body.expected_version, result.version);
    const action = p.split("/").at(-1);
    if (action === "submit") result.status = "SUBMITTED";
    else if (action === "withdraw") result.status = "DRAFT";
    else if (action === "confirm") {
      if (BigInt(result.amount) > BigInt(fund.available_balance)) return fail(409, "STATE_CONFLICT");
      result.status = "CONFIRMED"; post("OUT", "EXPENSE", result.amount, { expense_id: result.id });
    } else if (action === "reverse") { result.status = "REVERSED"; post("IN", "REVERSAL", result.amount, { expense_id: result.id, reversal_of_id: "original" }); }
    else if (method === "PATCH") Object.assign(result, body);
    else if (method === "DELETE") { expenses = expenses.filter(row => row !== result); result = undefined; }
    else throw new Error(`Unhandled expense ${action}`);
    update(result);
    if (!result) result = { operation_id: key, trip_id: tripId, state: "SUCCEEDED", outcome: { status: "COMMITTED" } };
  } else if (p.endsWith("/refunds")) {
    update(); result = { id: uid(++rowNumber), fund_id: fundId, ...body, status: "PENDING", version: 1, finance_version: fund.finance_version }; refunds.push(result); balance();
  } else if (p.startsWith("/refunds/")) {
    result = refunds.find(row => p.includes(row.id)); assert.equal(body.expected_version, result.version);
    const action = p.split("/").at(-1);
    if (action === "report-paid") result.status = "HOLDER_REPORTED";
    else if (action === "confirm-received") { result.status = "CONFIRMED"; post("OUT", "REFUND", result.amount, { refund_id: result.id }); }
    else if (action === "confirm-nonreceipt") result.nonreceipt_confirmed_at = now;
    else if (action === "cancel") { result.status = "CANCELLED"; balance(); }
    else if (action === "request-reversal") { result.reversal_requested_at = now; result.reversal_reason = body.reason; }
    else if (action === "consent-reversal") result.reversal_consented_at = now;
    else if (action === "reverse") { assert.equal(body.reason, result.reversal_reason); result.status = "REVERSED"; post("IN", "REVERSAL", result.amount, { refund_id: result.id, reversal_of_id: "original" }); }
    else throw new Error(`Unhandled refund ${action}`);
    update(result);
  } else if (p.endsWith("/closures")) {
    assert.equal(fund.current_balance, "0"); update(); fund.status = "CLOSING";
    result = { id: uid(++rowNumber), fund_id: fundId, status: "PENDING_CONFIRMATIONS", requested_at: now, snapshot_hash: "a".repeat(64), snapshot_finance_version: fund.finance_version, snapshot_schema_version: 1, snapshot: { schema_version: 1, fund: { ...fund }, required_user_ids: [userId], contributions, contribution_requests: requests, expenses, financial_notes: [], refunds, ledger }, confirmations: [{ user_id: userId, confirmed_at: null }], finance_version: fund.finance_version }; closures.push(result);
  } else if (p.startsWith("/closures/") && p.endsWith("/confirm")) {
    result = closures[0]; assert.equal(body.snapshot_hash, result.snapshot_hash);
    result.confirmations[0].confirmed_at = now; result.status = "COMPLETED"; fund.status = "CLOSED"; fund.closed_at = now; update();
  } else { unexpected.push({ p, method }); return fail(404, "RESOURCE_NOT_FOUND"); }
  receipts.set(key, { intent: { p, method, body }, data: structuredClone(result) });
  if (p.startsWith("/expenses/") && p.endsWith("/submit") && loseSubmit) { loseSubmit = false; uncertainKey = key; return route.abort("failed"); }
  return respond(method === "POST" ? 201 : 200, result);
});
let qrRequests = 0;
await context.route("https://img.vietqr.io/**", route => { qrRequests++; return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="black"/></svg>' }); });
const page = await context.newPage();
page.setDefaultTimeout(30_000); page.setDefaultNavigationTimeout(120_000);
page.on("pageerror", error => errors.push(error.message));
const button = name => page.getByRole("button", { name, exact: true });
const field = name => page.getByLabel(name, { exact: true });
const tab = name => page.getByRole("tab", { name, exact: true }).click();
const screenshotDir = path.resolve(".cache/visual/finance"); await mkdir(screenshotDir, { recursive: true });
const goto = () => page.goto(`${appUrl}/trip/${tripId}/fund`, { waitUntil: "networkidle" });
async function confirm({ finish = true } = {}) {
  await button("Tiếp tục").click(); await button("Xác nhận thực hiện").click();
  if (finish) { await page.getByText("Thao tác đã hoàn tất trên máy chủ.", { exact: true }).waitFor(); await button("Tải lại quỹ").click(); }
}
const action = async (label, fields = {}, finish = true) => {
  await page.getByRole("button", { name: new RegExp(`^${label}`) }).first().click();
  for (const [key, value] of Object.entries(fields)) await field(key).fill(value);
  await confirm({ finish });
};
async function shot(name) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(screenshotDir, name) });
}
try {
  await goto(); await button("Mở quỹ nhóm").click();
  await field("Ngân sách dự kiến (VND, có thể để trống)").fill("1000000");
  await field("Mã ngân hàng (VD: VCB)").fill("VCB");
  await field("Số tài khoản").fill("0012345678");
  await field("Tên chủ tài khoản").fill("TEST ACCOUNT");
  await confirm(); assert.equal(fund.current_balance, "0"); assert.equal(destinations[0].confirmed_by_holder_at, null);
  await action("Xác nhận tài khoản");
  assert.ok(destinations[0].confirmed_by_holder_at);
  await action("Cập nhật ngân sách", { "Số tiền (VND, chỉ chữ số)": "9007199254740993" });
  await page.getByText("Ngân sách dự kiến: 9.007.199.254.740.993 ₫", { exact: true }).waitFor();
  await page.setViewportSize({ width: 320, height: 720 }); await shot("01-summary-320.png"); await page.setViewportSize({ width: 402, height: 874 });
  conflictBudget = true; await action("Cập nhật ngân sách", { "Số tiền (VND, chỉ chữ số)": "1000000" }, false);
  await page.getByText(/Dữ liệu vừa được cập nhật/).waitFor(); assert.equal(await button("Gửi lại cùng yêu cầu").count(), 0);
  conflictBudget = false; await button("Tải lại quỹ").click();
  await tab("Đóng góp"); await button("Tạo yêu cầu đóng góp").click();
  await field("Nội dung").fill("Đợt góp đầu tiên"); await field("Số tiền (VND, chỉ chữ số)").fill("500000");
  await page.getByRole("checkbox", { name: `Người đóng góp: Bạn · ${userId.slice(0, 8)}` }).click(); await confirm();
  assert.equal(contributions.length, 1); assert.equal(fund.current_balance, "0");
  await button("Xem VietQR TEST").click(); await page.getByText("Tài khoản: 0012345678", { exact: true }).waitFor(); assert.equal(qrRequests, 0);
  await button("Đồng ý tải ảnh VietQR TEST").click(); await page.getByRole("img", { name: "VietQR TEST" }).waitFor();
  await shot("02-vietqr-test.png"); await button("Đóng").click(); assert.equal(qrRequests, 1);
  await page.getByRole("button", { name: /^Báo đã chuyển tiền/ }).click();
  const chooser = page.waitForEvent("filechooser"); await button("Đính kèm ảnh chứng từ").click();
  await (await chooser).setFiles({ name: "receipt.png", mimeType: "image/png", buffer: png });
  await button("Đổi ảnh chứng từ").waitFor(); await confirm(); assert.equal(fund.current_balance, "0");
  await action("Xác nhận đã nhận đủ"); assert.equal(fund.current_balance, "500000");
  await tab("Khoản chi"); await button("Tạo khoản chi").click();
  await field("Nội dung").fill("Bữa tối"); await field("Số tiền (VND, chỉ chữ số)").fill("200000"); await confirm();
  await action("Sửa khoản chi", { "Số tiền (VND, chỉ chữ số)": "150000" });
  await action("Gửi duyệt khoản chi", {}, false);
  await button("Gửi lại cùng yêu cầu").click(); await page.getByText(/Máy chủ đang xử lý/).waitFor();
  const submitCalls = calls.filter(call => call.p.endsWith("/submit")); assert.equal(submitCalls.length, 2); assert.equal(submitCalls[0].key, submitCalls[1].key); assert.deepEqual(submitCalls[0].body, submitCalls[1].body);
  await shot("03-pending.png");
  settle = true; await goto(); await page.getByText("Thao tác đã hoàn tất trên máy chủ.", { exact: true }).waitFor();
  await button("Tải lại quỹ").click(); await tab("Khoản chi");
  await action("Rút đề nghị chi"); await action("Gửi duyệt khoản chi"); await action("Xác nhận đã chi"); assert.equal(fund.current_balance, "350000");
  await action("Đảo giao dịch", { "Lý do": "Đối chiếu chi nhầm" }); assert.equal(fund.current_balance, "500000");
  await button("Tạo khoản chi").click(); await field("Nội dung").fill("Nháp cần xóa"); await field("Số tiền (VND, chỉ chữ số)").fill("1"); await confirm();
  await action("Xóa khoản chi nháp"); assert.equal(expenses.length, 1);
  await tab("Hoàn tiền"); await button("Tạo hoàn tiền").click();
  await page.getByRole("radio", { name: `Người nhận hoàn: Bạn · ${userId.slice(0, 8)}` }).click();
  await field("Số tiền (VND, chỉ chữ số)").fill("500000"); await field("Lý do").fill("Hoàn quỹ dư"); await confirm();
  assert.equal(fund.current_balance, "500000"); assert.equal(fund.available_balance, "0");
  await tab("Khoản chi"); await button("Tạo khoản chi").click();
  await field("Nội dung").fill("Không được chi phần đã giữ chỗ"); await field("Số tiền (VND, chỉ chữ số)").fill("1"); await confirm();
  await action("Gửi duyệt khoản chi"); await action("Xác nhận đã chi", {}, false);
  await page.getByText(/Trạng thái hiện tại chưa cho phép thao tác/).waitFor();
  assert.equal(fund.current_balance, "500000"); assert.equal(fund.available_balance, "0");
  await button("Tải lại quỹ").click(); await action("Rút đề nghị chi"); await action("Xóa khoản chi nháp"); await tab("Hoàn tiền");
  await action("Báo đã hoàn tiền"); assert.equal(fund.current_balance, "500000"); await action("Xác nhận đã nhận đủ"); assert.equal(fund.current_balance, "0");
  await action("Yêu cầu đảo hoàn tiền", { "Lý do": "Nhận nhầm" }); await action("Đồng ý đảo hoàn tiền"); await action("Đảo giao dịch", { "Lý do": "Nhận nhầm" }); assert.equal(fund.current_balance, "500000");
  await button("Tạo hoàn tiền").click(); await page.getByRole("radio", { name: `Người nhận hoàn: Bạn · ${userId.slice(0, 8)}` }).click();
  await field("Số tiền (VND, chỉ chữ số)").fill("100000"); await field("Lý do").fill("Kiểm tra báo chưa nhận"); await confirm();
  await action("Báo đã hoàn tiền");
  await button(`Hủy ${refunds.at(-1).id.slice(0, 8)}`).waitFor({ state: "hidden" });
  await action("Báo chưa nhận tiền", { "Lý do": "Chưa nhận tiền thực tế" }); await action("Hủy", { "Lý do": "Hủy sau khi người nhận đối chiếu" });
  assert.equal(fund.current_balance, "500000"); assert.equal(fund.available_balance, "500000");
  await button("Tạo hoàn tiền").click(); await page.getByRole("radio", { name: `Người nhận hoàn: Bạn · ${userId.slice(0, 8)}` }).click();
  await field("Số tiền (VND, chỉ chữ số)").fill("500000"); await field("Lý do").fill("Hoàn lại chính xác"); await confirm();
  await action("Báo đã hoàn tiền"); await action("Xác nhận đã nhận đủ"); assert.equal(fund.current_balance, "0");
  await tab("Lịch sử"); await shot("04-ledger.png"); assert.equal(ledger.length, 6);
  await tab("Đóng quỹ"); await button("Yêu cầu đóng quỹ").click(); await confirm(); assert.equal(fund.status, "CLOSING");
  await button("Xem bản chốt").click(); await button("Xem toàn bộ bản chốt").click(); await shot("05-closure.png");
  await button("Xác nhận bản chốt này").click(); await confirm(); assert.equal(fund.status, "CLOSED");
  await tab("Khoản chi"); assert.equal(await button("Tạo khoản chi").count(), 0);
  await tab("Tổng quan"); assert.equal(await button("Cập nhật ngân sách").count(), 0);
  // Reload under a different account; no Owner/Holder controls leak across accounts.
  fund.status = "OPEN"; profile = { ...profile, id: memberUser }; trip.current_membership = member;
  await goto(); assert.equal(await button("Cập nhật ngân sách").count(), 0); await tab("Đóng góp"); assert.equal(await button("Tạo yêu cầu đóng góp").count(), 0);
  assert.equal(await page.getByRole("button", { name: /^Đảo giao dịch/ }).count(), 0);
  assert.equal(await page.evaluate(() => Object.values(localStorage).some(value => value.includes("0012345678") || value.includes("TEST ACCOUNT") || value.includes("private/"))), false);
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
  console.log("PASS Finance UI: setup/Holder consent, exact money, version conflict, contribution/receipt/VietQR privacy, expense CRUD/settlement/reversal, lost-reply retry+restart, refunds/reservations/consent/reversal, ledger, closure, read-only/role boundaries, 320px layout. No real backend writes.");
} catch (error) {
  await page.screenshot({ path: path.join(screenshotDir, "failure.png") });
  console.error("UI errors", errors, "Recent request paths", calls.slice(-8).map(({ p, method }) => ({ p, method })));
  console.error((await page.locator("body").innerText()).slice(-2500));
  throw error;
} finally { await browser.close(); }
