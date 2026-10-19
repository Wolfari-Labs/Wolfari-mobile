import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

// Contract fixtures only: no emails, passwords, memberships or backend data are changed.
const appUrl = process.env.WOLFARI_PREVIEW_URL ?? "http://localhost:8082";
let executablePath;
for (const candidate of [process.env.WOLFARI_BROWSER_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean)) {
  if (await access(candidate).then(() => true, () => false)) { executablePath = candidate; break; }
}
assert.ok(executablePath);
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 402, height: 874 }, reducedMotion: "reduce" });
const tripId = "20000000-0000-4000-8000-000000000001";
const ownerId = "30000000-0000-4000-8000-000000000001";
const memberId = "30000000-0000-4000-8000-000000000002";
const userId = "10000000-0000-4000-8000-000000000001";
const memberUserId = "40000000-0000-4000-8000-000000000002";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64");
let profile = { id: userId, email: "demo@example.test", full_name: "Minh Anh", avatar: null, system_role: "USER", status: "ACTIVE", email_verified_at: null, version: 1 };
const owner = { id: ownerId, trip_id: tripId, user_id: userId, role: "OWNER", joined_at: "2026-10-01T00:00:00Z", left_at: null };
const member = { ...owner, id: memberId, user_id: memberUserId, role: "MEMBER" };
let trip = { id: tripId, name: "Kiểm thử chức năng backend", description: null, public_description: null, start_at: "2026-11-11T17:00:00Z", end_at: "2026-11-14T16:59:00Z", timezone: "Asia/Ho_Chi_Minh", lifecycle: "UPCOMING", archived_at: null, plan_edit_policy: "OWNER_ONLY", plan_version: 1, membership_revision: 1, export_revision: 1, current_membership: owner, permissions: { can_read: true, can_update: true } };
const calls = [], errors = [];
let wrongPassword = true, operation, lostReply = true, completeOperation = false, removed = false, rejectFinance = false;
await context.route("**/api/v1/**", async route => {
  const request = route.request(), url = new URL(request.url()), pathname = url.pathname.replace("/api/v1", ""), method = request.method();
  const headers = { "Access-Control-Allow-Origin": appUrl, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Content-Type, X-Client-Type, Authorization, X-CSRF-Token, Idempotency-Key", "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS" };
  const respond = (status, data) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify({ data, meta: {} }) });
  const fail = (status, code) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify({ error: { code, message: "Fixture", retryable: status === 503 }, meta: {} }) });
  if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
  const multipart = request.headers()["content-type"]?.startsWith("multipart/form-data");
  const body = request.postData() && !multipart ? request.postDataJSON() : undefined;
  calls.push({ pathname, method, body, headers: request.headers() });
  if (pathname === "/auth/csrf") return respond(200, { csrf_token: "fixture-csrf" });
  if (pathname === "/auth/refresh" || pathname === "/auth/login") return respond(200, { access_token: "fixture-access", token_type: "Bearer", expires_in: 900, profile });
  if (pathname === "/auth/password-reset-requests") return respond(202, { message_code: "REQUEST_ACCEPTED" });
  if (pathname === "/auth/password-resets") return respond(200, { message_code: "REQUEST_ACCEPTED" });
  if (pathname === "/auth/email-verifications") return respond(202, { message_code: "REQUEST_ACCEPTED" });
  if (pathname === "/auth/email-verifications/confirm") { profile = { ...profile, email_verified_at: "2026-10-18T00:00:00Z", version: profile.version + 1 }; return respond(200, { message_code: "REQUEST_ACCEPTED" }); }
  if (pathname === "/me/password-change") return wrongPassword ? fail(401, "UNAUTHENTICATED") : respond(200, { message_code: "REQUEST_ACCEPTED" });
  if (pathname === "/me/avatar") {
    assert.equal(request.headers().authorization, "Bearer fixture-access");
    if (method === "GET") return route.fulfill({ status: 200, headers, contentType: "image/png", body: png });
    assert.ok(multipart);
    assert.match(request.postDataBuffer().toString(), /name="file"/);
    return respond(201, { object_key: `users/${userId}/avatars/image.png` });
  }
  if (pathname === "/me" && method === "PATCH") {
    assert.equal(body.expected_version, profile.version);
    profile = { ...profile, full_name: body.full_name ?? profile.full_name, avatar: "avatar_object_key" in body ? body.avatar_object_key ? "/api/v1/me/avatar" : null : profile.avatar, version: profile.version + 1 };
    return respond(200, profile);
  }
  if (pathname === "/me") return respond(200, profile);
  if (pathname === "/trips") return respond(200, { items: [trip], next_cursor: null });
  if (pathname === `/trips/${tripId}`) return respond(200, trip);
  if (pathname.endsWith("/plan")) return respond(200, { trip_id: tripId, plan_version: 1, export_revision: 1, activities: [], selected_locations: [], packing_items: [], dress_codes: [], permissions: { can_read: true, can_edit: true, can_complete: true } });
  if (pathname.endsWith("/members") && method === "GET") return respond(200, { items: [owner, ...(!removed || url.searchParams.get("include_left") === "true" ? [{ ...member, left_at: removed ? "2026-10-18T00:00:00Z" : null }] : [])], next_cursor: null });
  if (pathname.endsWith("/plan-policy")) {
    assert.equal(body.expected_membership_revision, trip.membership_revision);
    assert.deepEqual(body.editor_member_ids, [memberId]);
    trip = { ...trip, plan_edit_policy: body.policy, membership_revision: trip.membership_revision + 1 };
    return respond(200, { policy: body.policy, editor_member_ids: body.editor_member_ids, membership_revision: trip.membership_revision });
  }
  if (pathname.endsWith("/invitations")) {
    if (method === "GET") return respond(200, { items: [], next_cursor: null });
    assert.equal(body.invitation_type, "LINK");
    assert.equal(body.email, undefined);
    return respond(201, { invitation: { id: "invitation", trip_id: tripId, invitation_type: "LINK", email: null, status: "PENDING", version: 1, expires_at: "2026-11-01T00:00:00Z", resolved_at: null }, one_time_link: `https://gateway.test/invitations/local#token=inv1_${"x".repeat(43)}` });
  }
  if (pathname.endsWith(`/members/${memberId}`) || pathname.endsWith("/leave")) {
    if (rejectFinance) return fail(409, "FINANCE_OBLIGATION_BLOCKED");
    assert.equal(body.expected_membership_revision, trip.membership_revision);
    operation = { operation_id: request.headers()["idempotency-key"], trip_id: tripId, state: "PENDING_RECOVERY" };
    if (lostReply) { lostReply = false; return route.abort("failed"); }
    return respond(202, operation);
  }
  if (pathname.startsWith("/operations/")) {
    if (!operation || lostReply || !calls.some(call => call.method === "DELETE" && call.pathname.endsWith(memberId))) return fail(404, "RESOURCE_NOT_FOUND");
    // Keep the initial unknown state until the user explicitly retries the same intent.
    if (calls.filter(call => call.method === "DELETE" && call.pathname.endsWith(memberId)).length < 2) return fail(404, "RESOURCE_NOT_FOUND");
    if (completeOperation) { removed = true; return respond(200, { ...operation, state: "SUCCEEDED", outcome: { status: "COMMITTED" } }); }
    return respond(200, operation);
  }
  return fail(404, "RESOURCE_NOT_FOUND");
});
const page = await context.newPage();
page.setDefaultTimeout(30_000); page.setDefaultNavigationTimeout(120_000);
page.on("pageerror", error => errors.push(error.message));
const button = name => page.getByRole("button", { name, exact: true });
const field = name => page.getByLabel(name, { exact: true });
const goto = async route => {
  const restored = page.waitForResponse(response => response.url().endsWith("/auth/refresh"), { timeout: 120_000 });
  await page.goto(`${appUrl}${route}`, { waitUntil: "networkidle" });
  await restored;
};
const shots = path.resolve(".cache/visual/backend-features");
await mkdir(shots, { recursive: true });
async function screenshot(name) {
  await page.waitForFunction(() => Array.from(document.images).every(image => image.complete && image.naturalWidth > 0));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(shots, name) });
}
try {
  await goto("/forgot-password");
  await field("Email").fill("DEMO@EXAMPLE.TEST");
  await button("Gửi email khôi phục").click();
  await page.getByText(/Nếu email thuộc tài khoản hợp lệ/).waitFor();
  assert.equal(calls.find(call => call.pathname === "/auth/password-reset-requests").body.email, "demo@example.test");
  await button("Tôi đã có mã khôi phục").click();
  await field("Mã hoặc liên kết đặt lại mật khẩu").fill(`https://gateway.test/api/v1/auth/local/reset?token=${"a".repeat(43)}`);
  await field("Mật khẩu mới").fill("a new long test password");
  await field("Nhập lại mật khẩu mới").fill("different password");
  await button("Lưu mật khẩu mới").click();
  await page.getByText("Mật khẩu xác nhận chưa khớp.").waitFor();
  assert.equal(calls.filter(call => call.pathname === "/auth/password-resets").length, 0);
  await field("Nhập lại mật khẩu mới").fill("a new long test password");
  await screenshot("reset-password.png");
  await button("Lưu mật khẩu mới").click();
  await page.waitForURL("**/sign-in?notice=password-updated");
  await goto("/verify-email");
  await button("Gửi lại email xác minh").click();
  await field("Mã hoặc liên kết xác minh").fill("b".repeat(43));
  await button("Xác nhận email").click();
  await page.getByText("Email của tài khoản đã được xác minh.").waitFor();
  await goto("/change-password");
  await field("Mật khẩu hiện tại").fill("wrong old password");
  await field("Mật khẩu mới").fill("another long new password");
  await field("Nhập lại mật khẩu mới").fill("another long new password");
  const refreshes = calls.filter(call => call.pathname === "/auth/refresh").length;
  await button("Lưu mật khẩu mới").click();
  await page.getByText("Mật khẩu hiện tại chưa đúng hoặc phiên đăng nhập đã hết hạn.").waitFor();
  assert.equal(calls.filter(call => call.pathname === "/auth/refresh").length, refreshes);
  wrongPassword = false;
  await button("Lưu mật khẩu mới").click();
  await page.waitForURL("**/sign-in?notice=password-updated");
  await goto("/edit-profile");
  const chooser = page.waitForEvent("filechooser");
  await button("Chọn ảnh đại diện").click();
  await (await chooser).setFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
  await button("Gỡ ảnh đại diện").waitFor();
  assert.equal(calls.filter(call => call.pathname === "/me/avatar" && call.method === "POST").length, 0);
  await button("Lưu thay đổi").click();
  await page.waitForURL("**/profile");
  assert.equal(calls.filter(call => call.pathname === "/me/avatar" && call.method === "POST").length, 1);
  await screenshot("profile.png");
  await goto("/edit-profile");
  await button("Gỡ ảnh đại diện").click();
  await button("Lưu thay đổi").click();
  await page.waitForURL("**/profile");
  assert.equal(profile.avatar, null);
  await goto(`/trip/${tripId}/invite`);
  await page.getByRole("tab", { name: "Bằng liên kết", exact: true }).click();
  await button("Tạo liên kết mời").click();
  await page.getByText(/https:\/\/gateway.test\/invitations\/local/).waitFor();
  await goto(`/trip/${tripId}/settings`);
  await page.getByRole("tab", { name: "Chọn thành viên", exact: true }).click();
  await page.getByRole("checkbox").click();
  await button("Lưu quyền của nhóm").click();
  assert.equal(calls.filter(call => call.pathname.endsWith("/plan-policy")).length, 0);
  await button("Xác nhận thay thế quyền").click();
  await page.getByText("Đã cập nhật quyền chỉnh sửa của nhóm.").waitFor();
  await screenshot("permissions.png");
  await goto(`/trip/${tripId}/members`);
  await page.setViewportSize({ width: 360, height: 740 });
  await screenshot("members-small-phone.png");
  await page.setViewportSize({ width: 402, height: 874 });
  await button(`Xóa ${memberUserId.slice(0, 8)}`).click();
  await field("Lý do").fill("Thành viên yêu cầu rời nhóm");
  await button("Xóa thành viên").click();
  assert.equal(calls.filter(call => call.method === "DELETE").length, 0);
  await button("Xác nhận thực hiện").click();
  await button("Gửi lại cùng yêu cầu").click();
  await page.getByText(/Máy chủ đang xử lý/).waitFor();
  assert.equal(await button("Hoàn tất").count(), 0);
  const writes = calls.filter(call => call.method === "DELETE");
  assert.equal(writes.length, 2);
  assert.equal(writes[0].headers["idempotency-key"], writes[1].headers["idempotency-key"]);
  assert.deepEqual(writes[0].body, writes[1].body);
  await screenshot("membership-pending.png");
  operation = { ...operation, state: "NEEDS_REVIEW" };
  await button("Kiểm tra trạng thái").click();
  await page.getByText(/Yêu cầu cần bộ phận vận hành kiểm tra/).waitFor();
  assert.equal(await button("Hoàn tất").count(), 0);
  completeOperation = true;
  await button("Kiểm tra trạng thái").click();
  await button("Hoàn tất").click();
  await page.waitForURL(`**/trip/${tripId}/members`);
  assert.equal(await button(`Xóa ${memberUserId.slice(0, 8)}`).count(), 0);
  await page.getByRole("tab", { name: "Cả lịch sử", exact: true }).click();
  await page.getByText(/Đã rời/).waitFor();
  removed = false; rejectFinance = true;
  trip = { ...trip, current_membership: { ...member, user_id: userId }, permissions: { can_read: true, can_update: false } };
  await goto(`/trip/${tripId}/settings`);
  assert.equal(await button("Lưu quyền của nhóm").count(), 0);
  await button("Rời chuyến đi").click();
  await field("Lý do").fill("Không thể tham gia");
  await button("Rời chuyến đi").click();
  await button("Xác nhận thực hiện").click();
  await page.getByText("Chưa thể rời hoặc xóa thành viên vì còn nghĩa vụ tài chính cần giải quyết.").waitFor();
  assert.equal(await button("Hoàn tất").count(), 0);
  assert.deepEqual(errors, []);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log("Backend feature UI fixtures passed: recovery, verification, password change, avatar, LINK invitations, selected editors, member history, lost replies, async completion and finance block.");
} catch (error) {
  await page.screenshot({ path: path.join(shots, "failure.png") });
  console.error("Page:", page.url(), "Errors:", errors, "Recent requests:", calls.slice(-8).map(({ pathname, method }) => ({ pathname, method })));
  console.error((await page.locator("body").innerText()).slice(-1800));
  throw error;
} finally { await browser.close(); }
