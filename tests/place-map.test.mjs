import assert from "node:assert/strict";
import test from "node:test";
import { centerOf, distanceLabel, durationLabel, fitRegion, formActivityType, haversine, regionBbox, straightLine } from "../src/features/trips/model/place.ts";

test("visit durations and distances read naturally in Vietnamese", () => {
  assert.equal(durationLabel(45), "~45 phút");
  assert.equal(durationLabel(90), "~1 giờ 30 phút");
  assert.equal(durationLabel(120), "~2 giờ");
  assert.equal(durationLabel(undefined), "");
  assert.equal(distanceLabel(843), "840 m");
  assert.equal(distanceLabel(12_345), "12 km");
  assert.equal(distanceLabel(2_345), "2,3 km");
});

test("POI activity types map onto the activity form", () => {
  assert.equal(formActivityType("FOOD"), "MEAL");
  assert.equal(formActivityType("TRANSPORT"), "TRANSPORT");
  assert.equal(formActivityType("BEACH"), "SIGHTSEEING");
  assert.equal(formActivityType(""), "SIGHTSEEING");
});

test("map frame becomes a bbox no larger than the server allows", () => {
  assert.equal(regionBbox({ latitude: 16, longitude: 108, latitudeDelta: 0.2, longitudeDelta: 0.4 }), "107.80000,15.90000,108.20000,16.10000");
  // Zoomed far out: clamped to 2 degrees per side around the centre.
  assert.equal(regionBbox({ latitude: 16, longitude: 108, latitudeDelta: 9, longitudeDelta: 9 }), "107.00000,15.00000,109.00000,17.00000");
});

test("straight-line fallback sums the legs between stops", () => {
  const a = { latitude: 16.0544, longitude: 108.2022 }, b = { latitude: 16.061, longitude: 108.227 };
  const leg = haversine(a, b);
  assert.ok(leg > 2600 && leg < 2800, String(leg));
  assert.equal(Math.round(straightLine([a, b, a]).distance_m), Math.round(leg * 2));
  assert.deepEqual(centerOf([a, b]), { latitude: (a.latitude + b.latitude) / 2, longitude: (a.longitude + b.longitude) / 2 });
  assert.equal(fitRegion([]).latitude, 16.0544);
});
