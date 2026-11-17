import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { chromium } from "playwright-core";

const appUrl = process.env.WOLFARI_PREVIEW_URL ?? "http://localhost:8082";
let executablePath;
for (const candidate of [
  process.env.WOLFARI_BROWSER_PATH,
  chromium.executablePath(),
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean))
  if (
    await access(candidate).then(
      () => true,
      () => false,
    )
  ) {
    executablePath = candidate;
    break;
  }
assert.ok(executablePath);
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const uid = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tripId = uid(1),
  userId = uid(2),
  memberId = uid(3),
  itemId = uid(4);
let version = 1,
  editable = true,
  conflict = false;
let rows = [];
const writes = [],
  errors = [];
const cors = {
  "Access-Control-Allow-Origin": appUrl,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Type, X-CSRF-Token, Idempotency-Key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};
const trip = {
  id: tripId,
  name: "Hành lý đồng bộ",
  start_at: "2026-12-01T00:00:00Z",
  end_at: "2026-12-03T00:00:00Z",
  timezone: "Asia/Ho_Chi_Minh",
  lifecycle: "UPCOMING",
  plan_edit_policy: "OWNER_ONLY",
  current_membership: { id: memberId, user_id: userId, role: "OWNER" },
  permissions: { can_read: true, can_update: true },
};
await context.route("**/api/v1/**", async (route) => {
  const req = route.request(),
    url = new URL(req.url()),
    path = url.pathname.replace("/api/v1", ""),
    method = req.method();
  const respond = (data, status = 200) =>
    route.fulfill({
      headers: cors,
      status,
      contentType: "application/json",
      body: JSON.stringify({ data, meta: {} }),
    });
  if (method === "OPTIONS") return route.fulfill({ headers: cors, status: 204 });
  if (path === "/auth/refresh" || path === "/auth/login")
    return respond({
      access_token: "fixture",
      token_type: "Bearer",
      expires_in: 900,
      profile: {
        id: userId,
        full_name: "Người kiểm thử",
        email: "fixture@example.test",
        version: 1,
      },
    });
  if (path === "/auth/csrf") return respond({ csrf_token: "fixture" });
  if (path === `/trips/${tripId}`)
    return respond({
      ...trip,
      plan_version: version,
      export_revision: version,
      membership_revision: 1,
    });
  if (path.endsWith("/members"))
    return respond({
      items: [
        {
          ...trip.current_membership,
          trip_id: tripId,
          joined_at: "2026-11-01T00:00:00Z",
          left_at: null,
        },
      ],
      next_cursor: null,
    });
  if (path.endsWith("/plan"))
    return respond({
      trip_id: tripId,
      plan_version: version,
      export_revision: version,
      activities: [],
      selected_locations: [],
      dress_codes: [],
      packing_items: rows,
      permissions: { can_read: true, can_edit: editable, can_complete: editable },
      capabilities: { packing_write: true },
    });
  if (path.includes("/packing-items") && method !== "GET") {
    const body = req.postDataJSON(),
      key = req.headers()["idempotency-key"];
    assert.match(key, /^[\da-f-]{36}$/i);
    writes.push({ method, path, body, key });
    if (conflict) {
      conflict = false;
      return route.fulfill({
        headers: cors,
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "VERSION_CONFLICT", message: "Plan changed" } }),
      });
    }
    assert.equal(body.expected_plan_version, version);
    version++;
    if (method === "DELETE") {
      rows = [];
      return respond({ deleted: true, plan_version: version });
    }
    if (method === "POST")
      rows = [{ ...body, id: itemId, trip_id: tripId, status: "TODO", completed_by_user_id: null }];
    else if (path.endsWith("/completion"))
      Object.assign(rows[0], {
        status: body.status,
        completed_by_user_id: body.status === "COMPLETED" ? userId : null,
      });
    else Object.assign(rows[0], body);
    return respond({ ...rows[0], plan_version: version }, method === "POST" ? 201 : 200);
  }
  return route.fulfill({
    headers: cors,
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "RESOURCE_NOT_FOUND" } }),
  });
});
const page = await context.newPage();
page.setDefaultTimeout(30000);
page.on("pageerror", (error) => errors.push(error.message));
const button = (name) => page.getByRole("button", { name, exact: true });
const field = (name) => page.getByLabel(name, { exact: true });
const open = async () => {
  await page.goto(`${appUrl}/trip/${tripId}/packing`, { waitUntil: "networkidle" });
  await page.getByText(/Cả nhóm đã chuẩn bị/).waitFor();
};
try {
  await open();
  await button("Thêm vật dụng").click();
  await button("Lưu cho cả nhóm").click();
  await page.getByText("Nhập tên vật dụng.", { exact: true }).waitFor();
  assert.equal(writes.length, 0);
  await field("Tên vật dụng").fill("Nước uống");
  await field("Số lượng").fill("1.25");
  await button("Lưu cho cả nhóm").click();
  await page.getByText("Đã lưu vật dụng cho cả nhóm.", { exact: true }).waitFor();
  await button("Hoàn thành Nước uống").click();
  await button("Bỏ hoàn thành Nước uống").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await button("Bỏ hoàn thành Nước uống").waitFor();
  conflict = true;
  await button("Sửa Nước uống").click();
  await field("Tên vật dụng").fill("Nước mới");
  await button("Lưu cho cả nhóm").click();
  await button("Tải kế hoạch mới nhất").click();
  await button("Sửa Nước uống").waitFor();
  await button("Xóa Nước uống").click();
  await button("Xóa vật dụng").click();
  await page.getByText("Nước uống", { exact: true }).waitFor({ state: "hidden" });
  editable = false;
  await open();
  assert.equal(await button("Thêm vật dụng").count(), 0);
  assert.deepEqual(errors, []);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  console.log(
    "PASS shared packing UI: validation, create, completion, reload, version conflict, delete, viewer permissions. HTTP fixtures only.",
  );
} catch (error) {
  console.error(
    "Page:",
    page.url(),
    "Errors:",
    errors,
    (await page.locator("body").innerText()).slice(-1800),
  );
  throw error;
} finally {
  await browser.close();
}
