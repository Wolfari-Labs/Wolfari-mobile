import assert from "node:assert/strict";
import test from "node:test";
import { createApiClient, ApiError } from "../src/shared/api/api-client.ts";
import { createFinanceApi, financeCommands as commands } from "../src/features/finance/api.ts";
import { parseMoney, money, financeActor, contributionActions, expenseActions, refundActions, eligibleDestinations, requiredText } from "../src/features/finance/model.ts";
import { createOperationController, operationCommitted, operationTerminal, operationMessage, receiptForStorage } from "../src/shared/operations/controller.ts";
import { enableForm, contributionRequestForm, expenseActionForm } from "../src/features/finance/forms.ts";

const tripId = "20000000-0000-4000-8000-000000000001";
const fundId = "50000000-0000-4000-8000-000000000001";
const key = "60000000-0000-4000-8000-000000000001";
const fund = { id: fundId, trip_id: tripId, finance_version: 17, holder_user_id: "holder", status: "OPEN" };
const row = { id: "row/id", version: 5 };
const destination = { destination_type: "VIETQR", active: true, is_default: true, bank_code: "VCB", account_number: "0012345678", account_name: "Test" };
const pendingOp = { operation_id: key, trip_id: tripId, state: "PENDING_RECOVERY" };
const done = { ...pendingOp, state: "SUCCEEDED", outcome: { status: "COMMITTED" } };
const owner = financeActor(fund, "owner", true, false);
const holder = financeActor(fund, "holder", false, false);
const member = financeActor(fund, "member", false, false);
const write = commands.budget(fund, "9007199254740993");

