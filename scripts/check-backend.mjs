import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { ApiError, createApiClient } from "../src/shared/api/api-client.ts";
import { createAuthSession } from "../src/features/auth/session/auth-session.ts";
import { createTripsApi } from "../src/features/trips/api/trips.api.ts";
import { collectPages } from "../src/features/trips/api/pagination.ts";
import {
  dateKey,
  invitationToken,
  localTimestamp,
} from "../src/features/trips/utils.ts";

// Run on the computer: 10.0.2.2 is an Android emulator address, not the PC Gateway.
const baseUrl =
  process.env.WOLFARI_TEST_API_URL ?? "http://127.0.0.1:3000/api/v1";
const withAuth = process.argv.includes("--auth");
const withTrips = process.argv.includes("--trips");
const seedDemo = process.argv.includes("--seed-demo");
const pass = (message) => console.log(`PASS ${message}`);

async function main() {
  assert.ok(!withTrips || withAuth, "Use --auth with --trips.");
  assert.ok(!seedDemo || withTrips, "Use --auth --trips with --seed-demo.");
  const url = new URL(baseUrl);
  assert.ok(
    ["http:", "https:"].includes(url.protocol),
    "Use an HTTP(S) Gateway URL.",
  );
  assert.ok(
    !url.username && !url.password && !url.search && !url.hash,
    "Use a URL without credentials or query parameters.",
  );
  assert.equal(
    url.pathname.replace(/\/+$/, ""),
    "/api/v1",
    "Gateway URL must end with /api/v1.",
  );
  if (withAuth) {
    assert.ok(
      process.env.WOLFARI_TEST_EMAIL && process.env.WOLFARI_TEST_PASSWORD,
      "Set WOLFARI_TEST_EMAIL and WOLFARI_TEST_PASSWORD in .env.backend-test.local before using --auth.",
    );
  }

  console.log(`Gateway: ${url.origin}/api/v1`);
  const response = await fetch(new URL("/health/ready", url), {
    signal: AbortSignal.timeout(10_000),
  });
  const health = await response.json();
  assert.equal(
    response.status,
    200,
    `Gateway readiness returned HTTP ${response.status}; check Identity, Trip and migrations.`,
  );
  assert.equal(health.service, "api-gateway");
  assert.equal(health.status, "ok");
  pass("Gateway, Identity and Trip readiness");

  const client = createApiClient({
    getBaseUrl: () => baseUrl,
    clientType: "mobile",
    timeoutMs: 10_000,
  });
  await assert.rejects(
    client.request("/me"),
    (error) =>
      error instanceof ApiError &&
      error.status === 401 &&
      error.code === "UNAUTHENTICATED",
  );
  pass("Unauthenticated /me returns the expected 401 envelope");

  if (!withAuth) {
    console.log(
      "Auth not tested. Run npm run test:backend -- --auth with a test account to check login, profile and refresh.",
    );
    return;
  }

  let savedRefreshToken = null;
  const storage = {
    get: async () => savedRefreshToken,
    set: async (value) => {
      savedRefreshToken = value;
    },
    clear: async () => {
      savedRefreshToken = null;
    },
  };
  const dependencies = {
    storage,
    login: (input) =>
      client.request("/auth/login", { method: "POST", body: input }),
    refresh: (refreshToken) =>
      client.request("/auth/refresh", {
        method: "POST",
        body: { refresh_token: refreshToken },
      }),
  };
  const session = createAuthSession(dependencies);
  const email = process.env.WOLFARI_TEST_EMAIL.trim().toLowerCase();
  await session.signIn({ email, password: process.env.WOLFARI_TEST_PASSWORD });
  assert.equal(session.getSnapshot().status, "authenticated");
  pass("Mobile login accepted by the app session manager");

  const profile = await client.request("/me", {
    accessToken: await session.getAccessToken(),
  });
  assert.equal(profile.email, email);
  assert.equal(profile.id, session.getSnapshot().profile.id);
  pass("Authenticated profile from the real backend");

  const previousRefreshToken = savedRefreshToken;
  const restored = createAuthSession(dependencies);
  await restored.restore();
  assert.equal(
    restored.getSnapshot().status,
    "authenticated",
    "Saved session could not be restored.",
  );
  assert.ok(
    savedRefreshToken && savedRefreshToken !== previousRefreshToken,
    "Refresh token did not rotate.",
  );
  const refreshedProfile = await client.request("/me", {
    accessToken: await restored.getAccessToken(),
  });
  assert.equal(refreshedProfile.id, profile.id);
  pass("Session restore, refresh rotation and refreshed access token");

  if (withTrips) {
    const authenticated = {
      request: async (path, options) =>
        client.request(path, {
          ...options,
          accessToken: await restored.getAccessToken(),
        }),
      requestWithMeta: async (path, options) =>
        client.requestWithMeta(path, {
          ...options,
          accessToken: await restored.getAccessToken(),
        }),
    };
    await checkTrips(authenticated);
  }

  await restored.clearLocalSession();
  assert.equal(savedRefreshToken, null);
  assert.equal(restored.getSnapshot().status, "guest");
  pass("Local sign-out (does not revoke the server session)");
  console.log(
    "Native HTTP/session checks passed. Verify SecureStore, Expo Go Wi-Fi networking and rendering on the phone separately.",
  );
}

