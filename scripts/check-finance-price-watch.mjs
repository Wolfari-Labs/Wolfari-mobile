// Opt-in acceptance against a LOCAL demo. Creates a dedicated synthetic Trip;
// never prints passwords, refresh/access tokens, invitation links or bank data.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createApiClient } from '../src/shared/api/api-client.ts';
import { createFinanceApi } from '../src/features/finance/api.ts';
import { createPriceWatchApi } from '../src/features/price-watch/api.ts';
const base = process.env.WOLFARI_API_URL ?? 'http://127.0.0.1:13000/api/v1';
assert.equal(
  process.env.WOLFARI_MOBILE_ACCEPTANCE,
  '1',
  'Set WOLFARI_MOBILE_ACCEPTANCE=1 to authorize synthetic local demo writes.',
);
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Local demo only');
assert.ok(process.env.WOLFARI_DEMO_ACCOUNTS, 'Set path to the private backend demo seed.json');
const { accounts } = JSON.parse(await readFile(process.env.WOLFARI_DEMO_ACCOUNTS, 'utf8'));
const client = createApiClient({ getBaseUrl: () => base });
const actors = {};
for (const name of ['owner', 'holder', 'member']) {
  const credentials = accounts[name];
  const session = await client.request('/auth/login', {
    method: 'POST',
    body: { email: credentials.email, password: credentials.password },
  });
  const authed = {
    request: (path, options) =>
      client.request(path, { ...options, accessToken: session.access_token }),
    requestWithMeta: (path, options) =>
      client.requestWithMeta(path, { ...options, accessToken: session.access_token }),
  };
  actors[name] = {
    id: session.profile.id,
    client: authed,
    finance: createFinanceApi(authed),
    watch: createPriceWatchApi(authed),
  };
}
const { owner, holder, member } = actors;
const write = async (actor, path, body, method = 'POST', key = randomUUID()) => {
  const intent = {
    key,
    path,
    body,
    method,
    label: 'Local mobile acceptance',
    kind: 'finance',
    createdAt: new Date().toISOString(),
    attempted: true,
  };
  let result = await actor.finance.write(intent);
  if (result.operation_id && !result.accepted && result.state !== 'SUCCEEDED') {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const op = await actor.finance.operation(key);
      if (['SUCCEEDED', 'FAILED', 'NEEDS_REVIEW'].includes(op.state)) {
        assert.equal(op.state, 'SUCCEEDED');
        result = await actor.finance.write(intent);
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    assert.ok(!result.operation_id || result.state === 'SUCCEEDED', 'Operation still pending');
  }
  return result;
};
const start = new Date(Date.now() + 30 * 86400000),
  end = new Date(start.getTime() + 2 * 86400000),
  tripKey = randomUUID();
const trip = await owner.client.request('/trips', {
  method: 'POST',
  headers: { 'Idempotency-Key': tripKey },
  body: {
    client_request_id: tripKey,
    name: `Mobile acceptance ${new Date().toISOString()}`,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    timezone: 'Asia/Ho_Chi_Minh',
  },
});
for (const person of [holder, member]) {
  const current = await owner.client.request(`/trips/${trip.id}`);
  const result = await owner.client.request(`/trips/${trip.id}/invitations`, {
    method: 'POST',
    headers: { 'Idempotency-Key': randomUUID() },
    body: { invitation_type: 'LINK', expected_membership_revision: current.membership_revision },
  });
  const url = new URL(result.one_time_link),
    token = new URLSearchParams(url.hash.slice(1)).get('token');
  assert.ok(token);
  await person.client.request('/invitations/accept', {
    method: 'POST',
    headers: { 'Idempotency-Key': randomUUID() },
    body: { token },
  });
}
let fund = await write(owner, `/trips/${trip.id}/fund`, {
  holder_user_id: holder.id,
  currency: 'VND',
  budget_amount: '1000000',
  destination: {
    destination_type: 'VIETQR',
    bank_code: 'VCB',
    account_number: '0011001234567',
    account_name: 'WOLFARI TEST ONLY',
    active: true,
    is_default: true,
  },
});
const fresh = async () => {
  fund = await owner.finance.fund(trip.id);
  return fund;
};
const destination = (await owner.finance.destinations(fund.id))[0];
await write(holder, `/funds/${fund.id}/destinations/${destination.id}/confirm`, {
  expected_version: destination.version,
  expected_finance_version: fund.finance_version,
});
await fresh();
await write(owner, `/funds/${fund.id}/contribution-requests`, {
  title: 'Mobile API 200000 + 300000',
  contributions: [
    { member_user_id: member.id, amount: '200000', destination_id: destination.id },
    { member_user_id: owner.id, amount: '300000', destination_id: destination.id },
  ],
  expected_finance_version: fund.finance_version,
});
const rows = async () => (await owner.finance.list(fund.id, 'contributions')).items;
const versions = async (c) => {
  await fresh();
  const row = (await rows()).find((v) => v.id === c.id);
  return { expected_version: row.version, expected_finance_version: fund.finance_version };
};
const contributions = await rows(),
  c1 = contributions.find((c) => c.member_user_id === member.id),
  c2 = contributions.find((c) => c.member_user_id === owner.id);
assert.equal((await member.finance.instruction(c1.id)).amount, '200000');
await write(member, `/contributions/${c1.id}/report-transfer`, await versions(c1));
assert.equal((await fresh()).current_balance, '0');
await assert.rejects(
  write(owner, `/contributions/${c1.id}/confirm-received`, await versions(c1)),
  (e) => e.status === 403,
);
await write(holder, `/contributions/${c1.id}/reject-transfer`, {
  ...(await versions(c1)),
  reason: 'TEST chưa thấy chuyển khoản',
});
await write(member, `/contributions/${c1.id}/report-transfer`, await versions(c1));
const frozen = await versions(c1),
  key = randomUUID();
await write(holder, `/contributions/${c1.id}/confirm-received`, frozen, 'POST', key);
// Replay the original operation after the server committed, using the mobile API factory.
await write(holder, `/contributions/${c1.id}/confirm-received`, frozen, 'POST', key);
assert.equal((await holder.finance.list(fund.id, 'transactions')).items.length, 1);
await write(owner, `/contributions/${c2.id}/report-transfer`, await versions(c2));
await write(holder, `/contributions/${c2.id}/confirm-received`, await versions(c2));
assert.equal((await fresh()).current_balance, '500000');
assert.equal((await owner.finance.list(fund.id, 'transactions')).items.length, 2);
console.log(
  'PASS live mobile API: report/reject/re-report, Holder authorization, exact-key replay, 500000 VND and 2 IN entries.',
);
let expense = await write(member, `/funds/${fund.id}/expenses`, {
  title: 'Mobile test expense',
  amount: '100000',
  expected_finance_version: fund.finance_version,
});
await fresh();
expense = await write(member, `/expenses/${expense.id}/submit`, {
  expected_version: expense.version,
  expected_finance_version: fund.finance_version,
});
await fresh();
expense = await write(holder, `/expenses/${expense.id}/confirm`, {
  paid_at: new Date().toISOString(),
  payment_method: 'CASH',
  expected_version: expense.version,
  expected_finance_version: fund.finance_version,
});
assert.equal((await fresh()).current_balance, '400000');
await write(holder, `/expenses/${expense.id}/reverse`, {
  reason: 'TEST reverse expense',
  expected_version: expense.version,
  expected_finance_version: fund.finance_version,
});
assert.equal((await fresh()).current_balance, '500000');
const note = await write(member, `/funds/${fund.id}/notes`, {
  description: 'Mobile test outside fund',
  amount: '20000',
  payer_user_id: member.id,
  expected_finance_version: fund.finance_version,
});
assert.equal((await fresh()).current_balance, '500000');
await write(
  member,
  `/notes/${note.id}`,
  { expected_version: note.version, expected_finance_version: fund.finance_version },
  'DELETE',
);
await fresh();
let refund = await write(owner, `/funds/${fund.id}/refunds`, {
  member_user_id: member.id,
  amount: '50000',
  reason: 'TEST mobile refund',
  expected_finance_version: fund.finance_version,
});
await fresh();
assert.equal(fund.reserved_refund, '50000');
refund = await write(holder, `/refunds/${refund.id}/report-paid`, {
  expected_version: refund.version,
  expected_finance_version: fund.finance_version,
});
await fresh();
await write(member, `/refunds/${refund.id}/confirm-received`, {
  expected_version: refund.version,
  expected_finance_version: fund.finance_version,
});
await fresh();
assert.equal(fund.current_balance, '450000');
assert.equal(fund.reserved_refund, '0');
console.log(
  'PASS live mobile API: expense submit/confirm/reversal, outside-fund note/delete, refund reserve/report/receive.',
);
const input = {
  provider: 'MOCK_FLIGHT',
  origin: 'SGN',
  destination: 'DAD',
  departure_date: start.toISOString().slice(0, 10),
  departure_at: start.toISOString(),
  return_date: null,
  journey_type: 'ONE_WAY',
  passengers: { adults: 1, children: 0, infants: 0 },
  cabin_class: 'ECONOMY',
  currency: 'VND',
  threshold_price: '2000000',
};
let watch = await write(member, `/trips/${trip.id}/price-watches`, input);
const second = await write(owner, `/trips/${trip.id}/price-watches`, {
  ...input,
  threshold_price: '3000000',
});
assert.equal(watch.query_group_id, second.query_group_id);
assert.notEqual(watch.threshold_price, second.threshold_price);
await assert.rejects(
  write(holder, `/price-watches/${watch.id}/pause`, { expected_version: watch.version }),
  (e) => [403, 404].includes(e.status),
);
watch = await write(
  member,
  `/price-watches/${watch.id}`,
  { threshold_price: '1800000', expected_version: watch.version },
  'PATCH',
);
await assert.rejects(
  write(member, `/price-watches/${watch.id}/pause`, { expected_version: watch.version - 1 }),
  (e) => e.status === 409,
);
watch = await write(member, `/price-watches/${watch.id}/pause`, {
  expected_version: watch.version,
});
watch = await write(member, `/price-watches/${watch.id}/resume`, {
  expected_version: watch.version,
});
const observations = await member.watch.observations(watch.id);
assert.equal(typeof observations.stale, 'boolean');
watch = await write(
  member,
  `/price-watches/${watch.id}`,
  { expected_version: watch.version },
  'DELETE',
);
assert.equal(watch.status, 'STOPPED');
assert.ok((await member.watch.list(trip.id)).items.some((w) => w.id === watch.id));
console.log(
  'PASS live mobile API: query grouping, separate thresholds, owner isolation, stale version, edit/pause/resume/canonical DELETE and observation metadata.',
);
await fresh();
await assert.rejects(
  write(owner, `/funds/${fund.id}/closures`, { expected_finance_version: fund.finance_version }),
  (e) => e.status === 409,
);
let closingExpense = await write(holder, `/funds/${fund.id}/expenses`, {
  title: 'TEST settle remaining fund for closure',
  amount: fund.current_balance,
  expected_finance_version: fund.finance_version,
});
await fresh();
closingExpense = await write(holder, `/expenses/${closingExpense.id}/submit`, {
  expected_version: closingExpense.version,
  expected_finance_version: fund.finance_version,
});
await fresh();
await write(holder, `/expenses/${closingExpense.id}/confirm`, {
  paid_at: new Date().toISOString(),
  payment_method: 'CASH',
  expected_version: closingExpense.version,
  expected_finance_version: fund.finance_version,
});
await fresh();
assert.equal(fund.current_balance, '0');
const closure = await write(owner, `/funds/${fund.id}/closures`, {
  expected_finance_version: fund.finance_version,
});
assert.equal(closure.status, 'PENDING_CONFIRMATIONS');
const closurePage = await member.finance.list(fund.id, 'closures');
assert.equal(closurePage.items[0].snapshot_hash, closure.snapshot_hash);
for (const actor of [owner, holder, member])
  await write(actor, `/closures/${closure.id}/confirm`, { snapshot_hash: closure.snapshot_hash });
assert.equal((await fresh()).status, 'CLOSED');
console.log('PASS live mobile API: exact closure snapshot, three confirmations and CLOSED fund.');
let history = 'not-executed';
try {
  await member.finance.list(fund.id, 'history');
  history = 'passed';
  console.log('PASS live mobile API: API162 history');
} catch (e) {
  if (e.status !== 404) throw e;
  history = 'unavailable-in-running-backend';
  console.log(
    'LIMITATION: API162 unavailable in running backend branch; update backend to main for history.',
  );
}
await mkdir('.cache/acceptance', { recursive: true });
await writeFile(
  '.cache/acceptance/finance-price-watch.json',
  JSON.stringify(
    {
      executedAt: new Date().toISOString(),
      gateway: base,
      tripId: trip.id,
      fundId: fund.id,
      contributionCheckpoint: { balance: '500000', entries: 2 },
      finalBalance: fund.current_balance,
      finalStatus: fund.status,
      history,
      physicalIOS: 'not-executed',
      physicalAndroid: 'not-executed',
    },
    null,
    2,
  ),
);
