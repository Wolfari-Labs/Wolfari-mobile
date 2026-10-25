import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const appUrl = process.env.WOLFARI_PREVIEW_URL ?? "http://localhost:8081";
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
assert.ok(executablePath);
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 402, height: 874 },
  hasTouch: true,
  reducedMotion: "reduce",
});
const output = path.resolve(".cache/visual");
await mkdir(output, { recursive: true });
const tripId = "20000000-0000-4000-8000-000000000001";
const profile = {
  id: "user",
  email: "fixture@example.test",
  full_name: "Minh Anh",
  status: "ACTIVE",
  system_role: "USER",
  version: 1,
  email_verified_at: null,
};
const trip = {
  id: tripId,
  name: "Lịch trình nhóm",
  description: null,
  start_at: "2026-11-12T00:00:00Z",
  end_at: "2026-11-13T16:59:00Z",
  timezone: "Asia/Ho_Chi_Minh",
  lifecycle: "UPCOMING",
  plan_edit_policy: "ALL_MEMBERS",
  plan_version: 1,
  export_revision: 1,
  membership_revision: 1,
  current_membership: { id: "member", user_id: "user", role: "MEMBER" },
  permissions: { can_read: true, can_update: false },
};
let editable = true,
  failNext = false,
  commits = 0;
let activities = ["Ăn sáng", "Tham quan", "Ăn trưa", "Ngày khác"].map(
  (title, index) => ({
    id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    trip_id: tripId,
    title,
    description: null,
    position: index,
    activity_type: "OTHER",
    starts_at: `2026-11-${index === 3 ? "13" : "12"}T0${index + 1}:00:00Z`,
    ends_at: null,
    status: "TODO",
    plan_version: 1,
  }),
);
const writes = [],
  receipts = new Map(),
  errors = [];
const currentPlan = () => ({
  trip_id: tripId,
  plan_version: trip.plan_version,
  export_revision: trip.export_revision,
  activities,
  selected_locations: [],
  packing_items: [],
  dress_codes: [],
  permissions: { can_read: true, can_edit: editable, can_complete: true },
});
await context.route("**/api/v1/**", async (route) => {
  const req = route.request(),
    endpoint = new URL(req.url()).pathname.replace("/api/v1", ""),
    method = req.method();
  const headers = {
    "Access-Control-Allow-Origin": appUrl,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers":
      "Content-Type,Authorization,X-Client-Type,X-CSRF-Token,Idempotency-Key",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  };
  const respond = (data, status = 200) =>
    route.fulfill({
      status,
      headers,
      contentType: "application/json",
      body: JSON.stringify({ data, meta: {} }),
    });
  const fail = (status, code) =>
    route.fulfill({
      status,
      headers,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code, message: "Fixture", retryable: status === 503 },
        meta: {},
      }),
    });
  if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
  if (endpoint === "/auth/csrf") return respond({ csrf_token: "fixture-csrf" });
  if (endpoint === "/auth/refresh" || endpoint === "/auth/login")
    return respond({
      access_token: "fixture-token",
      token_type: "Bearer",
      expires_in: 900,
      profile,
    });
  if (endpoint === "/trips")
    return respond({ items: [trip], next_cursor: null });
  if (endpoint === `/trips/${tripId}`) return respond(trip);
  if (endpoint === `/trips/${tripId}/plan`) return respond(currentPlan());
  if (endpoint === `/trips/${tripId}/activities/order`) {
    assert.equal(method, "PUT");
    const body = req.postDataJSON(),
      key = req.headers()["idempotency-key"];
    writes.push({ body, key });
    if (!editable) return fail(403, "PERMISSION_DENIED");
    if (receipts.has(key)) return respond(receipts.get(key));
    if (body.expected_plan_version !== trip.plan_version)
      return fail(409, "VERSION_CONFLICT");
    assert.deepEqual(
      [...body.activity_ids].sort(),
      activities.map((a) => a.id).sort(),
    );
    activities = body.activity_ids.map((id, position) => ({
      ...activities.find((a) => a.id === id),
      position,
    }));
    trip.plan_version++;
    trip.export_revision++;
    commits++;
    const result = {
      trip_id: tripId,
      plan_version: trip.plan_version,
      export_revision: trip.export_revision,
    };
    receipts.set(key, result);
    if (failNext) {
      failNext = false;
      return fail(503, "SERVICE_UNAVAILABLE");
    }
    return respond(result);
  }
  return fail(404, "RESOURCE_NOT_FOUND");
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);
page.setDefaultNavigationTimeout(90_000);
page.on("pageerror", (error) => errors.push(error.message));
const button = (name) => page.getByRole("button", { name, exact: true });
async function openEditor() {
  await button("Sắp xếp lịch trình").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[aria-label="Kéo để di chuyển Ăn sáng"]')
        ?.getAttribute("aria-disabled") !== "true" &&
      !!document.querySelector('[aria-label="Kéo để di chuyển Ăn sáng"]'),
  );
}
async function dragTo(title, targetTitle) {
  const handle = page.getByLabel(`Kéo để di chuyển ${title}`, { exact: true });
  const target = page.getByLabel(`Kéo để di chuyển ${targetTitle}`, {
    exact: true,
  });
  const from = await handle.boundingBox(),
    to = await target.boundingBox();
  assert.ok(from && to);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(350); // Intentional long-press activation, not a network wait.
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
}

