import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const appUrl = process.env.WOLFARI_PREVIEW_URL ?? "http://localhost:8082";
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
assert.ok(executablePath, "Set WOLFARI_BROWSER_PATH to an installed browser.");
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 402, height: 874 },
  reducedMotion: "reduce",
});
const userId = "10000000-0000-4000-8000-000000000001",
  tripId = "20000000-0000-4000-8000-000000000001",
  memberId = "30000000-0000-4000-8000-000000000001";
let profile = {
  id: userId,
  email: "demo@example.test",
  full_name: "Minh Anh",
  avatar: null,
  system_role: "USER",
  status: "ACTIVE",
  email_verified_at: null,
  version: 1,
};
const membership = {
  id: memberId,
  trip_id: tripId,
  user_id: userId,
  role: "OWNER",
  joined_at: "2026-10-01T00:00:00Z",
  left_at: null,
};
let trip = {
  id: tripId,
  name: "Đà Nẵng cùng nhau",
  description: "Hẹn những ngày thật đẹp",
  public_description: null,
  start_at: "2026-11-11T17:00:00.000Z",
  end_at: "2026-11-14T16:59:00.000Z",
  timezone: "Asia/Ho_Chi_Minh",
  lifecycle: "UPCOMING",
  archived_at: null,
  plan_edit_policy: "OWNER_ONLY",
  plan_version: 1,
  membership_revision: 1,
  export_revision: 1,
  current_membership: membership,
  permissions: { can_read: true, can_update: true },
};
let activities = [],
  invitations = [];
const createKeys = new Map();
let updateConflict = true;
const requests = [],
  pageErrors = [];
