import assert from "node:assert/strict";
import test from "node:test";
import { createDraftStore, decodeDraft, draftKey, DRAFT_TTL, DRAFT_LIMIT } from "../src/shared/storage/draft-store.ts";
import { isCollection, isCreateDraft, emptyCreateDraft, normalizeText, money, validDate, packingError, watchError, fundError, fundSummary } from "../src/features/trips/model/local-parity.ts";
import { isPlaceDraft, validCoordinates } from "../src/features/trips/model/place-draft.ts";
import { queryTrips } from "../src/features/trips/model/trip-list-query.ts";

const collection = { base: "1", rows: [{ id: "one", name: "Áo khoác" }], history: [] };
test("draft keys isolate account, trip, feature and delimiters", () => {
  const keys = [draftKey("a", "trip", "packing"), draftKey("b", "trip", "packing"), draftKey("a", "other", "packing"), draftKey("a", "trip", "fund"), draftKey("a:trip", "x", "y"), draftKey("a", "trip:x", "y")];
  assert.equal(new Set(keys).size, keys.length);
});
test("versioned drafts reject corruption and oversized data; expire after 30 days", () => {
  const now = Date.now();
  assert.deepEqual(decodeDraft(JSON.stringify({ version: 1, savedAt: now, value: collection }), isCollection, now), collection);
  assert.equal(decodeDraft(null, isCollection, now), null);
  assert.equal(decodeDraft(JSON.stringify({ version: 1, savedAt: now - DRAFT_TTL - 1, value: collection }), isCollection, now), null);
  assert.throws(() => decodeDraft("{bad", isCollection));
  assert.throws(() => decodeDraft("x".repeat(DRAFT_LIMIT + 1), isCollection));
  assert.throws(() => decodeDraft(JSON.stringify({ version: 9, savedAt: now, value: collection }), isCollection));
  assert.equal(isCollection({ ...collection, rows: [collection.rows[0], collection.rows[0]] }), false);
  assert.equal(isCollection({ ...collection, rows: [{ id: "x", quantity: 1 }] }), false);
  assert.ok(isCreateDraft(emptyCreateDraft));
  assert.equal(isCreateDraft({ name: "partial" }), false);
});
test("storage serializes saves and removal; failed write does not poison queue", async () => {
  const data = new Map(), calls = [];
  let release, fail = false;
  const gate = new Promise(resolve => { release = resolve; });
  const store = createDraftStore({
    getItem: async key => data.get(key) ?? null,
    setItem: async (key, value) => { calls.push("write"); await gate; if (fail) throw new Error("disk full"); data.set(key, value); },
    removeItem: async key => { calls.push("remove"); data.delete(key); },
  });
  const first = store.write("a", collection);
  const second = store.write("a", { ...collection, base: "2" });
  const remove = store.remove("a");
  release();
  await Promise.all([first, second, remove]);
  assert.deepEqual(calls, ["write", "write", "remove"]);
  assert.equal(await store.read("a", isCollection), null);
  fail = true;
  await assert.rejects(store.write("a", collection), /disk full/);
  fail = false;
  await store.write("a", collection);
  assert.deepEqual(await store.read("a", isCollection), collection);
  await assert.rejects(store.write("a", "x".repeat(DRAFT_LIMIT)), /quá lớn/);
});
test("money and dates are strict, draft expenses never include outside notes", () => {
  for (const value of ["0", "-1", "1.2", "1e6", "NaN", "1000000000000"]) assert.equal(money(value), null);
  assert.equal(money("250000"), 250000);
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2028-02-29"), true);
  assert.equal(validDate("2026-2-01"), false);
  assert.deepEqual(fundSummary([{ id: "1", kind: "contribution", amount: "1000000" }, { id: "2", kind: "expense", amount: "250000" }, { id: "3", kind: "refund", amount: "100000" }, { id: "4", kind: "outside", amount: "999999" }]), { contributions: 1000000, expenses: 250000, refunds: 100000, balance: 750000, available: 650000 });
  assert.ok(fundError({ id: "f", name: "Ăn", amount: "-1", date: "2026-11-12" }));
});
test("packing accepts fractional amounts and watch validates route and return", () => {
  assert.equal(packingError({ id: "p", name: "Nước", quantity: "1,25", due: "2026-11-12" }), undefined);
  assert.ok(packingError({ id: "p", name: "Nước", quantity: "0" }));
  assert.ok(packingError({ id: "p", name: "Nước", quantity: "1.234" }));
  const watch = { id: "w", origin: "Hà Nội", destination: "Đà Nẵng", departure: "2026-11-12", returnDate: "2026-11-14", direction: "round", passengers: "2", threshold: "2000000" };
  assert.equal(watchError(watch), undefined);
  assert.ok(watchError({ ...watch, returnDate: "2026-11-11" }));
  assert.ok(watchError({ ...watch, destination: "ha noi" }));
  assert.ok(watchError({ ...watch, passengers: "10" }));
});
test("place drafts validate null and finite coordinates without coercing zero", () => {
  assert.ok(validCoordinates(0, 0));
  assert.equal(validCoordinates(null, 0), false);
  assert.equal(validCoordinates(91, 0), false);
  assert.equal(validCoordinates(1, NaN), false);
  assert.ok(isPlaceDraft({ selected: [], hidden: [], places: [{ id: "local:1", name: "Quán", address: "", source: "manual", latitude: null, longitude: null, attribution: [] }] }));
  assert.equal(isPlaceDraft({ selected: [], hidden: [], places: [{ id: "x", latitude: 200 }] }), false);
});
test("trip search ignores accents, preserves source order, sorts dates and filters lifecycle", () => {
  const trips = [
    { id: "a", name: "Đà Nẵng", start_at: "2026-12-01", lifecycle: "UPCOMING" },
    { id: "b", name: "Đà Lạt", start_at: "2026-11-01", lifecycle: "UPCOMING" },
    { id: "c", name: "Hà Nội", start_at: "2026-01-01", lifecycle: "COMPLETED" },
  ];
  assert.equal(normalizeText("ĐÀ NẴNG"), "da nang");
  assert.deepEqual(queryTrips(trips, "ALL", "da nang", "default").map(t => t.id), ["a"]);
  assert.deepEqual(queryTrips(trips, "UPCOMING", "", "asc").map(t => t.id), ["b", "a"]);
  assert.deepEqual(queryTrips(trips, "ALL", "", "desc").map(t => t.id), ["a", "b", "c"]);
  assert.deepEqual(trips.map(t => t.id), ["a", "b", "c"]);
});
