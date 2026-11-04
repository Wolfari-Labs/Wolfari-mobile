import assert from 'node:assert/strict';
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
const appUrl = process.env.WOLFARI_PREVIEW_URL ?? 'http://localhost:8082';
let executablePath;
for (const candidate of [
  process.env.WOLFARI_BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean))
  if (
    await access(candidate).then(
      () => true,
      () => false,
    )
  ) {
    executablePath = candidate;
    break;
  }
assert.ok(executablePath);
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
});
const uid = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tripId = uid(1),
  fundId = uid(2),
  ownerId = uid(3),
  holderId = uid(4),
  memberId = uid(5),
  destinationId = uid(6);
let actor = ownerId,
  loseConfirmation = true,
  stale = true;
const calls = [],
  errors = [],
  receipts = new Map();
const fund = {
  id: fundId,
  trip_id: tripId,
  holder_user_id: holderId,
  currency: 'VND',
  budget_amount: '1000000',
  current_balance: '0',
  reserved_refund: '0',
  available_balance: '0',
  status: 'OPEN',
  finance_version: 1,
  closed_at: null,
};
const contributions = [200000, 300000].map((amount, i) => ({
  id: uid(10 + i),
  fund_id: fundId,
  request_id: uid(7),
  member_user_id: memberId,
  amount: String(amount),
  status: 'PENDING',
  self_contribution: false,
  version: 1,
  finance_version: 1,
  rejected_reason: null,
}));
const ledger = [],
  watches = [],
  expenses = [],
  notes = [],
  refunds = [],
  closures = [];
