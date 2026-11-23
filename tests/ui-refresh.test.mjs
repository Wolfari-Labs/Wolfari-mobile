import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { activityMinutes, nextSlot, pathKm, planDay, shortestOrder, travelMinutes } from "../src/features/trips/model/auto-schedule.ts";
import { reminderPresets } from "../src/features/trips/model/reminders.ts";
import { dressPalette } from "../src/features/trips/model/dress-suggestions.ts";
import { prettyAttribution } from "../src/features/trips/model/place.ts";
import { relativeTime, timeLeft } from "../src/shared/relative-time.ts";
import { freshnessLabel, priceKind, priceKindLabel } from "../src/features/price-watch/labels.ts";
import { ApiError, createApiClient } from "../src/shared/api/api-client.ts";
import { errorMessage } from "../src/shared/api/errors.ts";

const tz = "Asia/Ho_Chi_Minh";
const local = (iso) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const places = { cho: { latitude: 16.0678, longitude: 108.214 }, cau: { latitude: 16.061, longitude: 108.227 }, chua: { latitude: 16.1003, longitude: 108.2778 } };
const placeOf = (id) => (id ? places[id] : undefined);
const act = (id, type, loc, starts = null, ends = null) => ({ id, activity_type: type, selected_location_id: loc, starts_at: starts, ends_at: ends });

test("a day is laid out from the first fixed time with travel, type lengths and a lunch break", () => {
  const plan = planDay({
    day: "2026-12-01", timezone: tz, placeOf,
    activities: [
      act("breakfast", "MEAL", "cho", "2026-12-01T01:00:00Z", "2026-12-01T02:00:00Z"),
      act("pagoda", "SIGHTSEEING", "chua"),
      act("bridge", "SIGHTSEEING", "cau"),
      act("shop", "OTHER", null),
    ],
  });
  assert.deepEqual(plan.slots.map((slot) => `${slot.id} ${local(slot.starts_at)}-${local(slot.ends_at)}`), [
    "breakfast 08:00-09:00", "pagoda 09:30-11:00", "bridge 12:30-14:00", "shop 14:15-15:15",
  ]);
  assert.deepEqual(plan.lunch, { starts: "11:30", ends: "12:30" });
  assert.deepEqual(plan.overflow, []);
  // Breakfast does not count as lunch; a midday meal does.
  const withLunch = planDay({ day: "2026-12-01", timezone: tz, placeOf, activities: [act("a", "SIGHTSEEING", null), act("b", "SIGHTSEEING", null), act("lunch", "MEAL", null), act("c", "SIGHTSEEING", null)] });
  assert.equal(withLunch.lunch, undefined);
});

test("activities that would run past 22:00 stay untimed instead of spilling into the night", () => {
  const plan = planDay({ day: "2026-12-01", timezone: tz, placeOf, start: 19 * 60, activities: [act("a", "SIGHTSEEING", null), act("b", "BEACH", null), act("c", "OTHER", null)] });
  assert.deepEqual(plan.slots.map((slot) => slot.id), ["a"]);
  assert.deepEqual(plan.overflow, ["b", "c"]);
});

test("durations and travel time are bounded and sensible", () => {
  assert.equal(activityMinutes(act("x", "BEACH", null)), 120);
  assert.equal(activityMinutes(act("x", "UNKNOWN", null)), 60);
  assert.equal(activityMinutes({ activity_type: "MEAL", starts_at: "2026-12-01T01:00:00Z", ends_at: "2026-12-01T01:05:00Z" }), 60, "a 5-minute slot is not a real length");
  assert.equal(travelMinutes(undefined, places.cau), 15);
  assert.equal(travelMinutes(places.cau, places.cau), 10);
  assert.ok(travelMinutes(places.cho, places.chua) >= 20 && travelMinutes(places.cho, places.chua) % 5 === 0);
});

test("the shortest route keeps the first stop and items without a place keep their slots", () => {
  const items = [act("1", "MEAL", "cho"), act("2", "SIGHTSEEING", "chua"), act("3", "SIGHTSEEING", "cau"), act("4", "OTHER", null), act("5", "SIGHTSEEING", "cau")];
  const next = shortestOrder(items, placeOf);
  assert.deepEqual(next.map((item) => item.id), ["1", "3", "5", "4", "2"]);
  assert.ok(pathKm(next, placeOf) < pathKm(items, placeOf));
});

test("a place added from the map lands after the day's last timed activity, or not at all when late", () => {
  const morning = [act("a", "MEAL", "cho", "2026-12-01T01:00:00Z", "2026-12-01T02:00:00Z")];
  const slot = nextSlot({ day: "2026-12-01", timezone: tz, activities: morning, placeOf, place: places.cau, minutes: 90 });
  assert.equal(slot.label, "09:15–10:45");
  assert.equal(nextSlot({ day: "2026-12-02", timezone: tz, activities: morning, placeOf, minutes: 60 }).label, "09:00–10:00");
  const late = [act("b", "OTHER", null, "2026-12-01T13:00:00Z", "2026-12-01T14:30:00Z")];
  assert.equal(nextSlot({ day: "2026-12-01", timezone: tz, activities: late, placeOf, minutes: 60 }), undefined);
});

