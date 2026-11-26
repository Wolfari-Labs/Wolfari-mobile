import assert from 'node:assert/strict';
import { test } from 'node:test';
import { amountLabel, BANK_APPS, bankApp, initials, pressKey, quickExpense, shortBankName } from '../src/features/payments/model/quick-transfer.ts';
import { scannedBankDeeplink } from '../src/features/payments/model/payment-transfer.ts';

test('the keypad builds a plain VND amount', () => {
  let amount = '';
  for (const key of ['0', '2', '000', '0']) amount = pressKey(amount, key);
  assert.equal(amount, '20000');
  assert.equal(amountLabel(amount), '20.000đ');
  assert.equal(pressKey(amount, 'back'), '2000');
  assert.equal(pressKey('99999999999', '1'), '99999999999', 'at most 11 digits');
  assert.equal(amountLabel(''), '0đ');
});

test('bank apps: five fill the transfer in, the rest only open', () => {
  assert.deepEqual(BANK_APPS.filter(app => app.autofill).map(app => app.id), ['mb', 'icb', 'bidv', 'acb', 'ocb']);
  assert.equal(bankApp('vcb')?.autofill, false);
  assert.equal(shortBankName(bankApp('icb').name), 'VietinBank');
  const transfer = { bankBin: '970407', account: '2099130298', recipientLabel: 'LE THAI BINH', amount: '20000', note: 'Ca phe' };
  const filled = new URL(scannedBankDeeplink(transfer, 'icb'));
  assert.equal(filled.hostname, 'dl.vietqr.io');
  assert.deepEqual([filled.searchParams.get('app'), filled.searchParams.get('am'), filled.searchParams.get('tn')], ['icb', '20000', 'Ca phe']);
  assert.equal(new URL(scannedBankDeeplink(transfer, 'vcb')).searchParams.get('app'), 'vcb');
  assert.throws(() => scannedBankDeeplink(transfer, 'unknown'));
});

test('the expense keeps where the money went and stays honest about the recipient', () => {
  const transfer = { bankBin: '970407', account: '2099130298', recipientLabel: 'LE THAI BINH', amount: '20000', note: 'Ca phe sang' };
  const input = quickExpense(transfer, 'Ăn uống', bankApp('icb'), '2026-11-25T03:13:00.000Z');
  assert.equal(input.title, 'Ca phe sang');
  assert.equal(input.amount, '20000');
  assert.equal(input.category, 'Ăn uống');
  assert.equal(input.payment_method, 'BANK_TRANSFER');
  assert.match(input.description, /Người nhận: LE THAI BINH\nTài khoản: 2099130298 · Techcombank\nChuyển qua: VietinBank/);
  assert.equal(quickExpense({ ...transfer, note: ' ', recipientLabel: undefined }, '', bankApp('vcb'), 'x').title, 'Chuyển khoản');
  assert.equal(initials('Lê Thái Bình'), 'LB');
  assert.equal(initials(''), '?');
});

test('the fallback VietQR round-trips through the reader with amount and an ASCII note', async () => {
  const { parsePaymentQr, vietQrPayload, asciiNote } = await import('../src/features/payments/model/payment-qr.ts');
  const payload = vietQrPayload({ bankBin: '970407', account: '19076329548012', amount: '20000', note: 'Cà phê sáng đủ nhóm' });
  const read = parsePaymentQr(payload);
  assert.equal(read.ok, true);
  assert.deepEqual([read.payment.bankBin, read.payment.account, read.payment.amount, read.payment.note], ['970407', '19076329548012', '20000', 'Ca phe sang du nhom']);
  assert.equal(asciiNote('Đi Đà Lạt'), 'Di Da Lat');
  assert.throws(() => vietQrPayload({ bankBin: '970407', account: 'x y', amount: '1', note: '' }));
});
