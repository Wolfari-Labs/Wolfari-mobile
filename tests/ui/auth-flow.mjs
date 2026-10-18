import assert from "node:assert/strict";
import { mkdir, access } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const appUrl = process.env.WOLFARI_PREVIEW_URL ?? "http://localhost:8081";
const output = path.resolve(".cache/visual");
await mkdir(output, { recursive: true });

const candidates = [
  process.env.WOLFARI_BROWSER_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);
let executablePath;
for (const candidate of candidates) {
  if (await access(candidate).then(() => true, () => false)) { executablePath = candidate; break; }
}
assert.ok(executablePath, "Set WOLFARI_BROWSER_PATH to an installed Chromium browser.");

const browser = await chromium.launch({ executablePath, headless: true });
const requests = [];
const pageErrors = [];
const context = await browser.newContext({ viewport: { width: 402, height: 874 } });

// Contract fixture only: these tests never create accounts or send email on a real backend.
await context.route("**/api/v1/**", async (route) => {
  const request = route.request();
  const pathname = new URL(request.url()).pathname;
  const cors = { "Access-Control-Allow-Origin": appUrl, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Content-Type, X-Client-Type, Authorization, X-CSRF-Token", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
  if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  const body = request.postData() ? request.postDataJSON() : undefined;
  requests.push({ pathname, method: request.method(), body, headers: request.headers() });
  const respond = (status, data) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(data) });
  const error = (status, code) => respond(status, { error: { code, message: "Không thể hoàn tất yêu cầu", details: null, retryable: status === 503 }, meta: { correlation_id: "fixture-correlation" } });
  if (pathname.endsWith("/auth/csrf")) return error(401, "UNAUTHENTICATED");
  if (pathname.endsWith("/trips")) return respond(200, { data: { items: [], next_cursor: null }, meta: {} });
  if (pathname.endsWith("/auth/register")) return respond(202, { data: { message_code: "REQUEST_ACCEPTED" }, meta: {} });
  if (pathname.endsWith("/auth/login")) {
    if (body.email === "unavailable@example.test") return error(503, "SERVICE_UNAVAILABLE");
    if (body.password !== "a long test password") return error(401, "UNAUTHENTICATED");
    return respond(200, {
      data: { access_token: "fixture-access", token_type: "Bearer", expires_in: 900, profile: {
        id: "fixture-user", email: body.email, full_name: "Minh Anh", avatar: null,
        system_role: "USER", status: "ACTIVE", email_verified_at: null, version: 1,
      } }, meta: {},
    });
  }
  return error(404, "RESOURCE_NOT_FOUND");
});

const page = await context.newPage();
page.setDefaultNavigationTimeout(90_000);
page.on("pageerror", (error) => pageErrors.push(error.message));

async function checkImages(minimumCount) {
  // Expo Image mounts its web <img> elements after hydration; an empty image list
  // must not pass the "every image loaded" check on server-rendered markup.
  await page.waitForFunction((count) => document.images.length >= count && Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0), minimumCount);
  const images = await page.locator("img").evaluateAll((nodes) => nodes.map((node) => ({ src: node.currentSrc || node.src, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, naturalWidth: node.naturalWidth })));
  assert.ok(images.length > 0);
  assert.ok(images.every((img) => !img.src.includes("figma.com") && img.width > 0 && img.height > 0));
  return images;
}

async function noHorizontalOverflow() {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
}

