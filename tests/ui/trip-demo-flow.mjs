import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const appUrl = process.env.WOLFARI_PREVIEW_URL ?? "http://localhost:8082";
const output = path.resolve(".cache/visual/trip-demo");
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
assert.ok(executablePath, "Set WOLFARI_BROWSER_PATH to an installed browser.");
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
await context.addInitScript(() => {
  const active = new Set();
  window.__demoCoverUrls = active;
  const create = URL.createObjectURL.bind(URL);
  const revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (value) => {
    const uri = create(value);
    if (value instanceof File) active.add(uri);
    return uri;
  };
  URL.revokeObjectURL = (uri) => {
    active.delete(uri);
    revoke(uri);
  };
});
const apiCalls = [],
  pageErrors = [];
await context.route("**/api/v1/**", (route) => {
  const request = route.request();
  apiCalls.push({
    path: new URL(request.url()).pathname,
    method: request.method(),
  });
  return route.fulfill({
    status: 401,
    headers: {
      "Access-Control-Allow-Origin": appUrl,
      "Access-Control-Allow-Credentials": "true",
    },
    contentType: "application/json",
    body: JSON.stringify({
      error: { code: "UNAUTHENTICATED", message: "Demo is anonymous" },
    }),
  });
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);
page.setDefaultNavigationTimeout(180_000);
page.on("pageerror", (error) => pageErrors.push(error.message));
const button = (name) => page.getByRole("button", { name, exact: true });
const field = (name) => page.getByLabel(name, { exact: true });
const tab = (name) => page.getByRole("tab", { name, exact: true });
const text = (value) =>
  page.getByText(value, { exact: true }).filter({ visible: true });
async function shot(name) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "No horizontal page overflow",
  );
  await page.screenshot({ path: path.join(output, `${name}.png`) });
}
async function back() {
  await button("Quay lại").click();
  await button("Chỉnh sửa chuyến đi mẫu").waitFor();
}
async function chooseFixtureCover() {
  const choosing = page.waitForEvent("filechooser");
  await button("Chọn ảnh từ thiết bị").click();
  const chooser = await choosing;
  // Only a bundled fixture is selected. No upload API is present in the demo.
  await chooser.setFiles(path.resolve("assets/figma/coast-photo.jpg"));
  await button("Chọn ảnh từ thiết bị").waitFor();
}
try {
  const hydrated = page.waitForResponse(
    (response) => response.url().includes("/api/v1/auth/"),
    { timeout: 120_000 },
  );
  await page.goto(appUrl, { waitUntil: "networkidle" });
  // The server-rendered welcome appears before React hydrates on a cold Metro start.
  await hydrated;
  await button("Khám phá chuyến đi mẫu").click();
  await button("Chỉnh sửa chuyến đi mẫu").waitFor();
  await shot("01-overview");

  await button("Chỉnh sửa chuyến đi mẫu").click();
  // Saving normalizes text; it must not trigger an unsaved-changes prompt.
  await field("Tên chuyến đi mẫu").fill("  Chuyến đi giao diện mẫu  ");
  await field("Điểm đến").fill("Đà Lạt");
  await field("Ngân sách cả chuyến (VND)").fill("0");
  await button("Lưu chuyến đi mẫu").click();
  await page.getByText(/Nhập số tiền nguyên VND/).waitFor();
  await field("Ngân sách cả chuyến (VND)").fill("16000000");
  await page
    .getByRole("radio", { name: "Ảnh bìa Đà Lạt", exact: true })
    .click();
  await chooseFixtureCover();
  await page
    .getByRole("radio", { name: "Ảnh bìa Đà Lạt", exact: true, checked: false })
    .waitFor();
  await field("Tên chuyến đi mẫu").scrollIntoViewIfNeeded();
  await shot("02-details");
  await button("Lưu chuyến đi mẫu").click();
  await text("Chuyến đi giao diện mẫu").waitFor();
  await button("Chỉnh sửa chuyến đi mẫu").click();
  assert.equal(await field("Điểm đến").inputValue(), "Đà Lạt");
  assert.equal(
    await field("Ngân sách cả chuyến (VND)").inputValue(),
    "16000000",
  );
  assert.equal(
    await page
      .getByRole("radio", { name: "Ảnh bìa Đà Lạt", exact: true })
      .isChecked(),
    false,
    "Selected custom cover survives in-session navigation",
  );
  await field("Điểm đến").fill("Không lưu");
  await button("Quay lại").click();
  await button("Giữ nguyên").click();
  assert.equal(await field("Điểm đến").inputValue(), "Không lưu");
  await chooseFixtureCover();
  await page.waitForFunction(() => window.__demoCoverUrls.size === 2);
  await button("Hủy chỉnh sửa").click();
  await button("Bỏ chỉnh sửa").click();
  await page.waitForFunction(() => window.__demoCoverUrls.size === 1);
  await button("Chỉnh sửa chuyến đi mẫu").click();
  assert.equal(await field("Điểm đến").inputValue(), "Đà Lạt");
  await back();
  await button("Hành lý mẫu").click();
  await page
    .getByRole("checkbox", { name: "Đã chuẩn bị Áo sơ mi trắng", exact: true })
    .click();
  await tab("Của Mai").click();
  assert.equal(await page.getByRole("checkbox").count(), 2);
  await tab("Cả nhóm").click();
  await button("Thêm vật dụng mẫu").click();
  await field("Tên vật dụng").fill("Mũ thử giao diện");
  await field("Số lượng").fill("0");
  await button("Lưu vật dụng mẫu").click();
  await text("Số lượng từ 1 đến 999.").waitFor();
  await field("Số lượng").fill("2");
  await tab("Mai").click();
  await button("Lưu vật dụng mẫu").click();
  await text("Mũ thử giao diện").waitFor();
  await button("Sửa Mũ thử giao diện").click();
  await field("Ghi chú vật dụng").fill("Thử phân công và lưu qua màn hình");
  await button("Lưu vật dụng mẫu").click();
  await back();
  await button("Hành lý mẫu").click();
  await text("Thử phân công và lưu qua màn hình").waitFor();
  await button("Xóa Mũ thử giao diện").click();
  await button("Giữ nguyên").click();
  await text("Mũ thử giao diện").waitFor();
  await button("Xóa Mũ thử giao diện").click();
  await button("Xác nhận xóa vật dụng").click();
  await text("Mũ thử giao diện").waitFor({ state: "hidden" });
  await page.getByText("Gọn hành lý, nhẹ tâm trí").scrollIntoViewIfNeeded();
  await shot("03-packing");
  await back();

  await button("Dress code mẫu").click();
  await shot("04-dress-code");
  await button("Thêm dress code mẫu").click();
  await field("Tên dress code").fill("Bữa tối cùng nhau");
  await tab("Theo ngày").last().click();
  await tab("Ngày 3 · 14/11").click();
  await page.getByRole("radio", { name: "Đen & trắng", exact: true }).click();
  await field("Gợi ý trang phục").fill("Đơn giản và thoải mái.");
  await shot("05-dress-editor");
  await button("Lưu dress code mẫu").click();
  await text("Bữa tối cùng nhau").waitFor();
  await text("14/11/2026").waitFor();
  await back();

  await button("Quỹ nhóm mẫu").click();
  await shot("06-fund");
  await tab("Chờ xử lý (2)").click();
  await button("Xem xét Linh báo đã góp quỹ").click();
  await button("Xác nhận trong bản mẫu").click();
  await tab("Chờ xử lý (1)").waitFor();
  await button("Thêm khoản mẫu").click();
  await tab("Khoản chi").last().click();
  await field("Nội dung khoản").fill("Vé tham quan mẫu");
  await field("Số tiền (VND)").fill("99999999");
  await button("Thêm vào sổ mẫu").click();
  await button("Xem xét Vé tham quan mẫu").click();
  await button("Xác nhận trong bản mẫu").click();
  await page.getByText(/Số dư khả dụng không đủ/).waitFor();
  await button("Giữ nguyên").click();
  await button("Hủy Vé tham quan mẫu").click();
  await button("Xác nhận hủy khoản").click();
  await button("Xem xét Hoàn khoản ứng trước").click();
  await button("Xác nhận trong bản mẫu").click();
  await text("Chưa có khoản nào").waitFor();
  await tab("Lịch sử").click();
  await page.getByText(/Xác nhận mô phỏng: Hoàn khoản ứng trước/).waitFor();
  await shot("07-ledger-history");
  await back();
  await button("Đặt lại dữ liệu mẫu").click();
  await button("Xác nhận đặt lại").click();
  await text("Đà Nẵng, mình đi nhé!").waitFor();
  await page.waitForFunction(() => window.__demoCoverUrls.size === 0);
  await button("Quay lại").click();
  await button("Khám phá chuyến đi mẫu").waitFor();
  await button("Khám phá chuyến đi mẫu").click();
  await text("Đà Nẵng, mình đi nhé!").waitFor();

  // Deep links work anonymously; process/page reload restores the baseline.
  for (const route of ["", "/packing", "/dress-code", "/fund", "/details"]) {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(`${appUrl}/demo-trip${route}`, {
      waitUntil: "networkidle",
    });
    await text("CHUYẾN ĐI MẪU").waitFor();
    await shot(`small${route.replace("/", "-") || "-overview"}`);
  }
  assert.deepEqual(
    apiCalls.filter((call) => !call.path.startsWith("/api/v1/auth/")),
    [],
    "Demo must not call Trip or Finance APIs",
  );
  assert.deepEqual(pageErrors, [], "No browser runtime errors");
  console.log(
    "PASS trip demo: metadata, discard guard, cover cleanup, packing, dress code, fund, reset, anonymous deep links and 320px layout; no Trip/Finance requests.",
  );
} catch (error) {
  await page
    .screenshot({ path: path.join(output, "failure.png") })
    .catch(() => {});
  console.error("Page:", page.url(), "Runtime errors:", pageErrors);
  console.error(
    "Radio states:",
    await page
      .getByRole("radio")
      .evaluateAll((elements) =>
        elements.map((element) => ({
          label: element.getAttribute("aria-label"),
          checked: element.getAttribute("aria-checked"),
        })),
      ),
  );
  throw error;
} finally {
  await browser.close();
}
