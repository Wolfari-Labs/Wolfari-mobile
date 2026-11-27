import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ANY_SOURCE, capabilitiesNote, decodeCapabilities, unsupportedReason } from '../src/features/price-watch/capabilities.ts';

const searchapi = {
  provider: 'SEARCHAPI_GOOGLE_FLIGHTS',
  available: true,
  journey_types: ['ONE_WAY'],
  cabin_classes: ['ECONOMY'],
  max_adults: 1,
  max_children: 0,
  max_infants: 0,
  max_passengers: 1,
  currencies: ['VND'],
};
const input = (change = {}) => ({ journey_type: 'ONE_WAY', cabin_class: 'ECONOMY', passengers: { adults: 1, children: 0, infants: 0 }, ...change });

test('decodes the capabilities the Gateway returns and rejects anything else', () => {
  assert.deepEqual(decodeCapabilities(searchapi), searchapi);
  for (const bad of [
    { ...searchapi, journey_types: ['MULTI_CITY'] },
    { ...searchapi, cabin_classes: [] },
    { ...searchapi, max_adults: 0 },
    { ...searchapi, max_children: 10 },
    { ...searchapi, available: 'yes' },
    null,
  ])
    assert.throws(() => decodeCapabilities(bad));
});

test('a real source explains what it compares and refuses other combinations before sending', () => {
  assert.match(capabilitiesNote(searchapi), /vé một chiều, hạng phổ thông, 1 người lớn\./);
  assert.equal(unsupportedReason(searchapi, input()), undefined);
  for (const change of [
    { journey_type: 'ROUND_TRIP' },
    { cabin_class: 'BUSINESS' },
    { passengers: { adults: 2, children: 0, infants: 0 } },
    { passengers: { adults: 1, children: 1, infants: 0 } },
  ])
    assert.match(unsupportedReason(searchapi, input(change)), /không so sánh được/);
});

test('an older server without the API keeps every option and lets the server decide', () => {
  assert.equal(unsupportedReason(ANY_SOURCE, input({ journey_type: 'ROUND_TRIP', cabin_class: 'FIRST', passengers: { adults: 4, children: 3, infants: 2 } })), undefined);
  assert.match(capabilitiesNote(ANY_SOURCE), /một chiều hoặc khứ hồi, mọi hạng ghế, tối đa 9 hành khách/);
});

test('finance history names the payOS webhook and reconciliation actors', async () => {
  const { historyActorLabel } = await import('../src/features/finance/history-labels.ts');
  const who = () => 'Người dùng';
  assert.equal(historyActorLabel({ actor_user_id: null, system_actor: 'PAYOS_WEBHOOK' }, who), 'payOS báo đã nhận tiền');
  assert.equal(historyActorLabel({ actor_user_id: null, system_actor: 'PAYOS_RECONCILIATION' }, who), 'Đối soát payOS tự động');
  assert.equal(historyActorLabel({ actor_user_id: null, system_actor: 'SOMETHING_NEW' }, who), 'Hệ thống');
});
