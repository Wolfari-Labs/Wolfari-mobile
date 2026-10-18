import assert from "node:assert/strict";
import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const appUrl = process.env.WOLFARI_PREVIEW_URL ?? "http://localhost:8082";
assert.ok(
  process.env.WOLFARI_TEST_EMAIL && process.env.WOLFARI_TEST_PASSWORD,
  "Configure the local test account first.",
);
const { tripId } = JSON.parse(
  await readFile(".cache/backend-demo.json", "utf8"),
);
assert.ok(
  tripId,
  "Run the backend check with --auth --trips --seed-demo first.",
);
const output = path.resolve(".cache/visual");
await mkdir(output, { recursive: true });
let executablePath;
for (const candidate of [
  process.env.WOLFARI_BROWSER_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean)) {
  if (
    await access(candidate).then(
      () => true,
      () => false,
    )
  ) {
    executablePath = candidate;
    break;
  }
}
assert.ok(executablePath, "An installed Chromium browser is required.");
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 402, height: 874 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.setDefaultTimeout(30_000);
page.setDefaultNavigationTimeout(90_000);
const pageErrors = [],
  failedRequests = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("response", (response) => {
  const pathname = new URL(response.url()).pathname;
  if (
    pathname.startsWith("/api/v1/") &&
    response.status() >= 400 &&
    pathname !== "/api/v1/auth/csrf"
  )
    failedRequests.push({ pathname, status: response.status() });
});
const button = (name) => page.getByRole("button", { name, exact: true });
async function capture(name) {
  await page.waitForFunction(
    () =>
      document.images.length > 0 &&
      Array.from(document.images).every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
  );
  // Expo Image reveals decoded images on the next render frame.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: path.join(output, `live-${name}.png`) });
}
try {
  // The CSRF request starts in SessionProvider's client effect. Waiting for it
  // prevents filling SSR inputs before hydration attaches their event handlers.
  const sessionReady = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/v1/auth/csrf",
  );
  await page.goto(`${appUrl}/sign-in`, { waitUntil: "networkidle" });
  await sessionReady;
  await page
    .getByLabel("Email", { exact: true })
    .fill(process.env.WOLFARI_TEST_EMAIL);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(process.env.WOLFARI_TEST_PASSWORD);
  const [login] = await Promise.all([
    page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/v1/auth/login",
    ),
    button("Đăng nhập").click(),
  ]);
  assert.equal(login.status(), 200);
  await page.getByRole("heading", { name: "Đi đâu tiếp nhỉ?" }).waitFor();
  await button("Mở chuyến đi Đà Nẵng · Expo Go").waitFor();
  await capture("home");
  await button("Mở chuyến đi Đà Nẵng · Expo Go").click();
  await page.getByRole("tab", { name: "Tổng quan", exact: true }).waitFor();
  await capture("overview");
  await page.getByRole("tab", { name: "Lịch trình", exact: true }).click();
  await button("Dạo biển Mỹ Khê, 08:00").waitFor();
  const firstDay = page.getByRole("tab", { name: /^Ngày 1 ·/ });
  const dayBounds = await firstDay.boundingBox();
  assert.ok(
    dayBounds && dayBounds.width > 100 && dayBounds.height <= 48,
    "Day tabs stay readable in the horizontal scroller.",
  );
  await capture("itinerary");
  await page.setViewportSize({ width: 360, height: 740 });
  await capture("itinerary-small-phone");
  await page.setViewportSize({ width: 402, height: 874 });
  await button("Dạo biển Mỹ Khê, 08:00").click();
  await button("Chỉnh sửa hoạt động").waitFor();
  await capture("activity-detail");
  await button("Xóa hoạt động").click();
  await button("Xác nhận xóa hoạt động").waitFor();
  await button("Giữ lại").click();
  await button("Chỉnh sửa hoạt động").waitFor();
  await button("Đóng").click();
  await page.getByRole("tab", { name: "Bản đồ", exact: true }).click();
  await page
    .getByLabel("Khám phá địa điểm", { exact: true })
    .fill("Mỹ Khê Đà Nẵng");
  await button("Tìm địa điểm").click();
  await page.getByText(/Nguồn:/).waitFor();
  assert.equal(
    await page.getByText("PROVIDER_NOT_CONFIGURED", { exact: true }).count(),
    0,
  );
  await capture("places");
  await page.getByRole("tab", { name: "Tiện ích", exact: true }).click();
  await button("Thành viên").click();
  await button("Mời thành viên").waitFor();
  await capture("members");
  await page.getByRole("tab", { name: "Tài khoản", exact: true }).click();
  await button("Chỉnh sửa hồ sơ").waitFor();
  await capture("profile");
  assert.equal(
    await button("Quay lại").count(),
    0,
    "The account tab has no back action.",
  );
  await button("Đăng xuất").scrollIntoViewIfNeeded();
  const accountTab = page.getByRole("tab", { name: "Tài khoản", exact: true });
  const logoutBounds = await button("Đăng xuất").boundingBox();
  const tabBounds = await accountTab.boundingBox();
  assert.ok(
    logoutBounds &&
      tabBounds &&
      logoutBounds.y + logoutBounds.height <= tabBounds.y,
    "The last profile action scrolls above the tab bar.",
  );
  assert.ok(
    tabBounds.height >= 44,
    "Tab targets remain at least 44 points tall.",
  );
  await button("Chỉnh sửa hồ sơ").click();
  await page.getByLabel("Họ và tên", { exact: true }).waitFor();
  await page.setViewportSize({ width: 320, height: 400 });
  await page.getByLabel("Email", { exact: true }).scrollIntoViewIfNeeded();
  const saveBounds = await button("Lưu thay đổi").boundingBox();
  assert.ok(
    saveBounds &&
      saveBounds.height >= 44 &&
      saveBounds.y + saveBounds.height <= 400,
    "The form footer stays visible on a narrow, short viewport.",
  );
  await capture("edit-profile-small-phone");
  await button("Quay lại").click();
  await page.setViewportSize({ width: 402, height: 874 });
  await button("Phiên đang đăng nhập").click();
  await button("Thu hồi phiên này").first().waitFor();
  await capture("sessions");
  await page.setViewportSize({ width: 360, height: 740 });
  await capture("sessions-small-phone");
  assert.deepEqual(failedRequests, []);
  assert.deepEqual(pageErrors, []);
  console.log(
    "Live backend UI passed: browser login, actual home/trip/itinerary/detail, Travel error state, members, profile and sessions at 402px/360px. No API interception.",
  );
} catch (error) {
  await page.screenshot({ path: path.join(output, "live-failure.png") });
  console.error(
    "Page:",
    new URL(page.url()).pathname,
    "API failures:",
    failedRequests,
    "UI errors:",
    pageErrors,
  );
  throw error;
} finally {
  await browser.close();
}
