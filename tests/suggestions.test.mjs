import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTripsApi } from '../src/features/trips/api/trips.api.ts';
import { appliedMessage, dayPoint, initialSelection, itemContext, itemTitle, sourceLine, weatherMood, weatherSummary } from '../src/features/trips/model/suggestions.ts';

const tz = 'Asia/Ho_Chi_Minh';
const place = (id, latitude, longitude) => ({ id, name: id, address: null, latitude, longitude, source: 'MANUAL' });
const stop = (id, location, extra = {}) => ({ id, title: id, selected_location_id: location, starts_at: null, scheduled_date: '2026-12-02', position: 0, ...extra });

test('weather is asked for the first located stop of the day, then any saved place', () => {
  const plan = {
    selected_locations: [place('hue', '16.46', '107.59'), place('dn', '16.05', '108.2'), place('bad', null, null)],
    activities: [stop('late', 'hue', { starts_at: '2026-12-02T08:00:00Z', scheduled_date: null }), stop('early', 'dn', { starts_at: '2026-12-02T01:00:00Z', scheduled_date: null }), stop('nowhere', 'bad')],
  };
  assert.deepEqual(dayPoint(plan, '2026-12-02', tz), { latitude: 16.05, longitude: 108.2 });
  assert.deepEqual(dayPoint(plan, '2026-12-05', tz), { latitude: 16.46, longitude: 107.59 });
  assert.equal(dayPoint({ selected_locations: [place('bad', null, null)], activities: [] }, '2026-12-02', tz), undefined);
});

test('the weather line leaves out what the provider did not send', () => {
  const day = { date: '2026-12-02', temperature_max_c: 31.4, temperature_min_c: 23.6, rain_probability: 0.6, uv_index: 8.2 };
  assert.equal(weatherSummary(day), '31° / 24° · Mưa 60% · UV 8 rất cao');
  assert.equal(weatherSummary({ ...day, temperature_min_c: null, rain_probability: null, uv_index: 5 }), '31° · UV 5');
  assert.equal(weatherMood(day), 'rain');
  assert.equal(weatherMood({ ...day, rain_probability: 0.1, temperature_min_c: 15 }), 'cool');
  assert.equal(weatherMood({ ...day, rain_probability: 0.1 }), 'sun');
});

test('the source line names Open-Meteo, flags old and sample data', () => {
  assert.equal(sourceLine({ provider: 'OPEN_METEO', fetched_at: '2026-11-25T03:05:00Z', stale: false, is_mock: false }, tz), 'Open-Meteo · cập nhật 10:05');
  assert.equal(sourceLine({ provider: 'OPEN_METEO', fetched_at: null, stale: true, is_mock: false }, tz), 'Open-Meteo · có thể đã cũ');
  assert.equal(sourceLine({ provider: 'MOCK', fetched_at: null, stale: false, is_mock: true }, tz), 'Dữ liệu mẫu');
});

test('suggestions already in the plan start unticked and rows read naturally', () => {
  const umbrella = { id: 'a'.repeat(24), kind: 'PACKING', reasons: ['Mưa 70%'], rule_ids: ['PK-RAIN'], warnings: [], packing_item: { name: 'Ô', quantity: '1' } };
  const shoes = { id: 'b'.repeat(24), kind: 'PACKING', reasons: [], rule_ids: [], warnings: ['ALREADY_IN_PLAN'], packing_item: { name: 'Áo mưa', quantity: '2', unit: 'cái', category: 'Thời tiết' } };
  const modest = { id: 'c'.repeat(24), kind: 'DRESS_CODE', reasons: [], rule_ids: [], warnings: [], date: '2026-12-02', dress_code: { label: 'Kín đáo', activity_id: 't1' } };
  assert.deepEqual([...initialSelection({ items: [umbrella, shoes, modest] })], [umbrella.id, modest.id]);
  assert.equal(itemTitle(umbrella), 'Ô');
  assert.equal(itemTitle(shoes), 'Áo mưa · 2 cái');
  assert.equal(itemContext(modest, [{ id: 't1', title: 'Chùa Linh Ứng' }]), 'Chùa Linh Ứng · 02/12');
  assert.equal(itemContext(shoes, []), 'Thời tiết');
  assert.equal(appliedMessage({ applied: { item_ids: [], created: [{}, {}], skipped: [{}] } }), 'Đã thêm 2 gợi ý vào chuyến đi, bỏ qua 1 mục đã có.');
  assert.match(appliedMessage({ applied: { item_ids: [], created: [], skipped: [{}] } }), /có sẵn/);
});

test('the API sends weather as a query and apply with its Idempotency-Key', async () => {
  const calls = [];
  const client = {
    request: async (path, options = {}) => { calls.push({ path, ...options }); return {}; },
    requestWithMeta: async (path, options = {}) => { calls.push({ path, ...options }); return { data: null, meta: {} }; },
  };
  const api = createTripsApi(client);
  await api.weather({ latitude: 16.05, longitude: 108.2 }, '2026-12-02');
  await api.previewRecommendation('t/1', { type: 'ALL' });
  await api.applyRecommendation('r1', { item_ids: ['x'], expected_plan_version: 4 }, 'key-1');
  await api.ignoreRecommendation('r1');
  assert.equal(calls[0].path, '/travel/weather?latitude=16.05&longitude=108.2&date=2026-12-02');
  assert.deepEqual([calls[1].path, calls[1].method, calls[1].body], ['/trips/t%2F1/recommendations', 'POST', { type: 'ALL' }]);
  assert.deepEqual([calls[2].path, calls[2].headers['Idempotency-Key'], calls[2].body], ['/recommendations/r1/apply', 'key-1', { item_ids: ['x'], expected_plan_version: 4 }]);
  assert.equal(calls[3].path, '/recommendations/r1/ignore');
});