const plan = () => ({
  trip_id: tripId,
  plan_version: trip.plan_version,
  export_revision: trip.export_revision,
  activities,
  selected_locations: [],
  dress_codes: [
    {
      id: "dress",
      label: "Một ngày bên biển",
      description: "Tông trắng và xanh",
      scope_type: "TRIP",
      plan_date: null,
      activity_id: null,
    },
  ],
  packing_items: [
    {
      id: "packing",
      name: "Sạc dự phòng",
      quantity: "1",
      unit: "chiếc",
      category: "Điện tử",
      assigned_member_id: memberId,
      status: "COMPLETED",
    },
  ],
  permissions: { can_read: true, can_edit: true, can_complete: true },
});
await context.route("**/api/v1/**", async (route) => {
  const request = route.request(),
    url = new URL(request.url()),
    pathname = url.pathname.replace("/api/v1", "");
  const method = request.method(),
    body = request.postData() ? request.postDataJSON() : undefined,
    headers = request.headers();
  requests.push({ pathname, search: url.search, method, body, headers });
  const cors = {
    "Access-Control-Allow-Origin": appUrl,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Client-Type, X-CSRF-Token, Idempotency-Key",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  };
  const respond = (status, data) =>
    route.fulfill({
      status,
      headers: cors,
      contentType: "application/json",
      body: JSON.stringify({ data, meta: {} }),
    });
  const fail = (status, code) =>
    route.fulfill({
      status,
      headers: cors,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code, message: "Fixture", retryable: status === 503 },
        meta: {},
      }),
    });
  if (method === "OPTIONS")
    return route.fulfill({ status: 204, headers: cors });
  if (pathname === "/auth/csrf") return fail(401, "UNAUTHENTICATED");
  if (pathname === "/auth/login")
    return respond(200, {
      access_token: "fixture-access",
      expires_in: 900,
      token_type: "Bearer",
      profile,
    });
  if (pathname === "/trips" && method === "GET")
    return respond(200, {
      items:
        !url.searchParams.has("lifecycle") ||
        url.searchParams.get("lifecycle") === trip.lifecycle
          ? [trip]
          : [],
      next_cursor: null,
    });
  if (pathname === "/trips" && method === "POST") {
    assert.equal(body.client_request_id, headers["idempotency-key"]);
    assert.deepEqual(Object.keys(body).sort(), [
      "client_request_id",
      "description",
      "end_at",
      "name",
      "start_at",
      "timezone",
    ]);
    trip = { ...trip, ...body };
    return respond(201, trip);
  }
  if (pathname === `/trips/${tripId}` && method === "GET")
    return respond(200, trip);
  if (pathname === `/trips/${tripId}` && method === "PATCH") {
    assert.equal(body.expected_plan_version, trip.plan_version);
    trip = {
      ...trip,
      name: body.name,
      description: body.description,
      public_description: body.public_description,
      plan_version: trip.plan_version + 1,
      export_revision: trip.export_revision + 1,
    };
    return respond(200, trip);
  }
  if (pathname.endsWith("/plan") && method === "GET")
    return respond(200, plan());
  if (pathname.endsWith("/members"))
    return respond(200, { items: [membership], next_cursor: null });
  if (pathname.endsWith("/invitations") && method === "GET")
    return respond(200, { items: invitations, next_cursor: null });
  if (pathname.endsWith("/invitations") && method === "POST") {
    const invitation = {
      id: "40000000-0000-4000-8000-000000000001",
      trip_id: tripId,
      email: body.email,
      invitation_type: "EMAIL",
      status: "PENDING",
      version: 1,
      expires_at: "2026-11-01T00:00:00Z",
      resolved_at: null,
    };
    invitations.push(invitation);
    return respond(201, { invitation });
  }
  if (pathname.endsWith("/plan-policy")) {
    assert.equal(body.expected_membership_revision, trip.membership_revision);
    assert.deepEqual(body.editor_member_ids, []);
    trip = {
      ...trip,
      plan_edit_policy: body.policy,
      membership_revision: trip.membership_revision + 1,
    };
    return respond(200, {
      policy: body.policy,
      editor_member_ids: [],
      membership_revision: trip.membership_revision,
    });
  }
  if (pathname.endsWith("/activities") && method === "POST") {
    const key = headers["idempotency-key"];
    if (createKeys.has(key)) return respond(201, createKeys.get(key));
    const activity = {
      ...body,
      id: `50000000-0000-4000-8000-${String(activities.length + 1).padStart(12, "0")}`,
      trip_id: tripId,
      status: "TODO",
      source: "MANUAL",
      plan_version: trip.plan_version + 1,
    };
    activities.push(activity);
    trip.plan_version++;
    trip.export_revision++;
    createKeys.set(key, activity);
    // Simulate a committed write whose first response was lost.
    return fail(503, "SERVICE_UNAVAILABLE");
  }
  if (/\/activities\/.+\/completion$/.test(pathname)) {
    assert.equal(body.expected_plan_version, trip.plan_version);
    activities = activities.map((a) => ({ ...a, status: body.status }));
    trip.plan_version++;
    trip.export_revision++;
    return respond(200, activities[0]);
  }
  if (/\/activities\/.+$/.test(pathname) && method === "PATCH") {
    if (updateConflict) {
      updateConflict = false;
      trip.plan_version++;
      trip.export_revision++;
      return fail(409, "VERSION_CONFLICT");
    }
    assert.equal(body.expected_plan_version, trip.plan_version);
    activities = activities.map((a) => ({ ...a, ...body }));
    trip.plan_version++;
    trip.export_revision++;
    return respond(200, activities[0]);
  }
  if (/\/activities\/.+$/.test(pathname) && method === "DELETE") {
    assert.equal(body.confirmed, true);
    activities = [];
    trip.plan_version++;
    trip.export_revision++;
    return respond(200, { plan_version: trip.plan_version });
  }
  if (pathname === "/travel/places" && method === "GET") {
    assert.equal(url.searchParams.get("trip_id"), tripId);
    assert.equal(url.searchParams.get("q"), "Mỹ Khê Đà Nẵng");
    return route.fulfill({
      status: 200,
      headers: cors,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "provider:beach",
            name: "Bãi biển Mỹ Khê",
            address: "Đà Nẵng",
            coordinates: { latitude: 16.05, longitude: 108.24 },
            opening_hours: [],
          },
        ],
        meta: {
          provider: "local-fixture",
          fetched_at: "2026-10-15T00:00:00Z",
          status: "SUCCESS",
          is_mock: true,
          stale: false,
          warnings: [],
          attribution: [],
        },
      }),
    });
  }
  if (pathname === "/me" && method === "GET") return respond(200, profile);
  if (pathname === "/me" && method === "PATCH") {
    assert.equal(body.expected_version, profile.version);
    profile = {
      ...profile,
      full_name: body.full_name,
      version: profile.version + 1,
    };
    return respond(200, profile);
  }
  if (pathname === "/me/sessions")
    return respond(200, { items: [], next_cursor: null });
  return fail(404, "RESOURCE_NOT_FOUND");
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);
page.setDefaultNavigationTimeout(90_000);
page.on("pageerror", (error) => pageErrors.push(error.message));
const button = (name) => page.getByRole("button", { name, exact: true });
const click = async (name) => {
  await button(name).click();
};
async function screenshot(name) {
  await page.waitForFunction(() =>
    Array.from(document.images).every(
      (image) => image.complete && image.naturalWidth > 0,
    ),
  );
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
  const images = await page.locator("img").evaluateAll((nodes) =>
    nodes
      .map((n) => ({
        src: n.src,
        width: n.getBoundingClientRect().width,
        height: n.getBoundingClientRect().height,
      }))
      .filter((image) => image.width > 0 && image.height > 0),
  );
  assert.ok(
    images.length > 0 &&
      images.every((image) => !image.src.includes("figma.com")),
  );
  await page.screenshot({ path: path.join(output, name) });
}
try {
  const sessionReady = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/v1/auth/csrf",
  );
  await page.goto(`${appUrl}/sign-in?preview=1`, { waitUntil: "networkidle" });
  await sessionReady;
  await page.getByLabel("Email", { exact: true }).fill(profile.email);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("a long test password");
  await click("Đăng nhập");
  await page.getByRole("heading", { name: "Đi đâu tiếp nhỉ?" }).waitFor();
  await screenshot("m04-home.png");
  await page.getByRole("tab", { name: "Chuyến đi", exact: true }).click();
  await button(`Mở chuyến đi ${trip.name}`).waitFor();
  await screenshot("m05-trips.png");
  await click("+ Tạo một hành trình mới");
  await page.getByLabel("Tên chuyến đi", { exact: true }).fill("Đà Nẵng 3N2Đ");
  await page.getByLabel("Ngày đi", { exact: true }).fill("31/02/2026");
  await page.getByLabel("Ngày về", { exact: true }).fill("14/11/2026");
  await click("Tiếp tục");
  await page
    .getByText("Nhập ngày hợp lệ theo định dạng DD/MM/YYYY.", { exact: true })
    .waitFor();
  assert.equal(
    requests.filter((r) => r.pathname === "/trips" && r.method === "POST")
      .length,
    0,
  );
  await page.getByLabel("Ngày đi", { exact: true }).fill("12/11/2026");
  await screenshot("m06-create-info.png");
  await click("Tiếp tục");
  await page
    .getByLabel("Lời nhắn cho nhóm", { exact: true })
    .fill("Cùng nhau khám phá Đà Nẵng");
  await screenshot("m07-create-details.png");
  await click("Tạo chuyến đi");
  await page.getByRole("tab", { name: "Tổng quan", exact: true }).waitFor();
  await screenshot("m08-overview.png");
  assert.equal(
    requests.find((r) => r.pathname === "/trips" && r.method === "POST").body
      .start_at,
    "2026-11-11T17:00:00.000Z",
  );
  await page.getByRole("tab", { name: "Lịch trình", exact: true }).click();
  await click("Thêm hoạt động");
  await page
    .getByLabel("Địa điểm / hoạt động", { exact: true })
    .fill("Bãi biển Mỹ Khê");
  await screenshot("m29-add-activity.png");
  await click("Thêm vào lịch trình");
  await page
    .getByText("Dịch vụ đang tạm gián đoạn. Bạn có thể thử lại sau.", {
      exact: true,
    })
    .waitFor();
  await click("Thêm vào lịch trình");
  await button("Bãi biển Mỹ Khê, 08:00").waitFor();
  const creates = requests.filter(
    (r) => r.pathname.endsWith("/activities") && r.method === "POST",
  );
  assert.equal(creates.length, 2);
  assert.equal(
    creates[0].headers["idempotency-key"],
    creates[1].headers["idempotency-key"],
  );
  assert.equal(activities.length, 1);
  await button("Bãi biển Mỹ Khê, 08:00").waitFor();
  await screenshot("m09-itinerary.png");
  await click("Bãi biển Mỹ Khê, 08:00");
  await click("Đánh dấu hoàn thành");
  await button("Bãi biển Mỹ Khê, 08:00, đã hoàn thành").waitFor();
  await click("Bãi biển Mỹ Khê, 08:00, đã hoàn thành");
  await click("Chỉnh sửa hoạt động");
  await page
    .getByLabel("Địa điểm / hoạt động", { exact: true })
    .fill("Mỹ Khê lúc bình minh");
  await click("Lưu thay đổi");
  await page
    .getByText(
      "Kế hoạch vừa được cập nhật. Tải lại dữ liệu rồi thử lại để giữ thay đổi của cả nhóm.",
      { exact: true },
    )
    .waitFor();
  await click("Tải kế hoạch mới nhất");
  await page
    .waitForResponse(
      (response) =>
        response.url().endsWith("/plan") && response.status() === 200,
    )
    .catch(() => {});
  assert.equal(
    await page.getByLabel("Địa điểm / hoạt động", { exact: true }).inputValue(),
    "Mỹ Khê lúc bình minh",
  );
  await click("Lưu thay đổi");
  await button("Mỹ Khê lúc bình minh, 08:00, đã hoàn thành").waitFor();
  await page.getByRole("tab", { name: "Bản đồ", exact: true }).click();
  await page
    .getByLabel("Khám phá địa điểm", { exact: true })
    .fill("Mỹ Khê Đà Nẵng");
  await click("Tìm địa điểm");
  await page
    .getByText("Kết quả từ nguồn dữ liệu mô phỏng của môi trường thử nghiệm.", {
      exact: true,
    })
    .waitFor();
  await screenshot("m10-places.png");
  await page.getByRole("tab", { name: "Tiện ích", exact: true }).click();
  await click("Thành viên");
  await page.getByText("Minh Anh · Bạn", { exact: true }).waitFor();
  await screenshot("m16-members.png");
  await click("Mời thành viên");
  await page
    .getByLabel("Email người được mời", { exact: true })
    .fill("friend@example.test");
  await screenshot("m17-invite.png");
  await click("Gửi lời mời");
  await page.getByText(/Lời mời cho friend@example.test đã được tạo/).waitFor();
  await click("Xem bạn đồng hành");
  await page.getByText("friend@example.test", { exact: true }).waitFor();
  await click("Quyền của nhóm");
  await page.getByRole("tab", { name: "Cả nhóm", exact: true }).click();
  await click("Lưu quyền của nhóm");
  await page
    .getByText("Đã cập nhật quyền chỉnh sửa của nhóm.", { exact: true })
    .waitFor();
  await screenshot("m20-settings.png");
  await click("Chỉnh sửa thông tin");
  await page
    .getByLabel("Mô tả cho nhóm", { exact: true })
    .fill("Kỷ niệm cùng bạn bè");
  await click("Lưu thay đổi");
  await button("Chỉnh sửa thông tin").waitFor();
  assert.equal(trip.description, "Kỷ niệm cùng bạn bè");
  await click("Quay lại");
  await page.getByRole("tab", { name: "Chuyến đi", exact: true }).click();
  await button(`Mở chuyến đi ${trip.name}`).waitFor();
  await click(`Mở chuyến đi ${trip.name}`);
  await page.getByRole("tab", { name: "Tiện ích", exact: true }).click();
  await click("Hành lý");
  await screenshot("m13-packing.png");
  await click("Danh sách đã sẵn sàng!");
  await page.getByText("Sẵn sàng lên đường!", { exact: true }).waitFor();
  await screenshot("p15-packing-complete.png");
  await click("Tuyệt, đi thôi!");
  await page.getByRole("tab", { name: "Tài khoản", exact: true }).click();
  await click("Chỉnh sửa hồ sơ");
  await page.getByLabel("Họ và tên", { exact: true }).fill("Minh Anh Nguyễn");
  await screenshot("m32-edit-profile.png");
  await click("Lưu thay đổi");
  await button("Chỉnh sửa hồ sơ").waitFor();
  assert.equal(profile.full_name, "Minh Anh Nguyễn");
  await screenshot("m22-profile.png");
  await page.setViewportSize({ width: 360, height: 740 });
  await screenshot("m22-small-phone.png");
  assert.deepEqual(pageErrors, []);
  console.log(
    "Trip UI passed: contract fixtures, create/date validation, lost-response retry, activity completion, conflict/reload/edit, places metadata, invitation, policy, trip/profile updates, packing, P15 and 360px layout.",
  );
  console.log(`Screenshots: ${output}`);
} catch (error) {
  await page.screenshot({ path: path.join(output, "trip-failure.png") });
  console.error(
    "Page:",
    page.url(),
    "Errors:",
    pageErrors,
    "Recent requests:",
    requests.slice(-8).map(({ method, pathname }) => ({ method, pathname })),
  );
  console.error((await page.locator("body").innerText()).slice(-1500));
  throw error;
} finally {
  await browser.close();
}