async function checkTouchGestures() {
  const cdp = await context.newCDPSession(page);
  const grip = page.getByLabel("Kéo để di chuyển Ăn sáng", { exact: true });
  const idle = page.getByText("Nhấn giữ ☰ rồi kéo · Vuốt phần tên để cuộn", { exact: true });
  const save = button("Lưu thứ tự cho nhóm");
  const start = async () => {
    const from = await grip.boundingBox();
    const to = await page.getByLabel("Kéo để di chuyển Tham quan", { exact: true }).boundingBox();
    assert.ok(from && to);
    const point = { id: 1, x: from.x + from.width / 2, y: from.y + from.height / 2 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await page.waitForTimeout(350); // User holds the grip before moving.
    const startY = point.y;
    for (let step = 1; step <= 8; step++) {
      point.y = startY + (to.y + to.height / 2 - startY) * step / 8;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point] });
    }
    await page.getByText("Thả vào vị trí 2 / 3 · Chưa lưu", { exact: true }).waitFor();
    assert.equal(await save.isDisabled(), true);
    assert.equal(await button("Đóng").isDisabled(), true);
    return point;
  };
  for (const reason of ["cancel", "second-finger", "background", "resize"]) {
    const point = await start();
    if (reason === "cancel") {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    } else if (reason === "second-finger") {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [point, { ...point, id: 2, x: point.x - 20 }],
      });
    } else if (reason === "background") {
      // Simulate the web AppState lifecycle, without changing actual device state.
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
    } else {
      await page.setViewportSize({ width: 403, height: 874 });
    }
    await idle.waitFor();
    if (reason !== "cancel") {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    if (reason === "background") {
      await page.evaluate(() => {
        delete document.visibilityState;
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await page.getByText("Phiên bản 1 · Đã đồng bộ", { exact: true }).waitFor();
    }
    if (reason === "resize") await page.setViewportSize({ width: 402, height: 874 });
    assert.equal(await save.isDisabled(), true, `${reason} must not reorder`);
    assert.equal(await button("Đưa Ăn sáng lên").isDisabled(), true);
    assert.equal(writes.length, 0, "Dragging must not write before explicit Save");
  }
  // A normal touch release does commit the local draft; a reverse drag restores it.
  await start();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await idle.waitFor();
  assert.equal(await save.isDisabled(), false);
  assert.equal(writes.length, 0);
  await dragTo("Ăn sáng", "Tham quan");
  assert.equal(await save.isDisabled(), true);
  await cdp.detach();
}
try {
  await page.goto(`${appUrl}/trip/${tripId}/itinerary`, {
    waitUntil: "networkidle",
  });
  // Long-press on a timeline card opens the editor, while a tap still opens details.
  await button("Ăn sáng, 08:00").click();
  await page.getByRole("button", { name: "Chỉnh sửa hoạt động", exact: true }).waitFor();
  await button("Đóng").click();
  const card = await button("Ăn sáng, 08:00").boundingBox();
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  await page.mouse.down();
  await page.getByLabel("Kéo để di chuyển Ăn sáng", { exact: true }).waitFor();
  await page.mouse.up();
  await button("Đóng").click();
  await openEditor();
  // A quick swipe before the hold delay does not accidentally reorder.
  const quickFrom = await page.getByLabel("Kéo để di chuyển Ăn sáng", { exact: true }).boundingBox();
  await page.mouse.move(quickFrom.x + quickFrom.width / 2, quickFrom.y + quickFrom.height / 2);
  await page.mouse.down();
  await page.mouse.move(quickFrom.x + quickFrom.width / 2, quickFrom.y + quickFrom.height / 2 + 90);
  await page.mouse.up();
  assert.equal(await button("Lưu thứ tự cho nhóm").isDisabled(), true);
  await checkTouchGestures();
  // Actual pointer drag, not just the accessible arrow fallback.
  await dragTo("Ăn sáng", "Tham quan");
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[role="button"]')].some(
      (el) =>
        el.getAttribute("aria-label") === "Lưu thứ tự cho nhóm" &&
        el.getAttribute("aria-disabled") !== "true",
    ),
  );
  // Repeat after keyed rows moved, including restoring the original order.
  await dragTo("Ăn sáng", "Tham quan");
  assert.equal(await button("Lưu thứ tự cho nhóm").isDisabled(), true);
  await dragTo("Ăn sáng", "Ăn trưa");
  await dragTo("Ăn sáng", "Ăn trưa");
  await page.screenshot({
    path: path.join(output, "glass-itinerary-order.png"),
  });
  await button("Lưu thứ tự cho nhóm").click();
  await page
    .getByText(
      "Đã lưu thứ tự cho cả nhóm. Giờ của các hoạt động được giữ nguyên.",
    )
    .waitFor();
  assert.deepEqual(
    activities.map((a) => a.title),
    ["Tham quan", "Ăn sáng", "Ăn trưa", "Ngày khác"],
  );

  // Two editors hold the same version; the second cannot overwrite the first.
  await openEditor();
  await button("Đưa Ăn sáng xuống").click();
  const peer = await context.newPage();
  peer.on("pageerror", (e) => errors.push(e.message));
  await peer.goto(`${appUrl}/trip/${tripId}/itinerary`, {
    waitUntil: "networkidle",
  });
  await peer
    .getByRole("button", { name: "Sắp xếp lịch trình", exact: true })
    .click();
  await peer
    .getByRole("button", { name: "Đưa Tham quan xuống", exact: true })
    .click();
  await peer
    .getByRole("button", { name: "Lưu thứ tự cho nhóm", exact: true })
    .click();
  await peer
    .getByText(
      "Đã lưu thứ tự cho cả nhóm. Giờ của các hoạt động được giữ nguyên.",
    )
    .waitFor();
  const peerOrder = activities.map((a) => a.id);
  await button("Lưu thứ tự cho nhóm").click();
  await page.getByText(/Không ghi đè thay đổi của họ/).waitFor();
  assert.deepEqual(
    activities.map((a) => a.id),
    peerOrder,
  );
  assert.equal(await button("Lưu thứ tự cho nhóm").isDisabled(), true);
  await page.screenshot({
    path: path.join(output, "glass-itinerary-conflict.png"),
  });
  await button("Bỏ bản nháp, tải bản mới").click();
  await page.getByText(`Phiên bản ${trip.plan_version} · Đã đồng bộ`).waitFor();

  // A committed write with a lost reply is retried with exactly the same intent.
  await button("Đưa Ăn sáng xuống").click();
  failNext = true;
  const before = commits;
  await button("Lưu thứ tự cho nhóm").click();
  await button("Thử lưu lại").waitFor();
  assert.equal(await button("Đưa Ăn sáng xuống").isDisabled(), true);
  await button("Thử lưu lại").click();
  await page
    .getByText(
      "Đã lưu thứ tự cho cả nhóm. Giờ của các hoạt động được giữ nguyên.",
    )
    .waitFor();
  assert.equal(commits, before + 1);
  assert.deepEqual(writes.at(-1), writes.at(-2));

  // Revoked permissions, discard confirmation, and small-screen layout.
  await page.setViewportSize({ width: 320, height: 640 });
  await openEditor();
  await button("Đưa Ăn sáng xuống").click();
  await button("Đóng").click();
  await button("Tiếp tục sắp xếp").click();
  editable = false;
  await button("Lưu thứ tự cho nhóm").click();
  await page.getByText(/Bạn không còn quyền sửa kế hoạch này/).waitFor();
  assert.equal(await button("Lưu thứ tự cho nhóm").isDisabled(), true);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: path.join(output, "glass-itinerary-small.png"),
  });
  await button("Bỏ bản nháp, tải bản mới").click();
  await page.getByText(/Bạn chỉ có quyền xem/).waitFor();
  assert.equal(await button("Đưa Ăn sáng xuống").isDisabled(), true);

  // A long, variable-height day auto-scrolls while dragging near the edge.
  await button("Đóng").click();
  editable = true;
  activities.push(
    ...Array.from({ length: 9 }, (_, index) => ({
      ...activities[0],
      id: `60000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      title: `Điểm ${index + 1} · Khám phá và nghỉ chân cùng nhóm trong chuyến đi`,
      position: activities.length + index,
      starts_at: "2026-11-12T07:00:00Z",
    })),
  );
  trip.plan_version++;
  await page.setViewportSize({ width: 402, height: 874 });
  await page.reload({ waitUntil: "networkidle" });
  await openEditor();
  const firstTitle = activities[0].title;
  const handle = await page
    .getByLabel(`Kéo để di chuyển ${firstTitle}`, { exact: true })
    .boundingBox();
  const viewport = await page.getByTestId("activity-order-list").boundingBox();
  assert.ok(handle && viewport);
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(350);
  await page.mouse.move(
    handle.x + handle.width / 2,
    viewport.y + viewport.height - 15,
    { steps: 12 },
  );
  await page.waitForFunction(() =>
    [
      ...document.querySelectorAll('[data-testid="activity-order-list"] *'),
    ].some((el) => el.scrollTop > 350),
  );
  await page.mouse.up();
  await button("Lưu thứ tự cho nhóm").click();
  await page
    .getByText(
      "Đã lưu thứ tự cho cả nhóm. Giờ của các hoạt động được giữ nguyên.",
    )
    .waitFor();
  assert.ok(activities.findIndex((a) => a.title === firstTitle) > 3);
  assert.equal(activities[3].title, "Ngày khác");
  await peer.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS card long-press, touch drag/drop, cancel/multitouch/background/resize guards, hold-to-drag, quick-swipe guard, repeated drag/drop, long-list auto-scroll, atomic full order, two-editor conflict, lost-response idempotency, revoked permissions, discard and 320px layout (API fixtures only).",
  );
} catch (error) {
  await page
    .screenshot({ path: path.join(output, "order-failure.png") })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
