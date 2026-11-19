import assert from 'node:assert/strict';
import test from 'node:test';
import { completeSimulatedExpense, createSimulatedFund, isSimulatedFund, simulatedFundTotals } from '../src/features/payments/model/simulated-fund.ts';
import { createDraftStore, draftKey } from '../src/shared/storage/draft-store.ts';

const entry = { id: '10000000-0000-4000-8000-000000000001', amount: '150000', note: 'Bữa tối nhóm', created_at: '2026-11-19T03:00:00.000Z' };

test('simulated expense changes its local balance and history together, preserves refunds, and replays once', () => {
  const original = createSimulatedFund('3600000', '300000');
  const paid = completeSimulatedExpense(original, entry);
  assert.deepEqual(simulatedFundTotals(paid), { spent: '150000', balance: '3450000', available: '3150000' });
  assert.equal(paid.entries.length, 1);
  assert.deepEqual(original.entries, []);
  assert.equal(completeSimulatedExpense(paid, { ...entry, created_at: '2026-11-20T03:00:00.000Z' }), paid);
  assert.throws(() => completeSimulatedExpense(paid, { ...entry, amount: '100000' }), /đã được sử dụng/);
  assert.throws(() => completeSimulatedExpense(paid, { ...entry, note: 'Khác' }), /đã được sử dụng/);
});

test('insufficient funds and corrupt money never leave a partial expense; int64 stays exact', () => {
  const fund = createSimulatedFund('3600000', '300000');
  assert.throws(() => completeSimulatedExpense(fund, { ...entry, amount: '3300001' }), /không đủ/);
  assert.deepEqual(fund.entries, []);
  for (const amount of ['0', '-1', '1.5', '1e3', '001', '9223372036854775808'])
    assert.throws(() => completeSimulatedExpense(fund, { ...entry, amount }));
  const exact = completeSimulatedExpense(createSimulatedFund('9223372036854775807', '0'), { ...entry, amount: '1' });
  assert.equal(simulatedFundTotals(exact).balance, '9223372036854775806');
  assert.equal(isSimulatedFund({ ...fund, entries: [entry, entry] }), false);
  assert.equal(isSimulatedFund({ ...fund, reserved_refund: '3600001' }), false);
  assert.equal(isSimulatedFund({ ...fund, entries: [{ ...entry, created_at: 'bad' }] }), false);
});

test('simulated history survives a new storage instance and stays isolated by account and fund', async () => {
  const rows = new Map();
  const storage = { getItem: async key => rows.get(key) ?? null, setItem: async (key, value) => { rows.set(key, value); }, removeItem: async key => { rows.delete(key); } };
  const key = draftKey('user-1', 'fund-1', 'payment-simulation');
  const paid = completeSimulatedExpense(createSimulatedFund('3600000', '300000'), entry);
  await createDraftStore(storage).write(key, paid);
  const restored = createDraftStore(storage);
  assert.deepEqual(await restored.read(key, isSimulatedFund), paid);
  assert.equal(await restored.read(draftKey('user-2', 'fund-1', 'payment-simulation'), isSimulatedFund), null);
  assert.equal(await restored.read(draftKey('user-1', 'fund-2', 'payment-simulation'), isSimulatedFund), null);
  await restored.remove(key);
  assert.equal(await restored.read(key, isSimulatedFund), null);
  storage.setItem = async () => { throw Error('disk full'); };
  await assert.rejects(createDraftStore(storage).write(key, paid), /disk full/);
  assert.equal(await restored.read(key, isSimulatedFund), null);
});