test("Finance preserves the full PostgreSQL int64 range without Number conversion", () => {
  assert.equal(parseMoney("09223372036854775807"), "9223372036854775807");
  assert.equal(money("9007199254740993"), "9.007.199.254.740.993 ₫");
  assert.equal(parseMoney("000", true), "0");
  assert.equal(money(null), "Chưa đặt");
  for (const input of ["", "0", "-1", "1.2", "1,000", "1e3", "Infinity", "9223372036854775808", "1\0"]) assert.throws(() => parseMoney(input));
  assert.throws(() => requiredText("x\0", "Reason"));
  assert.equal(requiredText("  abc ", "Reason"), "abc");
});
test("Setup/contribution forms reject missing active members and unconfirmed destinations", () => {
  const members = [{ user_id: "member", left_at: null }];
  assert.throws(() => enableForm(tripId, members, "member").build({ holder: "other" }));
  const form = contributionRequestForm(fund, members, [{ ...destination, id: "dest", confirmed_by_holder_at: "now" }], "member");
  assert.throws(() => form.build({ title: "Trip", amount: "100", members: "", destination: "dest" }));
  assert.throws(() => form.build({ title: "Trip", amount: "100", members: "member", destination: "other" }));
  const result = form.build({ title: "Trip", amount: "100", members: "member", destination: "dest" });
  assert.deepEqual(result.body.contributions, [{ member_user_id: "member", destination_id: "dest", amount: "100" }]);
});
test("Expense paid date uses trip timezone, rejects impossible dates and DST gaps", () => {
  const form = expenseActionForm(fund, { ...row, title: "Meal", amount: "10" }, "confirm", "Asia/Ho_Chi_Minh");
  const command = form.build({ date: "28/10/2026", time: "10:00", payment_method: "CASH" });
  assert.equal(command.body.paid_at, "2026-10-28T03:00:00.000Z");
  assert.throws(() => form.build({ date: "31/02/2026", time: "10:00", payment_method: "CASH" }));
  const dst = expenseActionForm(fund, { ...row, title: "Meal", amount: "10" }, "confirm", "America/New_York");
  assert.throws(() => dst.build({ date: "08/03/2026", time: "02:30", payment_method: "CASH" }));
});
test("Owner, Holder and Self are independent finance permissions", () => {
  const c = { member_user_id: "member", status: "PENDING" };
  assert.deepEqual(contributionActions(c, owner), ["amount", "waive", "cancel"]);
  assert.deepEqual(contributionActions(c, holder), []);
  assert.deepEqual(contributionActions(c, member), ["report-transfer"]);
  c.status = "TRANSFER_REPORTED";
  assert.deepEqual(contributionActions(c, owner), []);
  assert.deepEqual(contributionActions(c, holder), ["confirm-received", "reject-transfer"]);
  c.status = "CONFIRMED";
  assert.deepEqual(contributionActions(c, holder), ["reverse"]);
  c.status = "REVERSED";
  assert.deepEqual(contributionActions(c, holder), []);
});
test("Expense state/roles match Creator/Owner editing and Holder-only settlement", () => {
  const e = { created_by_user_id: "member", status: "DRAFT" };
  assert.deepEqual(expenseActions(e, owner), ["edit", "delete", "submit"]);
  assert.deepEqual(expenseActions(e, holder), []);
  e.status = "SUBMITTED";
  assert.deepEqual(expenseActions(e, owner), []);
  assert.deepEqual(expenseActions(e, member), ["withdraw"]);
  assert.deepEqual(expenseActions(e, holder), ["confirm", "reject"]);
  e.status = "CONFIRMED";
  assert.deepEqual(expenseActions(e, holder), ["reverse"]);
  for (const status of ["REJECTED", "REVERSED"]) assert.deepEqual(expenseActions({ ...e, status }, holder), []);
});
test("Refund requires nonreceipt before reported cancellation and consent before reversal", () => {
  const r = { status: "HOLDER_REPORTED", member_user_id: "member" };
  assert.deepEqual(refundActions(r, owner), []);
  assert.deepEqual(refundActions(r, member), ["confirm-received", "confirm-nonreceipt"]);
  assert.deepEqual(refundActions({ ...r, nonreceipt_confirmed_at: "now" }, owner), ["cancel"]);
  r.status = "CONFIRMED";
  assert.deepEqual(refundActions(r, holder), ["request-reversal"]);
  assert.deepEqual(refundActions(r, member), []);
  r.reversal_requested_at = "now";
  assert.deepEqual(refundActions(r, member), ["consent-reversal"]);
  assert.deepEqual(refundActions(r, holder), []);
  r.reversal_consented_at = "now";
  assert.deepEqual(refundActions(r, holder), ["reverse"]);
});
test("Archived/closing/closed funds expose no mutation actions", () => {
  for (const state of [financeActor({ ...fund, status: "CLOSED" }, "holder", true, false), financeActor({ ...fund, status: "CLOSING" }, "holder", true, false), financeActor(fund, "holder", true, true)]) {
    assert.deepEqual(contributionActions({ status: "CONFIRMED" }, state), []);
    assert.deepEqual(expenseActions({ status: "CONFIRMED" }, state), []);
    assert.deepEqual(refundActions({ status: "PENDING" }, state), []);
  }
  assert.deepEqual(eligibleDestinations([{ ...destination, id: "1", confirmed_by_holder_at: "now" }, { ...destination, id: "2" }, { ...destination, id: "3", active: false, confirmed_by_holder_at: "now" }, { ...destination, id: "4", destination_type: "MOMO_SANDBOX", confirmed_by_holder_at: "now" }]).map(x => x.id), ["1"]);
});
test("Fund/destination commands send exact strict bodies and both versions where required", () => {
  assert.deepEqual(commands.enable(tripId, "holder", destination).body, { holder_user_id: "holder", currency: "VND", destination });
  assert.deepEqual(commands.budget(fund, null).body, { budget_amount: null, expected_finance_version: 17 });
  assert.equal(commands.budget(fund, "0").method, "PATCH");
  assert.deepEqual(commands.destination(fund, { active: false }, row).body, { active: false, expected_finance_version: 17, expected_version: 5 });
  assert.deepEqual(commands.confirmDestination(fund, row).body, { expected_finance_version: 17, expected_version: 5 });
});
test("Contribution create/report/confirm/waive/cancel/reverse match Gateway paths and omit actor/amount on actions", () => {
  const input = { title: "Đợt 1", contributions: [{ member_user_id: "member", destination_id: "dest", amount: "100" }] };
  assert.deepEqual(commands.contributionRequest(fund, input).body, { ...input, expected_finance_version: 17 });
  for (const action of ["report-transfer", "confirm-received", "waive", "cancel", "reverse", "reject-transfer"]) {
    const result = commands.contribution(fund, row, action);
    assert.equal(result.path, `/contributions/row%2Fid/${action}`);
    assert.equal(result.method, "POST");
    assert.deepEqual(result.body, { expected_finance_version: 17, expected_version: 5 });
  }
  assert.equal(commands.contribution(fund, row, "amount", { amount: "12" }).method, "PATCH");
});
test("Expense/Refund/Closure commands use exact action paths, null clearing and snapshot hash", () => {
  assert.deepEqual(commands.expense(fund, { title: "Meal", amount: "10", category: null }, row).body, { title: "Meal", amount: "10", category: null, expected_finance_version: 17, expected_version: 5 });
  assert.equal(commands.expenseAction(fund, row, "delete").method, "DELETE");
  assert.equal(commands.expenseAction(fund, row, "delete").path, "/expenses/row%2Fid");
  for (const action of ["submit", "withdraw", "confirm", "reject", "reverse"]) assert.equal(commands.expenseAction(fund, row, action).path, `/expenses/row%2Fid/${action}`);
  for (const action of ["report-paid", "confirm-received", "confirm-nonreceipt", "cancel", "request-reversal", "consent-reversal", "reverse"]) assert.equal(commands.refundAction(fund, row, action).path, `/refunds/row%2Fid/${action}`);
  const closure = { ...row, snapshot_hash: "a".repeat(64) };
  assert.deepEqual(commands.closureAction(closure, "confirm").body, { snapshot_hash: closure.snapshot_hash });
  assert.deepEqual(commands.closureAction(closure, "cancel", "reason").body, { reason: "reason" });
  assert.deepEqual(commands.closureAction(closure, "remind").body, {});
});
test("Finance API sends Bearer/idempotency, encodes pagination and downloads binary authenticated", async () => {
  const calls = [];
  const client = createApiClient({ getBaseUrl: () => "https://gateway.test/api/v1", fetch: async (url, options) => {
    calls.push({ url, ...options });
    return url.includes("/download?") ? new Response("private", { headers: { "Content-Type": "image/png" } }) : Response.json({ data: { items: [], next_cursor: null } });
  } });
  const api = createFinanceApi(client);
  await api.execute(write, key);
  assert.equal(calls[0].headers["Idempotency-Key"], key);
  assert.equal(JSON.parse(calls[0].body).budget_amount, "9007199254740993");
  await api.list(fundId, "transactions", "cursor+/=");
  assert.equal(new URL(calls.at(-1).url).searchParams.get("cursor"), "cursor+/=");
  const form = new FormData(); form.append("file", new Blob(["image"]), "receipt.png");
  await api.uploadReceipt(fundId, form);
  assert.equal(calls.at(-1).body, form);
  assert.equal(calls.at(-1).headers["Content-Type"], undefined);
  assert.equal(await (await api.downloadReceipt(fundId, "a/b+c")).text(), "private");
  assert.equal(new URL(calls.at(-1).url).searchParams.get("object_key"), "a/b+c");
});