try {
  await page.goto(`${appUrl}/?preview=1`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Bắt đầu hành trình", exact: true }).waitFor();
  const guestImages = await checkImages(12);
  assert.ok(guestImages.some((img) => img.naturalWidth === 354 && Math.abs(img.width - 354) < 1 && Math.abs(img.height - 234) < 1), "Destination illustration keeps the 354 x 234 design slot.");
  await noHorizontalOverflow();
  await page.screenshot({ path: path.join(output, "m01-guest.png") });
  await page.getByRole("button", { name: "Bắt đầu hành trình", exact: true }).click();
  await page.waitForURL("**/sign-up");

  await page.goto(`${appUrl}/sign-up?preview=1`, { waitUntil: "networkidle" });
  await page.getByRole("checkbox").click();
  await checkImages(9);
  await page.screenshot({ path: path.join(output, "m03-sign-up.png") });
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await page.getByText("Vui lòng nhập địa chỉ email hợp lệ.", { exact: true }).waitFor();
  assert.equal(requests.filter((request) => request.pathname.endsWith("/auth/register")).length, 0);
  await page.getByLabel("Họ và tên", { exact: true }).fill("  Minh Anh  ");
  await page.getByLabel("Email", { exact: true }).fill(" DEMO@EXAMPLE.TEST ");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("short");
  await page.getByLabel("Nhập lại mật khẩu", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await page.getByText("Mật khẩu phải có từ 15 đến 128 ký tự.", { exact: true }).waitFor();
  await page.getByLabel("Mật khẩu", { exact: true }).fill("a long test password");
  await page.getByLabel("Nhập lại mật khẩu", { exact: true }).fill("a long test password");
  const registrationPassword = page.getByLabel("Mật khẩu", { exact: true });
  const confirmationPassword = page.getByLabel("Nhập lại mật khẩu", { exact: true });
  assert.equal(await registrationPassword.getAttribute("type"), "password");
  await page.getByRole("button", { name: "Hiện mật khẩu", exact: true }).click();
  assert.equal(await registrationPassword.evaluate(input => input.type), "text");
  assert.equal(await confirmationPassword.getAttribute("type"), "password");
  await registrationPassword.focus();
  await page.getByRole("button", { name: "Ẩn mật khẩu", exact: true }).click();
  assert.equal(await registrationPassword.evaluate(input => input.type), "password");
  await page.getByRole("button", { name: "Hiện nhập lại mật khẩu", exact: true }).click();
  assert.equal(await confirmationPassword.evaluate(input => input.type), "text");
  await page.getByRole("button", { name: "Ẩn nhập lại mật khẩu", exact: true }).click();
  assert.equal(await confirmationPassword.inputValue(), "a long test password");
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await page.getByText("Vui lòng đồng ý với điều khoản trước khi tạo tài khoản.", { exact: true }).waitFor();
  assert.equal(requests.filter((request) => request.pathname.endsWith("/auth/register")).length, 0);
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await page.getByRole("heading", { name: "Kiểm tra email của bạn" }).waitFor();
  const registration = requests.find((request) => request.pathname.endsWith("/auth/register"));
  assert.deepEqual(Object.keys(registration.body).sort(), ["email", "full_name", "password"]);
  assert.equal(registration.body.email, "demo@example.test");
  assert.equal(registration.body.full_name, "Minh Anh");
  assert.equal(requests.filter((request) => request.pathname.endsWith("/auth/login")).length, 0, "Registration does not automatically log in.");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL("**/sign-in");

  await page.goto(`${appUrl}/sign-in?preview=1`, { waitUntil: "networkidle" });
  const signInImages = await checkImages(9);
  assert.ok(signInImages.some((img) => Math.abs(img.width - 92) < 1 && Math.abs(img.height - 92) < 1), "Mascot keeps the 92 x 92 design slot.");
  assert.ok(signInImages.some((img) => Math.abs(img.width - 354) < 1 && Math.abs(img.height - 150) < 1), "Lake image keeps the 354 x 150 design slot.");
  await page.screenshot({ path: path.join(output, "m02-sign-in.png") });
  await page.getByLabel("Email", { exact: true }).fill("demo@example.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("wrong password");
  await page.getByRole("button", { name: "Hiện mật khẩu", exact: true }).click();
  assert.equal(await page.getByLabel("Mật khẩu", { exact: true }).evaluate(input => input.type), "text");
  await page.getByLabel("Mật khẩu", { exact: true }).focus();
  await page.getByRole("button", { name: "Ẩn mật khẩu", exact: true }).click();
  assert.equal(await page.getByLabel("Mật khẩu", { exact: true }).evaluate(input => input.type), "password");
  assert.equal(await page.getByLabel("Mật khẩu", { exact: true }).inputValue(), "wrong password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByText("Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, "m02-invalid-credentials.png") });
  await page.getByLabel("Email", { exact: true }).fill("unavailable@example.test");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByText("Hệ thống đang bận. Vui lòng thử lại sau ít phút.", { exact: true }).waitFor();
  await page.getByLabel("Email", { exact: true }).fill(" DEMO@EXAMPLE.TEST ");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("a long test password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByRole("heading", { name: "Đi đâu tiếp nhỉ?" }).waitFor();
  const login = requests.findLast(request => request.pathname.endsWith("/auth/login"));
  assert.equal(login.body.email, "demo@example.test");
  assert.equal(login.headers["x-client-type"], "web");

  // Small phone: keyboard fields and actions remain scrollable with no horizontal clipping.
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`${appUrl}/sign-up?preview=1`, { waitUntil: "networkidle" });
  await noHorizontalOverflow();
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, "m03-small-phone.png") });
  assert.deepEqual(pageErrors, []);
  process.stdout.write("UI checks passed: all three screens, local assets and geometry, navigation, registration validation/consent/202, login 401/503/success, and 360px layout.\n");
  process.stdout.write(`Screenshots: ${output}\n`);
} finally {
  await browser.close();
}
