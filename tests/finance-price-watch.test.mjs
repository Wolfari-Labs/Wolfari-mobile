import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, createApiClient } from '../src/shared/api/api-client.ts';
import { createFinanceApi, decodeCollection, decodeRow } from '../src/features/finance/api.ts';
import {
  money,
  moneyLabel,
  sandboxPaymentUrl,
  instructionQrUrl,
} from '../src/features/finance/extended-model.ts';
import { createCommandJournal } from '../src/features/finance/command.ts';
import { chunkedStorage } from '../src/features/finance/chunked-storage.ts';
import { createPriceWatchApi, watchInput } from '../src/features/price-watch/api.ts';

const base = 'https://gateway.test/api/v1';
test('QR URL matches the TEST instruction and rejects foreign hosts or altered amount', () => {
  const instruction = {
    environment: 'TEST',
    bank_bin: '970436',
    account_number: '0001234567',
    amount: '180000',
    reference: 'TESTREF',
    recipient_name: 'TEST ONLY',
    qr_url:
      'https://img.vietqr.io/image/970436-0001234567-compact2.svg?amount=180000&addInfo=TESTREF&accountName=TEST+ONLY',
  };
  assert.equal(instructionQrUrl(instruction), instruction.qr_url);
  for (const change of [
    { amount: '180001' },
    { environment: 'PRODUCTION' },
    { qr_url: instruction.qr_url.replace('img.vietqr.io', 'evil.test') },
    { qr_url: instruction.qr_url + '&amount=1' },
  ])
    assert.throws(() => instructionQrUrl({ ...instruction, ...change }));
});
const intent = {
  key: '11111111-1111-4111-8111-111111111111',
  path: '/contributions/c/confirm-received',
  method: 'POST',
  body: { expected_version: 2, expected_finance_version: 4 },
  label: 'Xác nhận',
  kind: 'finance',
  createdAt: '2026-11-04T00:00:00Z',
  attempted: false,
};
function memory() {
  const data = new Map();
  return {
    data,
    async get(k) {
      return data.get(k) ?? null;
    },
    async set(k, v) {
      data.set(k, v);
    },
    async remove(k) {
      data.delete(k);
    },
  };
}