test("reminder presets are future times strictly before the source, without duplicates", () => {
  const source = { id: "s", type: "ACTIVITY", label: "Ăn sáng", at: "2026-12-01T01:00:00Z" };
  const presets = reminderPresets(source, tz, Date.parse("2026-11-20T00:00:00Z"));
  assert.deepEqual(presets.map((item) => [item.key, item.time, item.date]), [
    ["15m", "07:45", "01/12/2026"], ["1h", "07:00", "01/12/2026"], ["3h", "05:00", "01/12/2026"], ["1d", "08:00", "30/11/2026"],
  ], "7:00 that morning equals 1 hour before and is offered once");
  assert.deepEqual(reminderPresets(source, tz, Date.parse("2026-12-01T00:50:00Z")), [], "nothing left within the last 10 minutes");
});

test("session times read naturally", () => {
  const now = Date.parse("2026-11-23T10:00:00Z");
  assert.equal(relativeTime("2026-11-23T09:59:30Z", now), "vừa xong");
  assert.equal(relativeTime("2026-11-23T09:15:00Z", now), "45 phút trước");
  assert.equal(relativeTime("2026-11-23T07:00:00Z", now), "3 giờ trước");
  assert.equal(relativeTime("2026-11-22T08:00:00Z", now), "hôm qua");
  assert.equal(relativeTime(null, now), "chưa ghi nhận");
  assert.equal(timeLeft("2026-12-22T10:00:00Z", now), "còn 29 ngày");
  assert.equal(timeLeft("2026-11-23T10:30:00Z", now), "sắp hết hạn");
});

test("the palette sentence is read wherever it appears, with everyday colour names", () => {
  const mid = dressPalette("Áo thun, quần short, dép. Tông màu: trắng, xanh biển, cát");
  assert.deepEqual(mid.colors.map((item) => item.name), ["trắng", "xanh biển", "cát"]);
  assert.equal(mid.rest, "Áo thun, quần short, dép.");
  assert.deepEqual(dressPalette("Tông màu: xanh dương và đen").colors.map((item) => item.name), ["xanh biển", "đen"]);
  assert.deepEqual(dressPalette("Tông màu: trắng, trắng").colors.length, 1);
});

const sources = {
  card: await readFile(new URL("../src/features/trips/components/place-card.tsx", import.meta.url), "utf8"),
  places: await readFile(new URL("../src/features/trips/screens/places-screen.tsx", import.meta.url), "utf8"),
};
test("POI data credits are shown once and spelled properly", () => {
  assert.equal(prettyAttribution("© Overture Maps Foundation; meta (CDLA-Permissive-2.0)"), "© Overture Maps Foundation; Meta (CDLA-Permissive-2.0)");
  assert.doesNotMatch(sources.card, /place\.source/, "cards no longer repeat the data source");
  assert.match(sources.places, /Dữ liệu địa điểm: \{credits\.join/);
});

test("price source and freshness labels separate real cached fares from simulation", () => {
  assert.equal(priceKind("TRAVELPAYOUTS_CACHE"), "real");
  assert.equal(priceKind("MOCK_FLIGHT"), "mock");
  assert.equal(priceKindLabel("TRAVELPAYOUTS_CACHE"), "Giá vé thật");
  const now = Date.parse("2026-11-23T10:00:00Z");
  assert.equal(freshnessLabel({ source_freshness: "FRESH_REFERENCE", provider_found_at: "2026-11-23T07:00:00Z" }, now), "Mới · tìm thấy 3 giờ trước");
  assert.equal(freshnessLabel({ source_freshness: "STALE", provider_found_at: "2026-11-20T10:00:00Z" }, now), "Đã cũ · tìm thấy 3 ngày trước");
  assert.equal(freshnessLabel(null, now), "");
});

test("price source errors keep their reason and read as actionable Vietnamese", async () => {
  const client = createApiClient({
    getBaseUrl: () => "https://gateway.test/api/v1",
    fetch: async () => Response.json({ error: { code: "VALIDATION_FAILED", message: "x", details: { reason: "PROVIDER_QUERY_UNSUPPORTED" } }, meta: {} }, { status: 400 }),
  });
  const failure = await client.request("/trips/t/price-watches", { method: "POST", body: {} }).catch((error) => error);
  assert.ok(failure instanceof ApiError);
  assert.equal(failure.reason, "PROVIDER_QUERY_UNSUPPORTED");
  assert.match(errorMessage(failure), /một chiều, hạng phổ thông, 1 người lớn/);
  const odd = new ApiError("SERVICE_UNAVAILABLE", "x", 503, false, undefined, "PRICE_PROVIDER_NOT_CONFIGURED");
  assert.match(errorMessage(odd), /chưa cấu hình nguồn giá vé thật/);
});
