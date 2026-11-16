import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTripsApi } from '../src/features/trips/api/trips.api.ts';
import { dressCodeForm, dressCodeInput, dressScopeLabel } from '../src/features/trips/model/dress-code.ts';
import { dressRegion, dressSuggestionText, dressSuggestions, dressWeather } from '../src/features/trips/model/dress-suggestions.ts';

const days = ['2026-11-12', '2026-11-13'];
const activities = [{ id: 'a1', title: 'Chùa Linh Ứng' }, { id: 'a2', title: 'Ăn tối' }];
const context = { planVersion: 7, days, activities };
const form = (extra = {}) => ({ label: ' Trắng bên biển ', scope: 'TRIP', date: days[0], activity: 'a1', description: '  ', ...extra });

test('a new form starts on the whole trip with valid choices for the other scopes', () => {
  assert.deepEqual(dressCodeForm(undefined, days, activities), { id: undefined, label: '', scope: 'TRIP', date: days[0], activity: 'a1', description: '' });
  const saved = { id: 'd1', scope_type: 'ACTIVITY', plan_date: null, activity_id: 'a2', label: 'Lịch sự', description: 'Áo có tay' };
  assert.deepEqual(dressCodeForm(saved, days, activities), { id: 'd1', label: 'Lịch sự', scope: 'ACTIVITY', date: days[0], activity: 'a2', description: 'Áo có tay' });
});

test('each scope sends only its own reference and clears the others', () => {
  assert.deepEqual(dressCodeInput(form(), context), { input: { scope_type: 'TRIP', plan_date: null, activity_id: null, label: 'Trắng bên biển', description: null, expected_plan_version: 7 } });
  assert.deepEqual(dressCodeInput(form({ scope: 'DAY', date: days[1], description: ' Áo trắng ' }), context).input, { scope_type: 'DAY', plan_date: days[1], activity_id: null, label: 'Trắng bên biển', description: 'Áo trắng', expected_plan_version: 7 });
  assert.deepEqual(dressCodeInput(form({ scope: 'ACTIVITY', activity: 'a2' }), context).input, { scope_type: 'ACTIVITY', plan_date: null, activity_id: 'a2', label: 'Trắng bên biển', description: null, expected_plan_version: 7 });
  assert.ok(!('public_description' in dressCodeInput(form(), context).input));
});

test('validation names the field before anything is sent', () => {
  assert.match(dressCodeInput(form({ label: '  ' }), context).error, /Nhập tên/);
  assert.match(dressCodeInput(form({ label: 'x'.repeat(101) }), context).error, /tối đa 100/);
  assert.match(dressCodeInput(form({ scope: 'DAY', date: '2026-11-20' }), context).error, /ngày trong chuyến đi/);
  assert.match(dressCodeInput(form({ scope: 'ACTIVITY', activity: 'gone' }), context).error, /hoạt động hiện có/);
  assert.match(dressCodeInput(form({ scope: 'ACTIVITY' }), { ...context, activities: [] }).error, /hoạt động hiện có/);
  assert.match(dressCodeInput(form({ description: 'x'.repeat(10_001) }), context).error, /quá dài/);
});

test('scope labels read as trip, day or activity title', () => {
  assert.equal(dressScopeLabel({ scope_type: 'TRIP', plan_date: null, activity_id: null }, activities), 'Cả hành trình');
  assert.equal(dressScopeLabel({ scope_type: 'DAY', plan_date: '2026-11-13', activity_id: null }, activities), 'Ngày 13/11');
  assert.equal(dressScopeLabel({ scope_type: 'ACTIVITY', plan_date: null, activity_id: 'a2' }, activities), 'Ăn tối');
  assert.equal(dressScopeLabel({ scope_type: 'ACTIVITY', plan_date: null, activity_id: 'gone' }, activities), 'Hoạt động không còn trong kế hoạch');
});

test('API051-053 requests carry the idempotency key and plan version', async () => {
  const calls = [];
  const api = createTripsApi({ request: async (path, options) => { calls.push({ path, ...options }); return {}; } });
  const input = dressCodeInput(form(), context).input;
  await api.saveDressCode('trip 1', undefined, input, 'k1');
  await api.saveDressCode('trip 1', 'd/1', input, 'k2');
  await api.removeDressCode('trip 1', 'd/1', 7, 'k3');
  assert.deepEqual(calls.map(call => [call.method, call.path, call.headers['Idempotency-Key']]), [
    ['POST', '/trips/trip%201/dress-codes', 'k1'],
    ['PATCH', '/trips/trip%201/dress-codes/d%2F1', 'k2'],
    ['DELETE', '/trips/trip%201/dress-codes/d%2F1', 'k3'],
  ]);
  assert.deepEqual(calls[0].body, input);
  assert.deepEqual(calls[2].body, { expected_plan_version: 7 });
});

test('suggestions follow the usual weather of the place and month, then matching places', () => {
  assert.equal(dressRegion(['Wolfari Demo — Đà Nẵng']), 'CENTRAL');
  assert.equal(dressRegion(['Chuyến đi mùa hè'], 21.03), 'NORTH');
  assert.equal(dressRegion(['Chuyến đi mùa hè']), null);
  assert.equal(dressWeather('CENTRAL', 11), 'RAINY');
  assert.equal(dressWeather('NORTH', 1), 'COLD');
  assert.equal(dressWeather('SOUTH', 2), 'HOT');
  assert.equal(dressWeather('HIGHLAND', 6), 'COOL');
  assert.deepEqual(dressSuggestions('RAINY', ['Đà Nẵng', 'Chùa Linh Ứng', 'Đến sân bay']).map(item => item.id), ['weather-rainy', 'place-beach', 'place-sacred']);
  assert.deepEqual(dressSuggestions('HOT', ['Dạo phố', 'Nộp thuế']).map(item => item.id), ['weather-hot', 'place-city']);
  assert.match(dressSuggestionText(dressSuggestions('HOT', [])[0]), /^Tông màu: trắng, be, xanh nhạt. /);
});