const date = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
function trip() {
  return {
    id: tripId,
    name: 'Finance & Price Watch',
    description: null,
    start_at: `${date}T00:00:00Z`,
    end_at: `${date}T23:59:00Z`,
    timezone: 'Asia/Ho_Chi_Minh',
    lifecycle: 'UPCOMING',
    plan_version: 1,
    membership_revision: 1,
    export_revision: 1,
    current_membership: {
      id: uid(50),
      trip_id: tripId,
      user_id: actor,
      role: actor === ownerId ? 'OWNER' : 'MEMBER',
      left_at: null,
    },
    permissions: { can_read: true, can_update: actor === ownerId },
  };
}
await context.route('**/api/v1/**', async (route) => {
  const req = route.request(),
    url = new URL(req.url()),
    p = url.pathname.replace('/api/v1', ''),
    method = req.method();
  const headers = {
    'Access-Control-Allow-Origin': appUrl,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers':
      'Content-Type, X-Client-Type, Authorization, X-CSRF-Token, Idempotency-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  };
  const ok = (data, meta = {}) =>
    route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({ data, meta }),
    });
  const fail = (status, code) =>
    route.fulfill({
      status,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code, message: code, retryable: false }, meta: {} }),
    });
  if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
  const body = req.postData() ? req.postDataJSON() : undefined,
    key = req.headers()['idempotency-key'];
  calls.push({ p, method, body, key, actor });
  const profile = {
    id: actor,
    email: 'test@example.test',
    full_name: actor === ownerId ? 'Owner' : actor === holderId ? 'Holder' : 'Member',
    avatar: null,
    system_role: 'USER',
    status: 'ACTIVE',
    email_verified_at: null,
    version: 1,
  };
  if (p === '/auth/csrf') return ok({ csrf_token: 'fixture-csrf' });
  if (['/auth/refresh', '/auth/login'].includes(p))
    return ok({ access_token: 'fixture-access', token_type: 'Bearer', expires_in: 900, profile });
  if (p === '/me') return ok(profile);
  if (p === '/trips') return ok({ items: [trip()], next_cursor: null });
  if (p === `/trips/${tripId}`) return ok(trip());
  if (p.endsWith('/members'))
    return ok({
      items: [ownerId, holderId, memberId].map((user_id, i) => ({
        id: uid(50 + i),
        user_id,
        trip_id: tripId,
        role: i === 0 ? 'OWNER' : 'MEMBER',
        left_at: null,
      })),
      next_cursor: null,
    });
  if (p.endsWith('/fund')) return ok(fund);
  if (p.endsWith('/destinations'))
    return ok([
      {
        id: destinationId,
        fund_id: fundId,
        destination_type: 'VIETQR',
        active: true,
        is_default: true,
        version: 1,
        confirmed_by_holder_at: `${date}T00:00:00Z`,
        ...(actor !== memberId
          ? { bank_code: 'VCB', account_number: 'TEST123', account_name: 'TEST HOLDER' }
          : {}),
      },
    ]);
  if (key && receipts.has(key)) return ok(receipts.get(key));
  const c = contributions.find((c) => p.startsWith(`/contributions/${c.id}/`));
  if (c && method === 'POST') {
    assert.equal(body.expected_version, c.version);
    assert.equal(body.expected_finance_version, fund.finance_version);
    if (p.endsWith('report-transfer')) {
      assert.equal(actor, memberId);
      assert.equal(c.status, 'PENDING');
      c.status = 'TRANSFER_REPORTED';
    } else if (p.endsWith('reject-transfer')) {
      assert.equal(actor, holderId);
      assert.equal(c.status, 'TRANSFER_REPORTED');
      c.status = 'PENDING';
      c.rejected_reason = body.reason;
    } else if (p.endsWith('confirm-received')) {
      assert.equal(actor, holderId);
      assert.equal(c.status, 'TRANSFER_REPORTED');
      c.status = 'CONFIRMED';
      fund.current_balance = String(BigInt(fund.current_balance) + BigInt(c.amount));
      fund.available_balance = fund.current_balance;
      ledger.push({
        id: uid(100 + ledger.length),
        fund_id: fundId,
        sequence: String(ledger.length + 1),
        direction: 'IN',
        transaction_type: 'CONTRIBUTION',
        amount: c.amount,
        balance_after: fund.current_balance,
        created_at: new Date().toISOString(),
        reason: null,
      });
    } else return fail(400, 'UNEXPECTED_ACTION');
    c.version++;
    c.finance_version = ++fund.finance_version;
    receipts.set(key, structuredClone(c));
    if (c.status === 'CONFIRMED' && loseConfirmation) {
      loseConfirmation = false;
      return route.abort('failed');
    }
    return ok(c);
  }
  if (p.endsWith('/observations'))
    return ok(
      [
        {
          id: uid(300),
          price: '1800000',
          currency: 'VND',
          provider: 'MOCK_FLIGHT',
          observed_at: '2026-11-01T00:00:00Z',
          fetched_at: '2026-11-01T00:00:00Z',
        },
      ],
      { next_cursor: null, stale, last_error: stale ? 'PROVIDER_TIMEOUT' : null },
    );
  if (p.endsWith('/price-watches')) {
    if (method === 'GET')
      return ok(
        watches.filter((w) => w.user_id === actor),
        { next_cursor: null },
      );
    assert.equal(body.provider, 'MOCK_FLIGHT');
    assert.equal(typeof body.threshold_price, 'string');
    const { threshold_price, ...query } = body;
    const w = {
      id: uid(200 + watches.length),
      trip_id: tripId,
      user_id: actor,
      query_group_id: uid(201),
      threshold_price,
      status: 'ACTIVE',
      status_reason: null,
      version: 1,
      expires_at: body.departure_at,
      last_alert_price: null,
      last_alert_at: null,
      normalized_query: { ...query, transport_type: 'FLIGHT' },
    };
    watches.push(w);
    receipts.set(key, structuredClone(w));
    return ok(w);
  }
  if (p.startsWith('/price-watches/')) {
    const w = watches.find((w) => p.includes(w.id));
    if (!w || actor !== w.user_id) return fail(404, 'RESOURCE_NOT_FOUND');
    assert.equal(body.expected_version, w.version);
    if (method === 'PATCH') {
      const { expected_version: _v, threshold_price, ...query } = body;
      w.normalized_query = { ...query, transport_type: 'FLIGHT' };
      w.threshold_price = threshold_price;
    } else w.status = method === 'DELETE' ? 'STOPPED' : p.endsWith('pause') ? 'PAUSED' : 'ACTIVE';
    w.version++;
    return ok(w);
  }
  const collection = p.split('/').at(-1),
    lists = {
      contributions,
      'contribution-requests': [],
      transactions: [...ledger].reverse(),
      expenses,
      refunds,
      notes,
      history: [],
      closures,
      'payment-exceptions': [],
    };
  if (p.startsWith(`/funds/${fundId}/`) && method === 'GET' && lists[collection])
    return ok({ items: lists[collection], next_cursor: null });
  if (p.endsWith('/expenses') && method === 'POST') {
    const e = {
      id: uid(400),
      fund_id: fundId,
      ...body,
      version: 1,
      finance_version: ++fund.finance_version,
      created_by_user_id: actor,
      status: 'DRAFT',
      receipt_available: false,
    };
    expenses.push(e);
    return ok(e);
  }
  if (p.endsWith('/notes') && method === 'POST') {
    const n = {
      id: uid(401),
      fund_id: fundId,
      ...body,
      version: 1,
      finance_version: ++fund.finance_version,
      created_by_user_id: actor,
    };
    notes.push(n);
    return ok(n);
  }
  return fail(404, 'RESOURCE_NOT_FOUND');
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(120000);
page.on('pageerror', (error) => errors.push(error.message));
const button = (name) => page.getByRole('button', { name, exact: true }),
  field = (name) => page.getByLabel(name, { exact: true });
