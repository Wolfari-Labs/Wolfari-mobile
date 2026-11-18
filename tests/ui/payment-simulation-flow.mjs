import assert from 'node:assert/strict';
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { makeQr } from '../fixtures/payment-qr.mjs';
const appUrl = process.env.WOLFARI_PREVIEW_URL ?? 'http://localhost:8082';
let executablePath;
for (const candidate of [process.env.WOLFARI_BROWSER_PATH, chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean)) {
  if (await access(candidate).then(() => true, () => false)) { executablePath = candidate; break; }
}
assert.ok(executablePath);
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const apiCalls = [], errors = [], externalPages = [];
await context.route('**/api/v1/**', route => {
  apiCalls.push(new URL(route.request().url()).pathname);
  return route.fulfill({ status: 401, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': appUrl, 'Access-Control-Allow-Credentials': 'true' }, body: JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }) });
});
const page = await context.newPage();
context.on('page', next => { if (next !== page) externalPages.push(next); });
page.setDefaultTimeout(20_000); page.setDefaultNavigationTimeout(120_000);
page.on('pageerror', error => errors.push(error.message));
const button = name => page.getByRole('button', { name, exact: true });
const field = name => page.getByLabel(name, { exact: true });
const text = value => page.getByText(value, { exact: true }).filter({ visible: true });
const output = path.resolve('.cache/visual/payment-simulation'); await mkdir(output, { recursive: true });
async function screenshot(name) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(output, name + '.png') });
}
try {
  await page.goto(appUrl + '/demo-trip/fund', { waitUntil: 'networkidle' });
  await button('Góp quỹ mô phỏng').click();
  await field('Số tiền góp mô phỏng (VND)').fill('0');
  await button('Tiếp tục góp quỹ mô phỏng').click();
  await text('Nhập số tiền VND nguyên lớn hơn 0, không có dấu phân cách.').waitFor();
  await field('Số tiền góp mô phỏng (VND)').fill('100000');
  await button('Tiếp tục góp quỹ mô phỏng').click();
  await button('Thử tình huống thất bại').click();
  await text('Thanh toán mô phỏng thất bại').waitFor();
  await button('Thử lại mô phỏng').click();
  await button('Xác nhận thanh toán mô phỏng').click();
  await text('Thanh toán mô phỏng thành công').waitFor();
  assert.equal(await button('Xác nhận thanh toán mô phỏng').count(), 0);
  await screenshot('01-contribution-success');
  await button('Đóng').click();
  await text('3.400.000 ₫').waitFor();
  await page.getByRole('tab', { name: 'Tất cả', exact: true }).click();
  await text('Góp quỹ qua ví mô phỏng').waitFor();
  assert.equal(await text('Góp quỹ qua ví mô phỏng').count(), 1);
  await button('Quét QR thanh toán mô phỏng').click();
  await button('Dán nội dung QR').click();
  await field('Nội dung QR').fill(makeQr({ bin: '970436', account: '0012345678', amount: '150000', note: 'Bua toi nhom' }));
  await button('Đọc thông tin QR').click();
  await field('Số tiền chuyển (VND)').waitFor();
  assert.equal(await field('Số tiền chuyển (VND)').inputValue(), '150000');
  assert.equal(await field('Nội dung chuyển khoản').inputValue(), 'Bua toi nhom');
  await button('Chọn ứng dụng thanh toán').click();
  assert.equal(await page.getByRole('radio', { name: 'MoMo Test', exact: true }).count(), 0);
  assert.equal(await button('Mở ứng dụng ngân hàng').count(), 0);
  await button('Xác nhận thanh toán mô phỏng').click();
  await text('Thanh toán mô phỏng thành công').waitFor();
  await screenshot('02-qr-success');
  await button('Đóng').click();
  await text('3.250.000 ₫').waitFor();
  await text('Thanh toán QR mô phỏng').waitFor();
  // The sample balance protects reserved refunds, and failure leaves no partial expense.
  await button('Quét QR thanh toán mô phỏng').click(); await button('Dán nội dung QR').click();
  await field('Nội dung QR').fill(makeQr({ bin: '970436', account: '0012345678', amount: '99999999', note: 'Thu vuot so du' }));
  await button('Đọc thông tin QR').click(); await button('Chọn ứng dụng thanh toán').click();
  await button('Xác nhận thanh toán mô phỏng').click();
  await text('Số dư khả dụng không đủ. Quỹ mẫu đã giữ riêng khoản hoàn đang chờ.').waitFor();
  await button('Đóng').click();
  assert.equal(await text('Thanh toán QR mô phỏng').count(), 1);
  await page.setViewportSize({ width: 320, height: 740 }); await screenshot('03-ledger-small');
  await page.reload({ waitUntil: 'networkidle' }); await text('3.300.000 ₫').waitFor();
  assert.deepEqual(apiCalls.filter(url => !url.startsWith('/api/v1/auth/')), []);
  assert.deepEqual(externalPages, []); assert.deepEqual(errors, []);
  console.log('PASS payment simulation: contribution, failure/retry, QR autofill, expense, balances/history, no duplicate, insufficient funds, anonymous reset, 320px, no Finance API or external wallet.');
} catch (error) {
  await screenshot('failure').catch(() => {});
  console.error((await page.locator('body').innerText()).slice(-1800)); throw error;
} finally { await browser.close(); }