function harness(overrides = {}) {
  const values = new Map(), calls = [];
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => { values.delete(key); } };
  const deps = { tripId, storageKey: "scope", storage, uuid: () => key, execute: async (command, id) => { calls.push({ command, id }); return pendingOp; }, poll: async () => pendingOp, message: error => error.message, ...overrides };
  return { controller: createOperationController(deps), deps, values, calls };
}
test("202 is not success; mutations blocked until a terminal receipt is acknowledged", async () => {
  const { controller: c, calls } = harness(); await c.load();
  await c.run(write);
  assert.equal(operationCommitted(c.getSnapshot().pending), false);
  assert.equal(await c.run(commands.closure(fund)), false);
  assert.equal(await c.acknowledge(), false);
  assert.equal(calls.length, 1);
});
test("Lost response retries immutable body/key even if caller mutates original draft", async () => {
  const calls = [];
  const { controller: c } = harness({ execute: async (command, key) => { calls.push(JSON.stringify({ command, key })); throw new ApiError("NETWORK_ERROR", "network"); } });
  await c.load();
  const input = commands.budget(fund, "10");
  await c.run(input); input.body.budget_amount = "20";
  await c.retry();
  assert.equal(calls.length, 2); assert.equal(calls[0], calls[1]);
});
test("A replay denial cannot clear an ambiguous original result", async () => {
  let first = true;
  const { controller: c } = harness({ execute: async () => { if (first) { first = false; throw new ApiError("NETWORK_ERROR", "network"); } throw new ApiError("PERMISSION_DENIED", "denied", 403); } });
  await c.load(); await c.run(write); await c.retry();
  assert.equal(operationTerminal(c.getSnapshot().pending), false);
  assert.equal(await c.acknowledge(), false);
});
test("Known initial rejection permits explicit reload, but not a blind automatic retry", async () => {
  const { controller: c } = harness({ execute: async () => { throw new ApiError("VERSION_CONFLICT", "conflict", 409); } });
  await c.load(); await c.run(write);
  assert.equal(c.getSnapshot().pending.rejection, "VERSION_CONFLICT");
  assert.equal(operationCommitted(c.getSnapshot().pending), false);
  assert.equal(await c.acknowledge(), true);
  assert.equal(c.getSnapshot().pending, undefined);
});
test("Durable receipt contains no bank details, reason, amount, files or tokens", async () => {
  const { controller: c, values, deps } = harness(); await c.load();
  await c.run(commands.enable(tripId, "holder", destination, "99999"));
  const saved = values.get("scope");
  for (const privateValue of ["0012345678", "Test", "99999", "destination", "body", "command"]) assert.ok(!saved.includes(privateValue));
  const restarted = createOperationController({ ...deps, poll: async () => done });
  await restarted.load();
  assert.equal(restarted.getSnapshot().pending.command, undefined);
  await restarted.check();
  assert.equal(operationCommitted(restarted.getSnapshot().pending), true);
  assert.equal(await restarted.acknowledge(), true);
  assert.equal(values.size, 0);
});
test("Lookup 404 after restart retains the receipt; mismatched trip/operation cannot complete it", async () => {
  const { controller: c, deps } = harness(); await c.load(); await c.run(write);
  const restarted = createOperationController({ ...deps, poll: async () => { throw new ApiError("RESOURCE_NOT_FOUND", "missing", 404); } });
  await restarted.load(); await restarted.check();
  assert.ok(restarted.getSnapshot().pending);
  assert.match(restarted.getSnapshot().error, /404/);
  const wrong = createOperationController({ ...deps, poll: async () => ({ ...done, trip_id: "other" }) });
  await wrong.load(); await wrong.check();
  assert.equal(operationCommitted(wrong.getSnapshot().pending), false);
});
test("Storage failures fail closed before a write and during terminal acknowledgement", async () => {
  let called = 0;
  const { controller: c } = harness({ storage: { getItem: async () => null, setItem: async () => { throw new Error("full"); } }, execute: async () => { called++; } });
  await c.load(); assert.equal(await c.run(write), false); assert.equal(called, 0);
  const { controller: blocked } = harness({ storage: { getItem: async () => "corrupt" } });
  await blocked.load(); assert.equal(blocked.getSnapshot().ready, false);
  assert.equal(await blocked.run(write), false);
  const { controller: terminal, deps: terminalDeps } = harness({ execute: async () => done });
  await terminal.load(); await terminal.run(write);
  terminalDeps.storage.removeItem = async () => { throw new Error("storage denied"); };
  assert.equal(await terminal.acknowledge(), false);
  assert.ok(terminal.getSnapshot().pending);
  assert.equal(terminal.getSnapshot().busy, false);
});
test("UUID failure never sends a request or leaves the operation lock busy", async () => {
  const { controller: c, calls } = harness({ uuid: () => { throw new Error("crypto unavailable"); } });
  await c.load(); assert.equal(await c.run(write), false);
  assert.equal(c.getSnapshot().busy, false); assert.equal(calls.length, 0);
});
test("Double submit is serialized before asynchronous receipt persistence", async () => {
  const { controller: c, calls } = harness(); await c.load();
  await Promise.all([c.run(write), c.run(write)]);
  assert.equal(calls.length, 1);
});
test("NEEDS_REVIEW blocks replay, can recover by lookup, and terminal state cannot downgrade", async () => {
  let poll = { ...pendingOp, state: "NEEDS_REVIEW" };
  const { controller: c, calls } = harness({ poll: async () => poll }); await c.load(); await c.run(write); await c.check(); await c.retry();
  assert.equal(calls.length, 1); assert.equal(await c.acknowledge(), false);
  assert.match(operationMessage(c.getSnapshot().pending), /vận hành/);
  poll = done; await c.check();
  assert.equal(operationCommitted(c.getSnapshot().pending), true);
  assert.equal(c.getSnapshot().pending.command, undefined);
  poll = pendingOp; await c.check();
  assert.equal(operationCommitted(c.getSnapshot().pending), true);
});
test("Reminder accepted receipt is success only for the matching operation, not delivery proof", async () => {
  const { controller: c } = harness({ execute: async () => ({ accepted: true, operation_id: "wrong" }) });
  await c.load(); await c.run(write); assert.equal(operationCommitted(c.getSnapshot().pending), false);
  assert.deepEqual(receiptForStorage({ key, tripId, kind: "finance", title: "Test", command: write }).command, undefined);
});

test("Extended finance responses share the operation lock and never persist payment details", async () => {
  for (const result of [{ id: 'attempt', payment_url: 'https://test-payment.momo.vn/private' }, { deleted: true }, { accepted: true, closure_id: 'closure' }]) {
    const { controller: c, values, deps } = harness({ execute: async () => result });
    await c.load(); await c.run(write);
    assert.equal(operationCommitted(c.getSnapshot().pending), true);
    assert.deepEqual(c.getSnapshot().result, result);
    assert.equal(await c.run({ ...write, kind: 'leave' }), false);
    assert.ok(!values.get('scope').includes('payment_url'));
    const restored = createOperationController(deps);
    await restored.load();
    assert.equal(restored.getSnapshot().result, undefined);
    assert.equal(restored.getSnapshot().pending.command, undefined);
  }
});

test("Extended entity responses cannot bypass operation identity validation", async () => {
  const { controller: c } = harness({ execute: async () => ({ id: 'attempt', operation_id: 'wrong' }) });
  await c.load(); await c.run(write);
  assert.equal(operationCommitted(c.getSnapshot().pending), false);
  assert.equal(c.getSnapshot().result, undefined);
});
