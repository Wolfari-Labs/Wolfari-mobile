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
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
}
try {
  await page.goto(`${appUrl}/trip/${tripId}/itinerary`, {
    waitUntil: "networkidle",
  });
  await openEditor();
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
    "PASS repeated drag/drop, long-list auto-scroll, atomic full order, two-editor conflict, lost-response idempotency, revoked permissions, discard and 320px layout (API fixtures only).",
  );
} catch (error) {
  await page
    .screenshot({ path: path.join(output, "order-failure.png") })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
