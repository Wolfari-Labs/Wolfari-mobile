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
let wrongPassword = true, lostPasswordReply = false, operation, lostReply = true, completeOperation = false, removed = false, rejectFinance = false;
let loggedOut = false, logoutOffline = true, editorInvites = false;
const pendingEmail = (id, email, by) => ({ id, trip_id: tripId, invitation_type: "EMAIL", email, status: "PENDING", version: 1, expires_at: "2099-11-01T00:00:00Z", resolved_at: null, code_hint: null, invited_by_user_id: by });
const sessionId = "50000000-0000-4000-8000-000000000001";
await context.route("**/api/v1/**", async route => {
  const request = route.request(), url = new URL(request.url()), pathname = url.pathname.replace("/api/v1", ""), method = request.method();
  const headers = { "Access-Control-Allow-Origin": appUrl, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Content-Type, X-Client-Type, Authorization, X-CSRF-Token, Idempotency-Key", "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS" };
  const respond = (status, data) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify({ data, meta: {} }) });
  const fail = (status, code) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify({ error: { code, message: "Fixture", retryable: status === 503 }, meta: {} }) });
  if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
  const multipart = request.headers()["content-type"]?.startsWith("multipart/form-data");
  const body = request.postData() && !multipart ? request.postDataJSON() : undefined;
  calls.push({ pathname, method, body, headers: request.headers() });
  if (pathname === "/auth/csrf") return loggedOut ? fail(401, "UNAUTHENTICATED") : respond(200, { csrf_token: "fixture-csrf" });
  if (pathname === "/auth/refresh" || pathname === "/auth/login") return loggedOut ? fail(401, "UNAUTHENTICATED") : respond(200, { session_id: sessionId, access_token: "fixture-access", token_type: "Bearer", expires_in: 900, profile });
  if (pathname === "/auth/logout") {
    assert.equal(body.session_id, sessionId);
    assert.equal(request.headers()["x-csrf-token"], "fixture-csrf");
    assert.equal(request.headers().authorization, "Bearer fixture-access");
    if (logoutOffline) return route.abort("failed");
    loggedOut = true;
    return route.fulfill({ status: 204, headers });
  }
  if (pathname === "/auth/password-reset-requests") return respond(202, { message_code: "REQUEST_ACCEPTED" });
  if (pathname === "/auth/password-resets") return lostPasswordReply ? route.abort("failed") : respond(200, { message_code: "REQUEST_ACCEPTED" });
  if (pathname === "/auth/email-verifications") return respond(202, { message_code: "REQUEST_ACCEPTED" });
  if (pathname === "/auth/email-verifications/confirm") { profile = { ...profile, email_verified_at: "2026-10-18T00:00:00Z", version: profile.version + 1 }; return respond(200, { message_code: "REQUEST_ACCEPTED" }); }
  if (pathname === "/me/password-change") return wrongPassword ? fail(401, "UNAUTHENTICATED") : lostPasswordReply ? route.abort("failed") : respond(200, { message_code: "REQUEST_ACCEPTED" });
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
  if (pathname === "/me/sessions") return respond(200, { items: [{ id: sessionId, created_at: "2026-10-18T00:00:00Z", expires_at: "2099-11-01T00:00:00Z", last_used_at: null }], next_cursor: null });
  if (pathname === "/me") return respond(200, profile);
  if (pathname === "/trips") return respond(200, { items: [trip], next_cursor: null });
  if (pathname === `/trips/${tripId}`) return respond(200, trip);
  if (pathname.endsWith("/plan")) return respond(200, { trip_id: tripId, plan_version: 1, export_revision: 1, activities: [], selected_locations: [], packing_items: [], dress_codes: [], permissions: { can_read: true, can_edit: true, can_complete: true } });
  if (pathname.endsWith("/members") && method === "GET") return respond(200, { items: [owner, ...(!removed || url.searchParams.get("include_left") === "true" ? [{ ...member, left_at: removed ? "2026-10-18T00:00:00Z" : null }] : [])], next_cursor: null });
  if (pathname.endsWith("/plan-policy")) {
    if (method === "GET") return respond(200, { policy: trip.plan_edit_policy, editor_member_ids: trip.plan_edit_policy === "SELECTED_MEMBERS" ? [memberId] : [], membership_revision: trip.membership_revision });
    assert.equal(body.expected_membership_revision, trip.membership_revision);
    assert.deepEqual(body.editor_member_ids, [memberId]);
    trip = { ...trip, plan_edit_policy: body.policy, membership_revision: trip.membership_revision + 1 };
    return respond(200, { policy: body.policy, editor_member_ids: body.editor_member_ids, membership_revision: trip.membership_revision });
  }
  if (pathname.endsWith("/invitations")) {
    if (method === "GET") return respond(200, { items: editorInvites ? [pendingEmail("mine", "mine@example.test", userId), pendingEmail("theirs", "theirs@example.test", memberUserId)] : trip.lifecycle === "ARCHIVED" ? [{ id: "pending-email", trip_id: tripId, invitation_type: "EMAIL", email: "invitee@example.test", status: "PENDING", version: 1, expires_at: "2099-11-01T00:00:00Z", resolved_at: null }] : [], next_cursor: null });
    assert.equal(body.invitation_type, "LINK");
    assert.equal(body.email, undefined);
    return respond(201, { invitation: { id: "invitation", trip_id: tripId, invitation_type: "LINK", email: null, status: "PENDING", version: 1, expires_at: "2026-11-01T00:00:00Z", resolved_at: null }, one_time_link: `https://gateway.test/invitations/local#token=inv1_${"x".repeat(43)}`, join_code: "K7PQ-4M2X" });
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
page.on("console", message => { if (message.type() === "error" && /navigation.*initialized|Maximum update depth/.test(message.text())) errors.push(message.text()); });
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
  await assertPublicText(page);
  await page.screenshot({ path: path.join(shots, name) });
}
try {
  await goto("/forgot-password");
  await field("Email").fill("DEMO@EXAMPLE.TEST");
  await button("Gửi mã khôi phục").click();
  // Every email gets the same answer, so the app always continues to the code step.
  await page.waitForURL("**/reset-password?email=demo%40example.test&sent=1");
  assert.equal(calls.find(call => call.pathname === "/auth/password-reset-requests").body.email, "demo@example.test");
  assert.equal(await button(/Gửi lại mã sau \d+ giây/).isDisabled(), true);
  await field("Mã khôi phục 6 số").fill("123456");
  await field("Mật khẩu mới").fill("Code1234");
  await field("Nhập lại mật khẩu mới").fill("Code1234");
  await button("Lưu mật khẩu mới").click();
  await page.waitForURL("**/sign-in?notice=password-updated");
  assert.deepEqual(calls.filter(call => call.pathname === "/auth/password-resets").at(-1).body, { email: "demo@example.test", code: "123456", new_password: "Code1234" });
  await goto("/forgot-password");
  await button("Tôi đã có mã khôi phục").click();
  await page.waitForURL("**/reset-password");
  // The forgot-password screen stays mounted underneath; check the screen on top.
  await field("Email").last().waitFor();
  const resetsBeforeLink = calls.filter(call => call.pathname === "/auth/password-resets").length;
  await goto(`/reset-password?token=${"a".repeat(43)}`);
  await page.waitForFunction(() => !new URL(location.href).searchParams.get("token"));
  assert.equal(await field("Mã hoặc liên kết đặt lại mật khẩu").inputValue(), "a".repeat(43));
  assert.equal(calls.filter(call => call.pathname === "/auth/password-resets").length, resetsBeforeLink, "Opening a link never consumes it.");
  await field("Mã hoặc liên kết đặt lại mật khẩu").fill(`https://gateway.test/api/v1/auth/local/reset?token=${"a".repeat(43)}`);
  await field("Mật khẩu mới").fill("Reset123");
  await field("Nhập lại mật khẩu mới").fill("different password");
  await button("Lưu mật khẩu mới").click();
  await page.getByText("Mật khẩu xác nhận chưa khớp.").waitFor();
  assert.equal(calls.filter(call => call.pathname === "/auth/password-resets").length, resetsBeforeLink);
  await field("Nhập lại mật khẩu mới").fill("Reset123");
  await screenshot("reset-password.png");
  await button("Lưu mật khẩu mới").click();
  await page.waitForURL("**/sign-in?notice=password-updated");
  await goto('/verify-email');
  await button('Tôi đã xác minh').click();
  await page.getByText(/Email chưa được xác minh/).waitFor();
  assert.equal(calls.filter(call => call.pathname === '/auth/email-verifications/confirm').length, 0, 'Checking verification never marks the account verified.');
  await button("Gửi lại mã").click();
  await page.getByText(/Đã gửi lại mã/).waitFor();
  assert.equal(calls.filter(call => call.pathname === "/auth/email-verifications").length, 1);
  assert.equal(await button(/Gửi lại mã sau \d+ giây/).isDisabled(), true);
  await goto(`/verify-email?token=${"b".repeat(43)}`);
  await page.waitForFunction(() => !new URL(location.href).searchParams.get("token"));
  assert.equal(await field("Mã hoặc liên kết xác minh").inputValue(), "b".repeat(43));
  assert.equal(calls.filter(call => call.pathname === "/auth/email-verifications/confirm").length, 0);
  await field("Mã hoặc liên kết xác minh").fill("b".repeat(43));
  await button("Xác nhận email").click();
  await page.getByText("Email của tài khoản đã được xác minh.").waitFor();
  await button("Về tài khoản").click();
  await page.waitForURL("**/profile");
  await goto("/change-password");
  await field("Mật khẩu hiện tại").fill("wrong old password");
  await field("Mật khẩu mới").fill("Change12");
  await field("Nhập lại mật khẩu mới").fill("Change12");
  const refreshes = calls.filter(call => call.pathname === "/auth/refresh").length;
  await button("Lưu mật khẩu mới").click();
  await page.getByText("Mật khẩu hiện tại chưa đúng hoặc phiên đăng nhập đã hết hạn.").waitFor();
  assert.equal(calls.filter(call => call.pathname === "/auth/refresh").length, refreshes);
  wrongPassword = false;
  await button("Lưu mật khẩu mới").click();
  await page.waitForURL("**/sign-in?notice=password-updated");
  for (const mode of ["change", "reset"]) {
    await goto(`/${mode}-password`);
    if (mode === "change") await field("Mật khẩu hiện tại").fill("Change12");
    else {
      await field("Email").fill("demo@example.test");
      await field("Mã khôi phục 6 số").fill("123456");
    }
    await field("Mật khẩu mới").fill("Next1234");
    await field("Nhập lại mật khẩu mới").fill("Next1234");
    const endpoint = mode === "change" ? "/me/password-change" : "/auth/password-resets";
    const previousWrites = calls.filter(call => call.pathname === endpoint).length;
    lostPasswordReply = true;
    await button("Lưu mật khẩu mới").click();
    await page.getByText(/Chưa xác định được mật khẩu đã đổi hay chưa/).waitFor();
    assert.equal(await button("Lưu mật khẩu mới").isDisabled(), true);
    assert.equal(await field("Mật khẩu mới").inputValue(), "");
    assert.equal(calls.filter(call => call.pathname === endpoint).length, previousWrites + 1);
    await button("Đóng thông báo").click();
    await button("Đến trang đăng nhập").click();
    await page.waitForURL("**/sign-in");
    lostPasswordReply = false;
  }
  await goto("/edit-profile");
  const chooser = page.waitForEvent("filechooser");
  await button("Chọn ảnh đại diện").click();
  await (await chooser).setFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
  await button("Gỡ ảnh đại diện").waitFor();
  assert.equal(calls.filter(call => call.pathname === "/me/avatar" && call.method === "POST").length, 0);
  await button("Lưu thay đổi").click();
  await button("Về tài khoản").click();
  await page.waitForURL("**/profile");
  assert.equal(calls.filter(call => call.pathname === "/me/avatar" && call.method === "POST").length, 1);
  await screenshot("profile.png");
  await goto("/edit-profile");
  await button("Gỡ ảnh đại diện").click();
  await button("Lưu thay đổi").click();
  await button("Về tài khoản").click();
  await page.waitForURL("**/profile");
  assert.equal(profile.avatar, null);
  await goto(`/trip/${tripId}/invite`);
  await page.getByRole("tab", { name: "Bằng mã mời", exact: true }).click();
  await button("Tạo mã mời").click();
  await button("Xem mã mời").click();
  // The short join code and its QR are shown; neither the secret link nor the long token is rendered.
  await page.getByText("K7PQ-4M2X", { exact: true }).waitFor();
  await page.getByRole("img", { name: "Mã QR lời mời K7PQ-4M2X", exact: true }).waitFor();
  await page.getByRole("button", { name: "Sao chép mã", exact: true }).waitFor();
  assert.equal(await page.getByText("gateway.test/invitations", { exact: false }).count(), 0);
  assert.equal(await page.getByText("inv1_", { exact: false }).count(), 0);
  await goto(`/trip/${tripId}/settings`);
  await button("Chọn thành viên").click();
  await page.getByRole("checkbox").click();
  await button("Chọn xong").click();
  await button("Lưu cài đặt").click();
  assert.equal(calls.filter(call => call.pathname.endsWith("/plan-policy") && call.method === "PUT").length, 0);
  await button("Xác nhận thay thế quyền").click();
  await button("Tiếp tục chỉnh sửa").click();
  await screenshot("permissions.png");
  await goto(`/trip/${tripId}/members`);
  await page.setViewportSize({ width: 360, height: 740 });
  await screenshot("members-small-phone.png");
  await page.setViewportSize({ width: 402, height: 874 });
  await button("Xóa Bạn đồng hành").click();
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
  assert.equal(await button("Xóa Bạn đồng hành").count(), 0);
  await page.getByRole("tab", { name: "Cả lịch sử", exact: true }).click();
  await page.getByText("Đã rời", { exact: true }).waitFor();
  removed = false; rejectFinance = true;
  trip = { ...trip, current_membership: { ...member, user_id: userId }, permissions: { can_read: true, can_update: false } };
  await goto(`/trip/${tripId}/settings`);
  assert.equal(await page.getByRole("switch", { name: "Cùng chỉnh sửa lịch", exact: true }).count(), 0);
  await button("Rời chuyến đi").click();
  await field("Lý do").fill("Không thể tham gia");
  await button("Rời chuyến đi").click();
  await button("Xác nhận thực hiện").click();
  await page.getByText("Chưa thể rời hoặc xóa thành viên vì còn nghĩa vụ tài chính cần giải quyết.").waitFor();
  assert.equal(await button("Hoàn tất").count(), 0);
  // A plan editor who may invite manages only the invitations they created; the Owner manages all.
  editorInvites = true;
  trip = { ...trip, permissions: { can_read: true, can_update: false, can_invite: true } };
  await goto(`/trip/${tripId}/members`);
  await page.getByText("theirs@example.test", { exact: true }).waitFor();
  await page.getByText("Lời mời do bạn tạo", { exact: true }).waitFor();
  assert.equal(await button("Thu hồi").count(), 1, "Only the editor's own invitation can be revoked");
  assert.equal(await button("Gửi lại").count(), 1);
  editorInvites = false;
  trip = { ...trip, lifecycle: "ARCHIVED", archived_at: "2026-11-05T00:00:00Z", current_membership: owner };
  const writesBeforeArchive = calls.filter(call => ["POST", "PATCH", "PUT", "DELETE"].includes(call.method) && call.pathname.startsWith("/trips/")).length;
  await goto(`/trip/${tripId}/settings`);
  await page.getByText("Chuyến đi đã lưu trữ. Quyền của nhóm chỉ có thể xem.").waitFor();
  assert.equal(await page.getByRole("switch", { name: "Cùng chỉnh sửa lịch", exact: true }).count(), 0);
  assert.equal(await button("Rời chuyến đi").count(), 0);
  await goto(`/trip/${tripId}/invite`);
  await page.getByText("Chuyến đi đã lưu trữ", { exact: true }).waitFor();
  assert.equal(await button("Gửi lời mời").count(), 0);
  assert.equal(await button("Tạo mã mời").count(), 0);
  await goto(`/trip/${tripId}/members`);
  await page.getByText("invitee@example.test", { exact: true }).waitFor();
  for (const name of ["Mời thành viên", "Gửi lại", "Thu hồi", "Xóa Bạn đồng hành"]) assert.equal(await button(name).count(), 0);
  assert.equal(calls.filter(call => ["POST", "PATCH", "PUT", "DELETE"].includes(call.method) && call.pathname.startsWith("/trips/")).length, writesBeforeArchive);
  await goto("/profile");
  await button("Phiên đăng nhập").click();
  await button("Đang dùng").click();
  await page.getByRole("heading", { name: "Thiết bị đang đăng nhập" }).waitFor();
  await button("Đã hiểu").click();
  await goto("/profile");
  // Sign-out asks first; a failed sign-out keeps the sheet open with the reason.
  await button("Đăng xuất").click();
  await page.getByRole("dialog").getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await page.getByText(/Chưa xác nhận được đăng xuất/).first().waitFor();
  assert.equal(loggedOut, false);
  logoutOffline = false;
  await page.getByRole("dialog").getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await page.waitForURL(`${appUrl}/`);
  await page.reload({ waitUntil: "networkidle" });
  await button("Bắt đầu hành trình").waitFor();
  assert.equal(calls.filter(call => call.pathname === "/auth/logout").length, 2);
  assert.deepEqual(errors, []);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log("Backend feature UI fixtures passed: recovery, verification, password change, avatar, LINK invitations, selected editors, member history, lost replies, async completion, finance block and archived Trip read-only controls.");
} catch (error) {
  await assertPublicText(page);
  await page.screenshot({ path: path.join(shots, "failure.png") });
  console.error("Page:", page.url(), "Errors:", errors, "Recent requests:", calls.slice(-8).map(({ pathname, method }) => ({ pathname, method })));
  console.error((await page.locator("body").innerText()).slice(-1800));
  throw error;
} finally { await browser.close(); }
import { Buffer } from "node:buffer";