async function checkTrips(client) {
  const api = createTripsApi(client);
  const trips = await collectPages((cursor) => api.list(undefined, cursor));
  pass(`Trip list and cursor pagination (${trips.length} trips)`);
  let demo = trips.find((trip) => trip.name === "Đà Nẵng · Expo Go");
  if (seedDemo && !demo) {
    // Persist the operation before the write so a rerun after a lost response
    // recovers the same Trip instead of creating another one.
    await mkdir(".cache", { recursive: true });
    const stateFile = ".cache/backend-demo.json";
    const saved = await readFile(stateFile, "utf8").then(
      JSON.parse,
      (error) => {
        if (error.code !== "ENOENT") throw error;
        return { createKey: randomUUID() };
      },
    );
    await writeFile(stateFile, JSON.stringify(saved, null, 2));
    const start = dateKey(
      new Date(Date.now() + 7 * 86_400_000).toISOString(),
      "Asia/Ho_Chi_Minh",
    );
    const end = dateKey(
      new Date(Date.now() + 9 * 86_400_000).toISOString(),
      "Asia/Ho_Chi_Minh",
    );
    demo = await api.create(
      {
        name: "Đà Nẵng · Expo Go",
        description:
          "Chuyến đi mẫu để kiểm tra mobile với backend local. Cùng lên lịch cho một ngày bên biển!",
        start_at: localTimestamp(start, "00:00", "Asia/Ho_Chi_Minh"),
        end_at: localTimestamp(end, "23:59", "Asia/Ho_Chi_Minh"),
        timezone: "Asia/Ho_Chi_Minh",
      },
      saved.createKey,
    );
    await writeFile(
      stateFile,
      JSON.stringify({ ...saved, tripId: demo.id }, null, 2),
    );
    pass("Created a clearly labelled Expo Go demo Trip");
  }
  if (seedDemo && demo) {
    await mkdir(".cache", { recursive: true });
    await writeFile(
      ".cache/backend-demo.json",
      JSON.stringify({ tripId: demo.id }, null, 2),
    );
  }
  const target = demo ?? trips[0];
  if (!target) {
    console.log(
      "No Trip exists yet. Use --seed-demo to create the local Expo Go demo.",
    );
    return;
  }
  const trip = await api.get(target.id);
  let plan = await api.plan(trip.id);
  const members = await collectPages((cursor) => api.members(trip.id, cursor));
  assert.ok(members.some((member) => member.id === trip.current_membership.id));
  assert.ok(
    Array.isArray(plan.activities) &&
      Array.isArray(plan.packing_items) &&
      Array.isArray(plan.dress_codes),
  );
  pass("Trip detail, Plan, permissions and members from the real Gateway");
  if (trip.current_membership.role === "OWNER") {
    await collectPages((cursor) => api.invitations(trip.id, cursor));
    pass("Owner invitation list");
  }
  const search = await api.searchPlaces(trip.id, "Mỹ Khê Đà Nẵng");
  assert.ok(["SUCCESS", "NO_RESULT", "ERROR"].includes(search.meta.status));
  assert.ok(
    Array.isArray(search.data) && Array.isArray(search.meta.attribution),
  );
  pass(
    `Travel search contract (${search.meta.status}; ${search.meta.is_mock ? "mock provider" : "real provider configuration"})`,
  );

  if (!seedDemo) return;
  assert.equal(trip.name, "Đà Nẵng · Expo Go");
  assert.equal(trip.current_membership.role, "OWNER");
  if (
    !plan.activities.some((activity) => activity.title === "Dạo biển Mỹ Khê")
  ) {
    await api.saveActivity(
      trip.id,
      undefined,
      {
        title: "Dạo biển Mỹ Khê",
        description: "Đón bình minh, đi bộ bên bờ biển và ăn sáng cùng nhóm.",
        activity_type: "SIGHTSEEING",
        starts_at: localTimestamp(
          dateKey(trip.start_at, trip.timezone),
          "08:00",
          trip.timezone,
        ),
        ends_at: localTimestamp(
          dateKey(trip.start_at, trip.timezone),
          "09:00",
          trip.timezone,
        ),
        position: plan.activities.length,
        expected_plan_version: plan.plan_version,
      },
      randomUUID(),
    );
    plan = await api.plan(trip.id);
  }
  let temporary;
  try {
    const key = randomUUID();
    const input = {
      title: "Kiểm tra kết nối API",
      activity_type: "OTHER",
      position: plan.activities.length,
      expected_plan_version: plan.plan_version,
    };
    temporary = await api.saveActivity(trip.id, undefined, input, key);
    const replay = await api.saveActivity(trip.id, undefined, input, key);
    assert.equal(replay.id, temporary.id);
    plan = await api.plan(trip.id);
    await assert.rejects(
      api.saveActivity(
        trip.id,
        temporary.id,
        { ...input, title: "Xung đột dữ liệu" },
        randomUUID(),
      ),
      (error) => error instanceof ApiError && error.status === 409,
    );
    temporary = await api.saveActivity(
      trip.id,
      temporary.id,
      {
        ...input,
        title: "Đã kiểm tra API",
        expected_plan_version: plan.plan_version,
      },
      randomUUID(),
    );
    plan = await api.plan(trip.id);
    const completed = await api.complete(
      trip.id,
      temporary,
      plan.plan_version,
      randomUUID(),
    );
    assert.equal(completed.status, "COMPLETED");
    pass(
      "Activity create, idempotent replay, revision conflict, edit and completion",
    );
  } finally {
    if (temporary) {
      plan = await api.plan(trip.id);
      await api.removeActivity(
        trip.id,
        temporary.id,
        plan.plan_version,
        randomUUID(),
      );
      pass("Removed the temporary API-check activity; demo itinerary retained");
    }
  }
  const latest = await api.get(trip.id);
  const result = await client.request(`/trips/${trip.id}/invitations`, {
    method: "POST",
    body: {
      invitation_type: "LINK",
      expected_membership_revision: latest.membership_revision,
    },
    headers: { "Idempotency-Key": randomUUID() },
  });
  try {
    const token = invitationToken(result.one_time_link);
    assert.ok(token, "Gateway must return a one-time invitation link.");
    const preview = await api.previewInvitation(token);
    assert.equal(preview.trip_name, trip.name);
    pass("Link invitation creation and preview (no email sent)");
  } finally {
    await api.manageInvitation(
      trip.id,
      result.invitation,
      "revoke",
      randomUUID(),
    );
    pass("Temporary invitation revoked");
  }
  console.log(`Demo screen: /trip/${trip.id}`);
}

main().catch((error) => {
  // Do not dump request bodies, credentials, tokens or backend response payloads.
  if (error instanceof ApiError) {
    console.error(
      `FAIL API ${error.code} (HTTP ${error.status})${error.correlationId ? `; correlation_id=${error.correlationId}` : ""}`,
    );
  } else if (error instanceof assert.AssertionError) {
    console.error(`FAIL ${error.message.split("\n")[0]}`);
  } else {
    console.error(
      `FAIL Cannot check the Gateway (${error.cause?.code ?? error.name}). Check the backend URL and running services.`,
    );
  }
  process.exitCode = 1;
});