test('VND preserves int64 precision, rejects decimals and formats without Number', () => {
  assert.equal(money('009007199254740993'), '9007199254740993');
  assert.equal(moneyLabel('9007199254740993'), '9.007.199.254.740.993 ₫');
  for (const value of ['0', '-1', '200.000', '1.5', '9223372036854775808', '1e3'])
    assert.throws(() => money(value));
  assert.equal(money('0', false), '0');
});
test('Finance pagination and writes use exact API contract, string money, key and both versions', async () => {
  const calls = [];
  const api = createFinanceApi(
    createApiClient({
      getBaseUrl: () => base,
      fetch: async (url, options) => {
        calls.push({ url, options });
        return Response.json({
          data:
            options.method === 'POST'
              ? { id: 'c', status: 'CONFIRMED', amount: '200000' }
              : { items: [], next_cursor: 'next' },
        });
      },
    }),
  );
  assert.equal((await api.list('fund', 'transactions', 'a+b')).next_cursor, 'next');
  assert.equal(calls[0].url, `${base}/funds/fund/transactions?limit=20&cursor=a%2Bb`);
  await api.write(intent);
  assert.equal(calls[1].options.headers['Idempotency-Key'], intent.key);
  assert.deepEqual(JSON.parse(calls[1].options.body), intent.body);
});
test('Fund absent is distinct from permission/network errors and zero balance', async () => {
  let status = 404,
    code = 'RESOURCE_NOT_FOUND';
  const api = createFinanceApi(
    createApiClient({
      getBaseUrl: () => base,
      fetch: async () => Response.json({ error: { code, message: 'Fixture' } }, { status }),
    }),
  );
  assert.equal(await api.fund('trip'), null);
  status = 403;
  code = 'PERMISSION_DENIED';
  await assert.rejects(api.fund('trip'), (e) => e.status === 403);
  status = 503;
  await assert.rejects(api.fund('trip'), (e) => e.status === 503);
});
test('Wrong fund, numeric money and malformed closure are rejected before rendering', () => {
  assert.throws(() => decodeRow({ id: 'c', fund_id: 'other' }, { field: 'fund_id', id: 'fund' }));
  assert.throws(() => decodeRow({ id: 'c', amount: 200000 }));
  assert.throws(() =>
    decodeCollection({ id: 'closure', fund_id: 'fund', snapshot: {} }, 'closures', 'fund'),
  );
});
test('Lost response freezes body/key, survives restart, blocks replacement, and replays once', async () => {
  const storage = memory(),
    first = createCommandJournal(storage, 'user.trip');
  const input = structuredClone(intent);
  await assert.rejects(
    first.send(input, async () => {
      throw new ApiError('NETWORK_ERROR', 'Lost', 0, true);
    }),
  );
  input.body.expected_finance_version = 99;
  const restored = createCommandJournal(storage, 'user.trip');
  await restored.restore();
  assert.deepEqual(restored.pending.body, intent.body);
  await assert.rejects(restored.send({ ...intent, key: 'other' }, async () => ({})));
  const result = await restored.send(undefined, async (saved) => {
    assert.equal(saved.key, intent.key);
    assert.deepEqual(saved.body, intent.body);
    return { id: 'c', status: 'CONFIRMED' };
  });
  assert.equal(result.done, true);
  assert.equal(restored.pending, null);
  assert.equal(storage.data.size, 0);
});
test('Initial version rejection unlocks for reload but uncertain retry conflict never discards intent', async () => {
  const fresh = createCommandJournal(memory(), 'fresh');
  await assert.rejects(
    fresh.send(intent, async () => {
      throw new ApiError('VERSION_CONFLICT', 'stale', 409);
    }),
  );
  assert.equal(fresh.pending, null);
  const uncertain = createCommandJournal(memory(), 'uncertain');
  await assert.rejects(
    uncertain.send(intent, async () => {
      throw new ApiError('NETWORK_ERROR', 'lost');
    }),
  );
  await assert.rejects(
    uncertain.send(undefined, async () => {
      throw new ApiError('VERSION_CONFLICT', 'stale', 409);
    }),
  );
  assert.equal(uncertain.pending.key, intent.key);
});
test('202/recovery does not mean success; only committed matching operation clears the journal', async () => {
  const journal = createCommandJournal(memory(), 'op');
  assert.equal(
    (
      await journal.send(intent, async () => ({
        operation_id: intent.key,
        state: 'PENDING_RECOVERY',
      }))
    ).done,
    false,
  );
  await assert.rejects(
    journal.check(async () => ({
      operation_id: 'wrong',
      state: 'SUCCEEDED',
      outcome: { status: 'COMMITTED' },
    })),
  );
  await assert.rejects(
    journal.check(async () => ({ operation_id: intent.key, state: 'NEEDS_REVIEW' })),
  );
  assert.ok(journal.pending);
  assert.equal(
    await journal.check(async () => ({
      operation_id: intent.key,
      state: 'SUCCEEDED',
      outcome: { status: 'COMMITTED' },
    })),
    true,
  );
  assert.equal(journal.pending, null);
});
test('Deletion can return an already committed operation; closure remind is accepted separately', async () => {
  for (const extra of [
    { state: 'SUCCEEDED', outcome: { status: 'COMMITTED' } },
    { accepted: true, closure_id: 'closure' },
  ]) {
    const journal = createCommandJournal(memory(), 'done');
    assert.equal(
      (await journal.send(intent, async () => ({ operation_id: intent.key, ...extra }))).done,
      true,
    );
    assert.equal(journal.pending, null);
  }
});
test('Committed operation can retain original intent until receipt replay returns its created entity', async () => {
  const journal = createCommandJournal(memory(), 'payment-recovery');
  await journal.send(intent, async () => ({ operation_id: intent.key, state: 'PENDING_RECOVERY' }));
  await journal.check(
    async () => ({
      operation_id: intent.key,
      state: 'SUCCEEDED',
      outcome: { status: 'COMMITTED' },
    }),
    true,
  );
  assert.equal(journal.pending.key, intent.key);
  const response = await journal.send(undefined, async (saved) => {
    assert.deepEqual(saved.body, intent.body);
    return { id: 'created-attempt', provider: 'MOMO_SANDBOX' };
  });
  assert.equal(response.result.id, 'created-attempt');
  assert.equal(journal.pending, null);
});
test('Storage failure prevents the HTTP mutation and concurrent taps send only once', async () => {
  let calls = 0;
  const bad = createCommandJournal(
    {
      ...memory(),
      async set() {
        throw Error('disk');
      },
    },
    'blocked',
  );
  await assert.rejects(
    bad.send(intent, async () => {
      calls++;
    }),
  );
  assert.equal(calls, 0);
  const journal = createCommandJournal(memory(), 'locked');
  let resolve;
  const wait = new Promise((r) => {
    resolve = r;
  });
  const first = journal.send(intent, async () => {
    calls++;
    await wait;
    return {};
  });
  await assert.rejects(
    journal.send(intent, async () => {
      calls++;
    }),
  );
  resolve();
  await first;
  assert.equal(calls, 1);
});
test('Secure journal chunks preserve Unicode and keep previous pointer when a write fails', async () => {
  const baseStorage = memory();
  // Model the native UTF-8 boundary: a split surrogate would become U+FFFD.
  const nativeSet = baseStorage.set;
  baseStorage.set = (key, value) => nativeSet(key, Buffer.from(value, 'utf8').toString('utf8'));
  let generation = 0;
  const store = chunkedStorage(baseStorage, () => `g${++generation}`);
  const large = JSON.stringify({ reason: 'đóng góp 🌏'.repeat(600) });
  await store.set('pending', large);
  assert.equal(await store.get('pending'), large);
  for (const [key, value] of baseStorage.data)
    if (key !== 'pending') assert.ok(Buffer.byteLength(value) <= 1600);
  const originalSet = baseStorage.set;
  baseStorage.set = async (k, v) => {
    if (k.endsWith('.g2.1')) throw Error('disk full');
    return originalSet(k, v);
  };
  await assert.rejects(store.set('pending', 'x'.repeat(1000)));
  assert.equal(await store.get('pending'), large);
  await store.remove('pending');
  assert.equal(await store.get('pending'), null);
});
test('Sandbox URL restricts opening to exact HTTPS MoMo test host', () => {
  assert.equal(
    sandboxPaymentUrl('https://test-payment.momo.vn/mock/abc'),
    'https://test-payment.momo.vn/mock/abc',
  );
  for (const url of [
    'http://test-payment.momo.vn/pay',
    'https://test-payment.momo.vn.evil.test',
    'https://evil@test-payment.momo.vn/pay',
    'javascript:alert(1)',
  ])
    assert.throws(() => sandboxPaymentUrl(url));
});
const flight = {
  origin: 'sgn',
  destination: 'dad',
  departure_date: '2030-01-02',
  departure_time: '12:00',
  journey_type: 'ONE_WAY',
  return_date: '',
  adults: '1',
  children: '0',
  infants: '0',
  cabin_class: 'ECONOMY',
  threshold_price: '2000000',
};
test('Watch input normalizes query while keeping each threshold separate', () => {
  const one = watchInput(flight, 0),
    two = watchInput({ ...flight, threshold_price: '3000000' }, 0);
  assert.equal(one.provider, 'MOCK_FLIGHT');
  assert.equal(one.origin, 'SGN');
  assert.equal(one.departure_at, '2030-01-02T12:00:00Z');
  assert.deepEqual({ ...one, threshold_price: null }, { ...two, threshold_price: null });
  assert.notEqual(one.threshold_price, two.threshold_price);
});
test('Watch rejects equal airports, past/nonexistent dates, bad passengers and return dates', () => {
  for (const patch of [
    { destination: 'SGN' },
    { departure_date: '2020-01-01' },
    { departure_date: '2030-02-30' },
    { infants: '2' },
    { adults: '9', children: '1' },
    { adults: '' },
    { departure_time: '24:30' },
    { journey_type: 'ROUND_TRIP', return_date: '2029-12-31' },
  ])
    assert.throws(() => watchInput({ ...flight, ...patch }, Date.parse('2026-11-04')));
});
test('Price Watch reads metadata pagination/stale separately from observations, no zero price fallback', async () => {
  let data = [],
    meta = { next_cursor: 'next', stale: true, last_error: 'PROVIDER_UNAVAILABLE' };
  const api = createPriceWatchApi(
    createApiClient({ getBaseUrl: () => base, fetch: async () => Response.json({ data, meta }) }),
  );
  const empty = await api.observations('watch');
  assert.deepEqual(empty.items, []);
  assert.equal(empty.stale, true);
  assert.equal(empty.next_cursor, 'next');
  data = [
    {
      id: 'price',
      price: '1800000',
      currency: 'VND',
      provider: 'MOCK_FLIGHT',
      observed_at: '2026-11-04T00:00:00Z',
      fetched_at: '2026-11-04T00:00:00Z',
    },
  ];
  assert.equal((await api.observations('watch')).items[0].price, '1800000');
  meta = { next_cursor: null };
  await assert.rejects(api.observations('watch'), (e) => e.code === 'INVALID_RESPONSE');
});
