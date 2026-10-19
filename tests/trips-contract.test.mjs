import assert from "node:assert/strict";
import test from "node:test";

import { createApiClient } from "../src/shared/api/api-client.ts";
import { createTripsApi } from "../src/features/trips/api/trips.api.ts";
import { collectPages } from "../src/features/trips/api/pagination.ts";
import {
  dateKey,
  invitationToken,
  localTimestamp,
  parseDate,
  tripDays,
} from "../src/features/trips/utils.ts";
import { resolveApiUrl } from "../src/shared/config/api-url.ts";

test("Expo Go resolves the Metro LAN host, while tunnel and production require a real API URL", () => {
  assert.equal(
    resolveApiUrl({
      development: true,
      configured: "",
      hostUri: "192.168.1.40:8082",
    }),
    "http://192.168.1.40:3001/api/v1",
  );
  assert.equal(
    resolveApiUrl({ development: true, hostUri: "exp://172.20.10.2:8081" }),
    "http://172.20.10.2:3001/api/v1",
  );
  assert.equal(
    resolveApiUrl({ development: true, webHost: "localhost" }),
    "http://localhost:3001/api/v1",
  );
  assert.throws(
    () =>
      resolveApiUrl({ development: true, hostUri: "example.exp.direct:80" }),
    /tunnel/,
  );
  assert.throws(() => resolveApiUrl({ development: false }), /required/);
  assert.throws(
    () =>
      resolveApiUrl({
        development: false,
        configured: "http://example.test/api/v1",
      }),
    /HTTPS/,
  );
  for (const configured of [
    "https://a:b@example.test/api/v1",
    "https://example.test/api/v1?token=x",
    "https://example.test/wrong",
  ])
    assert.throws(() => resolveApiUrl({ development: false, configured }));
});

test("calendar validation and activity scheduling use the trip timezone, including overnight and DST", () => {
  assert.equal(parseDate("29/02/2028"), "2028-02-29");
  assert.equal(parseDate("29/02/2027"), undefined);
  assert.equal(parseDate("31/04/2026"), undefined);
  assert.equal(
    localTimestamp("2026-11-12", "08:30", "Asia/Ho_Chi_Minh"),
    "2026-11-12T01:30:00.000Z",
  );
  assert.equal(
    localTimestamp("2026-07-12", "08:30", "America/New_York"),
    "2026-07-12T12:30:00.000Z",
  );
  assert.equal(
    localTimestamp("2026-03-08", "02:30", "America/New_York"),
    undefined,
  );
  assert.equal(
    localTimestamp("2026-11-12", "25:00", "Asia/Ho_Chi_Minh"),
    undefined,
  );
  assert.equal(
    dateKey("2026-11-11T18:00:00Z", "Asia/Ho_Chi_Minh"),
    "2026-11-12",
  );
  assert.deepEqual(
    tripDays({
      start_at: "2026-11-11T17:00:00Z",
      end_at: "2026-11-13T16:59:00Z",
      timezone: "Asia/Ho_Chi_Minh",
    }),
    ["2026-11-12", "2026-11-13"],
  );
});

test("trip writes preserve the same operation ID across retry and send exact backend revisions", async () => {
  const requests = [];
  let failed = false;
  const client = createApiClient({
    getBaseUrl: () => "https://gateway.test/api/v1",
    fetch: async (url, options) => {
      requests.push({ url, ...options, body: JSON.parse(options.body) });
      if (!failed) {
        failed = true;
        throw new TypeError("Lost response");
      }
      return Response.json({ data: { id: "trip-id" }, meta: {} });
    },
  });
  const api = createTripsApi(client),
    key = "4de6623c-6700-42e4-87c8-65d1433d11a7";
  const input = {
    name: "Đà Nẵng",
    start_at: "2026-11-12T00:00:00+07:00",
    end_at: "2026-11-14T23:59:00+07:00",
    timezone: "Asia/Ho_Chi_Minh",
  };
  await assert.rejects(api.create(input, key));
  await api.create(input, key);
  assert.deepEqual(requests[0].body, requests[1].body);
  assert.equal(requests[1].body.client_request_id, key);
  assert.equal(requests[1].headers["Idempotency-Key"], key);
  await api.update(
    { id: "t", plan_version: 8, export_revision: 11 },
    { name: "Updated", description: null, public_description: null },
    key,
  );
  assert.deepEqual(requests.at(-1).body, {
    name: "Updated",
    description: null,
    public_description: null,
    expected_plan_version: 8,
    expected_export_revision: 11,
  });
  await api.complete("t", { id: "a", status: "TODO" }, 9, key);
  assert.match(requests.at(-1).url, /\/activities\/a\/completion$/);
  assert.deepEqual(requests.at(-1).body, {
    expected_plan_version: 9,
    status: "COMPLETED",
  });
  await api.policy({ id: "t", membership_revision: 4 }, "ALL_MEMBERS", [], key);
  assert.deepEqual(requests.at(-1).body, {
    policy: "ALL_MEMBERS",
    editor_member_ids: [],
    expected_membership_revision: 4,
  });
});

test("travel metadata keeps provider attribution and mock/stale flags alongside results", async () => {
  const meta = {
    provider: "fixture",
    stale: true,
    is_mock: true,
    attribution: [{ text: "Source", url: "https://source.test" }],
  };
  const client = createApiClient({
    getBaseUrl: () => "https://gateway.test/api/v1",
    fetch: async (input, options) => {
      const url = new URL(input);
      assert.equal(options.method, "GET");
      assert.equal(url.pathname, "/api/v1/travel/places");
      assert.equal(url.searchParams.get("trip_id"), "trip-id");
      assert.equal(url.searchParams.get("q"), "beach");
      assert.equal(options.body, undefined);
      return Response.json({ data: [{ id: "p", name: "A" }], meta });
    },
  });
  const result = await createTripsApi(client).searchPlaces("trip-id", "beach");
  assert.equal(result.data[0].id, "p");
  assert.deepEqual(result.meta, meta);
});

test("member/invitation lists collect all cursor pages and reject a cursor loop", async () => {
  const seen = [];
  assert.deepEqual(
    await collectPages(async (cursor) => {
      seen.push(cursor);
      return cursor
        ? { items: [2], next_cursor: null }
        : { items: [1], next_cursor: "next" };
    }),
    [1, 2],
  );
  assert.deepEqual(seen, [undefined, "next"]);
  await assert.rejects(
    collectPages(async () => ({ items: [], next_cursor: "same" })),
    /tải hết/,
  );
});

test("invitation input accepts the backend token and fragment link without unrelated IDs", () => {
  const token = `inv1_${"x".repeat(43)}`;
  assert.equal(invitationToken(token), token);
  assert.equal(
    invitationToken(`http://localhost:3000/invitations/local#token=${token}`),
    token,
  );
  assert.equal(invitationToken("not-an-invitation"), undefined);
});