const tab = (name) => page.getByRole('tab', { name, exact: true });
const goto = async (feature = 'fund') => {
  await page.goto(`${appUrl}/trip/${tripId}/${feature}`, { waitUntil: 'networkidle' });
  await page.getByText('Finance & Price Watch', { exact: true }).waitFor();
};
const save = async () => {
  await button('Xác nhận lưu').click();
  await button('Xác nhận lưu').waitFor({ state: 'hidden' });
};
const shots = path.resolve('.cache/visual/finance-price-watch');
await mkdir(shots, { recursive: true });
try {
  await goto();
  await page.getByText('Số dư: 0 ₫', { exact: true }).waitFor();
  assert.equal(await button('Xác nhận đã nhận đủ').count(), 0, 'Owner does not gain Holder rights');
  actor = memberId;
  await goto();
  await button('Báo đã chuyển').first().click();
  await save();
  assert.equal(fund.current_balance, '0');
  assert.equal(ledger.length, 0);
  actor = holderId;
  await goto();
  await button('Từ chối báo chuyển').click();
  await field('Lý do').fill('Chưa thấy tiền thử nghiệm');
  await save();
  assert.equal(contributions[0].status, 'PENDING');
  assert.equal(ledger.length, 0);
  actor = memberId;
  await goto();
  await button('Báo đã chuyển').first().click();
  await save();
  await button('Báo đã chuyển').click();
  await save();
  actor = holderId;
  await goto();
  await button('Xác nhận đã nhận đủ').first().click();
  await save();
  await page.getByText('Yêu cầu chưa có kết quả cuối', { exact: true }).waitFor();
  assert.equal(fund.current_balance, '200000');
  assert.equal(ledger.length, 1);
  await page.reload({ waitUntil: 'networkidle' });
  await button('Gửi lại yêu cầu đã lưu').click();
  await page
    .getByText('Yêu cầu chưa có kết quả cuối', { exact: true })
    .waitFor({ state: 'hidden' });
  await button('Xác nhận đã nhận đủ').click();
  await save();
  await page.getByText('Số dư: 500.000 ₫', { exact: true }).waitFor();
  assert.equal(ledger.length, 2);
  assert.equal(fund.current_balance, '500000');
  const confirms = calls.filter((c) => c.p.endsWith('confirm-received'));
  assert.equal(confirms[0].key, confirms[1].key);
  assert.deepEqual(confirms[0].body, confirms[1].body);
  await tab('Sổ quỹ').click();
  await page.getByText('#2 · Thu 300.000 ₫', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(shots, 'fund-ledger.png'), fullPage: true });
  await tab('Khoản chi').click();
  await button('Đề xuất khoản chi').click();
  await field('Nội dung').fill('Bữa trưa thử nghiệm');
  await field('Số tiền (VND)').fill('100000');
  await save();
  await page.getByText('Bữa trưa thử nghiệm', { exact: true }).waitFor();
  assert.equal(fund.current_balance, '500000', 'Draft expense has no ledger effect');
  await tab('Ngoài quỹ').click();
  await button('Thêm khoản ngoài quỹ').click();
  await field('Mô tả').fill('Tự trả vé xe');
  await field('Số tiền (VND; tùy chọn)').fill('50000');
  await save();
  assert.equal(fund.current_balance, '500000');
  actor = memberId;
  await goto('price-watch');
  await button('Tạo theo dõi giá').click();
  await field('Mã sân bay đi').fill('sgn');
  await field('Mã sân bay đến').fill('dad');
  await field('Ngày đi (UTC)').fill(date);
  await field('Ngưỡng giá riêng (VND)').fill('2000000');
  await save();
  await page.getByText('SGN → DAD', { exact: true }).waitFor();
  await button('Xem lịch sử giá').click();
  await page.getByText(/Giá cũ · Nguồn giá/).waitFor();
  assert.equal(
    await page.getByText(/Dưới ngưỡng riêng/).count(),
    0,
    'Stale fare is not a fresh threshold hit',
  );
  await page.screenshot({ path: path.join(shots, 'price-stale.png'), fullPage: true });
  stale = false;
  await button('Làm mới lịch sử giá').click();
  await page.getByText(/Dưới ngưỡng riêng/).waitFor();
  await button('Sửa theo dõi giá').click();
  await field('Ngưỡng giá riêng (VND)').fill('1700000');
  await save();
  assert.equal(watches[0].threshold_price, '1700000');
  await button('Tạm dừng theo dõi').click();
  await save();
  assert.equal(watches[0].status, 'PAUSED');
  await button('Tiếp tục theo dõi').click();
  await save();
  assert.equal(watches[0].status, 'ACTIVE');
  await button('Dừng theo dõi').click();
  await save();
  assert.equal(watches[0].status, 'STOPPED');
  assert.equal(
    calls.filter((c) => c.method === 'DELETE' && c.p.startsWith('/price-watches/')).length,
    1,
  );
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log(
    'PASS mobile UI HTTP fixtures: role permissions; report/reject/re-report; lost-reply reload+same-key replay; 500000 VND/2 IN; expense/notes; watch create/edit/pause/resume/stop; stale history. Not physical iOS evidence.',
  );
} finally {
  await browser.close();
}
