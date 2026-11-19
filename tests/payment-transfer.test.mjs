import assert from 'node:assert/strict';
import test from 'node:test';
import { createPaymentsApi } from '../src/features/payments/api.ts';
import { paymentTransfer, sandboxAmount, scannedBankDeeplink } from '../src/features/payments/model/payment-transfer.ts';
import { bankDisplayName } from '../src/features/finance/bank-names.ts';
import { VIETQR_BANKS } from '../src/features/finance/vietqr-banks.ts';

const payment = { bankBin: '970436', account: '0012345678', amount: '1000', note: 'Old content', recipientLabel: 'TEST ACCOUNT' };
const request = { request_id: '10000000-0000-4000-8000-000000000001', amount: '150000', note: 'Thanh toán bữa tối & nước' };
const checkout = { request_id: request.request_id, order_id: 'wqr-' + 'a'.repeat(40), amount: request.amount, payment_url: 'https://test-payment.momo.vn/v2/gateway/pay?t=fixture', environment: 'SANDBOX' };

test('a scanned transfer uses entered amount/note and preserves the actual receiving account when a different paying bank is selected', () => {
  const transfer = paymentTransfer(payment, '00150000', request.note);
  assert.equal(transfer.account, '0012345678');
  assert.equal(transfer.amount, '150000');
  const link = new URL(scannedBankDeeplink(transfer, 'mb'));
  assert.equal(link.origin, 'https://dl.vietqr.io');
  assert.equal(link.searchParams.get('app'), 'mb');
  assert.equal(link.searchParams.get('ba'), '0012345678@vcb');
  assert.equal(link.searchParams.get('am'), '150000');
  assert.equal(link.searchParams.get('tn'), request.note);
  assert.equal(link.searchParams.get('url'), 'wolfarimobile://');
  assert.equal(payment.amount, '1000');
});

test('missing/invalid amounts and transfer content never become handoff links', () => {
  for (const value of ['', '0', '-1', '1.5', '1e5', '150.000', '10000000000000'])
    assert.throws(() => paymentTransfer(payment, value, 'Dinner'));
  for (const note of ['', ' ', 'Dinner\nInjected', 'x'.repeat(151)])
    assert.throws(() => paymentTransfer(payment, '150000', note));
  assert.throws(() => scannedBankDeeplink(paymentTransfer({ ...payment, bankBin: '999999' }, '150000', 'Dinner'), 'mb'));
  assert.throws(() => scannedBankDeeplink(paymentTransfer(payment, '150000', 'Dinner'), 'vcb'));
  assert.equal(sandboxAmount('1000'), '1000');
  assert.equal(sandboxAmount('50000000'), '50000000');
  for (const value of ['999', '50000001', '1500000000000']) assert.throws(() => sandboxAmount(value));
});

test('supported banks have compact recognizable labels while internal bank codes and BINs remain stable', () => {
  for (const bank of VIETQR_BANKS) {
    assert.notEqual(bankDisplayName(bank.code), bank.code);
    assert.equal(bankDisplayName(bank.code), bankDisplayName(bank.bin));
    assert.ok(bankDisplayName(bank.code).length <= 40, 'Bank labels fit a mobile choice row.');
  }
  assert.equal(bankDisplayName('VCB'), 'Vietcombank · Ngoại thương');
  assert.equal(bankDisplayName('ICB'), 'VietinBank · Công thương');
  assert.match(bankDisplayName('999999'), /chưa nhận diện/);
});

test('QR sandbox sends only the reviewed demo amount/note and a stable key, never the scanned account or fund commands', async () => {
  const calls = [];
  const api = createPaymentsApi({ request: async (path, options) => { calls.push({ path, options }); return checkout; } });
  assert.deepEqual(await api.sandboxCheckout('trip', request), checkout);
  assert.equal(calls[0].path, '/trips/trip/qr-payments/momo-sandbox');
  assert.deepEqual(calls[0].options.body, request);
  assert.equal(calls[0].options.headers['Idempotency-Key'], request.request_id);
  assert.equal(JSON.stringify(calls).includes(payment.account), false);
  for (const change of [{ amount: '1000' }, { request_id: 'other' }, { environment: 'LIVE' }, { payment_url: 'https://payment.momo.vn/pay' }, { payment_url: 'momo://pay' }, { order_id: 'unknown' }]) {
    const unsafe = createPaymentsApi({ request: async () => ({ ...checkout, ...change }) });
    await assert.rejects(unsafe.sandboxCheckout('trip', request));
  }
});
