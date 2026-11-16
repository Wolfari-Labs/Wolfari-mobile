import assert from 'node:assert/strict';
import { test } from 'node:test';
import { financeCommands } from '../src/features/finance/api.ts';
import { refundActions, refundConfirmer, refundNeedsVerifier } from '../src/features/finance/model.ts';
import { historyActionLabel, historyActorLabel } from '../src/features/finance/history-labels.ts';

const fund = { id: 'f1', holder_user_id: 'holder', finance_version: 7 };
const refund = (member, extra = {}) => ({ id: 'r1', member_user_id: member, status: 'HOLDER_REPORTED', version: 3, nonreceipt_confirmed_at: null, reversal_requested_at: null, reversal_consented_at: null, ...extra });
const actor = (userId, owner = false) => ({ userId, owner, writable: true, holder: userId === 'holder' });

test('refund confirmer follows the independent verification rule (FR-FN07)', () => {
  const ctx = { holderUserId: 'holder', ownerUserId: 'owner', activeMemberCount: 3 };
  assert.equal(refundConfirmer(refund('member'), ctx), 'member');
  assert.equal(refundConfirmer(refund('holder'), ctx), 'owner');
  const ownerIsHolder = { holderUserId: 'holder', ownerUserId: 'holder', activeMemberCount: 3 };
  assert.equal(refundConfirmer(refund('holder'), ownerIsHolder), null);
  assert.equal(refundConfirmer(refund('holder', { verifier_user_id: 'member' }), ownerIsHolder), 'member');
  assert.equal(refundConfirmer(refund('holder'), { ...ownerIsHolder, activeMemberCount: 1 }), 'holder');
  assert.equal(refundNeedsVerifier(refund('holder'), ownerIsHolder), true);
  assert.equal(refundNeedsVerifier(refund('member'), ownerIsHolder), false);
});

test('refund actions only offer confirmation to the computed confirmer', () => {
  const ownerIsHolder = { holderUserId: 'holder', ownerUserId: 'holder', activeMemberCount: 3 };
  assert.deepEqual(refundActions(refund('holder'), actor('holder', true), ownerIsHolder), ['assign-verifier', 'confirm-nonreceipt']);
  const assigned = refund('holder', { verifier_user_id: 'member' });
  assert.deepEqual(refundActions(assigned, actor('member'), ownerIsHolder), ['confirm-received']);
  // Without context the previous recipient-only behaviour is kept.
  assert.deepEqual(refundActions(refund('member'), actor('member')), ['confirm-received', 'confirm-nonreceipt']);
});

test('refund verifier and handover commands hit the published routes with versions', () => {
  const verifier = financeCommands.refundVerifier(fund, { id: 'r1', version: 3 }, 'member');
  assert.equal(verifier.path, '/refunds/r1/assign-verifier');
  assert.deepEqual(verifier.body, { verifier_user_id: 'member', expected_finance_version: 7, expected_version: 3 });
  const create = financeCommands.handover(fund, 'member');
  assert.equal(create.path, '/funds/f1/holder-handovers');
  assert.deepEqual(create.body, { new_holder_user_id: 'member', expected_finance_version: 7 });
  const row = { id: 'h1', version: 2, snapshot_finance_version: 7 };
  const confirm = financeCommands.handoverAction(fund, row, 'confirm');
  assert.equal(confirm.path, '/holder-handovers/h1/confirm');
  assert.deepEqual(confirm.body, { expected_finance_version: 7, expected_version: 2, expected_snapshot_finance_version: 7 });
  const cancel = financeCommands.handoverAction(fund, row, 'cancel', 'Đổi kế hoạch');
  assert.deepEqual(cancel.body, { expected_finance_version: 7, expected_version: 2, reason: 'Đổi kế hoạch' });
  assert.equal(financeCommands.handoverAction(fund, row, 'accept').path, '/holder-handovers/h1/accept');
});

test('history labels cover handover, verifier and the SePay bank webhook', () => {
  assert.equal(historyActionLabel('CONFIRM_HOLDER_HANDOVER'), 'Xác nhận bàn giao quỹ');
  assert.equal(historyActionLabel('ASSIGN_REFUND_VERIFIER'), 'Chỉ định người kiểm chứng hoàn tiền');
  assert.equal(historyActionLabel('CONFIRM_BANK_TRANSFER'), 'Tự xác nhận tiền về ngân hàng');
  assert.equal(historyActorLabel({ actor_user_id: null, system_actor: 'BANK_WEBHOOK:SEPAY' }, (id) => id), 'Ngân hàng (SePay) báo tiền về');
});
