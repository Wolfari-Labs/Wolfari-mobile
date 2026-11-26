import assert from "node:assert/strict";
import test from "node:test";
import { expenseBadge, fundTotals } from "../src/features/finance/expense-categories.ts";
import { expenseForm } from "../src/features/finance/forms.ts";

const fund = { id: "f", available_balance: "500000", finance_version: 2 };
test("fund totals exclude refunds and resolve reversals even on a more recent ledger page", () => {
  const rows = [
    { id: "r1", transaction_type: "REVERSAL", reversal_of_id: "hotel", amount: "150" },
    { id: "r2", transaction_type: "REVERSAL", reversal_of_id: "refund", amount: "50" },
    { id: "r3", transaction_type: "REVERSAL", reversal_of_id: "extra", amount: "100" },
    { id: "fare", transaction_type: "EXPENSE", amount: "80" },
    { id: "hotel", transaction_type: "EXPENSE", amount: "150" },
    { id: "refund", transaction_type: "REFUND", amount: "50" },
    { id: "otherRefund", transaction_type: "REFUND", amount: "60" },
    { id: "main", transaction_type: "CONTRIBUTION", amount: "9007199254740993" },
    { id: "extra", transaction_type: "CONTRIBUTION", amount: "100" },
  ];
  assert.deepEqual(fundTotals(rows), { contributed: "9007199254740993", spent: "80" });
});
test("expense badges follow the category", () => {
  assert.equal(expenseBadge("Lưu trú").icon, "bag");
  assert.equal(expenseBadge("Di chuyển", "Ăn trưa").icon, "car");
  assert.equal(expenseBadge(null, "Xăng xe").icon, "car");
  assert.equal(expenseBadge(null, "Taxi sân bay").icon, "car");
  assert.equal(expenseBadge("Lạ").icon, "wallet");
});
test("a new expense sends its payment time; future days are refused; edits keep the stored time", () => {
  const spec = expenseForm(fund, "Asia/Ho_Chi_Minh", "Bạn");
  const values = { ...spec.initial, title: "Bữa trưa", amount: "350000", category: "Ăn uống" };
  const body = spec.build(values).body;
  assert.equal(body.amount, "350000");
  assert.ok(Math.abs(Date.parse(body.paid_at) - Date.now()) < 60_000);
  assert.equal(spec.build({ ...values, date: "01/10/2026" }).body.paid_at.slice(0, 10), "2026-10-01");
  assert.throws(() => spec.build({ ...values, date: "01/01/2999" }), /tương lai/);
  assert.throws(() => spec.build({ ...values, amount: "" }));
  const row = { id: "e", title: "Cũ", amount: "1", category: null, description: "giữ", paid_at: "2026-10-02T03:04:05Z", version: 1 };
  const edit = expenseForm(fund, "Asia/Ho_Chi_Minh", "Bạn", row);
  const kept = edit.build(edit.initial).body;
  assert.equal("paid_at" in kept, false);
  assert.equal(kept.description, "giữ");
});
