import assert from 'node:assert/strict';
import { test } from 'node:test';
import { financeCommands } from '../src/features/finance/api.ts';
import {
  appLinkToken,
  PAYOS_ATTEMPT_TITLE,
  payosCheckoutUrl,
  payosReturnPage,
  payosStatusLabel,
} from '../src/features/finance/payos.ts';

test('payOS return page carries the app link as the unpadded base64url token the Gateway decodes', () => {
  for (const link of ['exp://192.168.1.5:8081/--/payment-return', 'wolfarimobile://payment-return', 'exp://a', 'exp://ab'])
    assert.equal(appLinkToken(link), Buffer.from(link, 'utf8').toString('base64url'));
  assert.equal(
    payosReturnPage('http://192.168.1.5:13000/api/v1/', 'exp://192.168.1.5:8081/--/payment-return'),
    `http://192.168.1.5:13000/api/v1/payments/payos/return/${Buffer.from('exp://192.168.1.5:8081/--/payment-return').toString('base64url')}`,
  );
  assert.throws(() => appLinkToken('exp://ứng-dụng'));
});

test('only the payOS hosted page is opened', () => {
  assert.equal(payosCheckoutUrl('https://pay.payos.vn/web/abc123'), 'https://pay.payos.vn/web/abc123');
  for (const bad of ['http://pay.payos.vn/web/x', 'https://evil.example/pay', 'https://u:p@pay.payos.vn/x', 'not a url'])
    assert.throws(() => payosCheckoutUrl(bad));
});

test('payOS command keeps the snapshot versions and asks for the return page', () => {
  const fund = { id: 'f1', finance_version: 9 };
  const row = { id: 'c1', version: 2 };
  const command = financeCommands.payosAttempt(fund, row, 'http://gw/api/v1/payments/payos/return/abc');
  assert.equal(command.title, PAYOS_ATTEMPT_TITLE);
  assert.equal(command.path, '/contributions/c1/payment-attempts');
  assert.deepEqual(command.body, {
    provider: 'PAYOS',
    return_url: 'http://gw/api/v1/payments/payos/return/abc',
    expected_finance_version: 9,
    expected_version: 2,
  });
});

test('payOS status labels never claim money arrived before the server confirms', () => {
  assert.equal(payosStatusLabel('SUCCEEDED', false), 'Quỹ đã nhận tiền');
  assert.equal(payosStatusLabel('PENDING', true), 'Đang đối chiếu với ngân hàng');
  assert.equal(payosStatusLabel('PENDING', false), 'Chờ bạn thanh toán');
  assert.equal(payosStatusLabel('WHATEVER', false), 'Đang đối chiếu thanh toán');
});
