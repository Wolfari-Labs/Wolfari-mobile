import assert from "node:assert/strict";
import test from "node:test";
import {
  applyDemoAction,
  createDemoState,
  fundTotals,
  parseAmount,
} from "../src/features/trip-demo/model.ts";

test("demo seed is independent on every opening and has balanced example totals", () => {
  const state = createDemoState();
  assert.deepEqual(fundTotals(state.entries), {
    contributed: 6000000,
    spent: 2400000,
    refunded: 0,
    balance: 3600000,
    reserved: 300000,
    available: 3300000,
    pending: 3000000,
    outside: 180000,
  });
  state.packing[0].name = "Changed";
  assert.notEqual(createDemoState().packing[0].name, "Changed");
});
test("packing edits, assignments, toggles and deletes are immutable", () => {
  const original = createDemoState();
  let next = applyDemoAction(original, { type: "packing.toggle", id: "p1" });
  assert.equal(original.packing[0].done, true);
  assert.equal(next.packing[0].done, false);
  next = applyDemoAction(next, {
    type: "packing.save",
    value: { ...next.packing[0], assignee: "linh", quantity: "3" },
  });
  assert.equal(next.packing[0].assignee, "linh");
  assert.throws(
    () =>
      applyDemoAction(next, {
        type: "packing.save",
        value: { ...next.packing[0], quantity: "0" },
      }),
    /Số lượng/,
  );
  assert.throws(
    () =>
      applyDemoAction(next, {
        type: "packing.save",
        value: { ...next.packing[0], assignee: "stranger" },
      }),
    /thành viên/,
  );
  next = applyDemoAction(next, { type: "packing.delete", id: "p1" });
  assert.equal(next.packing.length, 4);
});
test("dress scopes validate selection and clear fields from other scopes", () => {
  const state = createDemoState();
  const code = { ...state.dress[0], scope: "TRIP", activity: "hoian" };
  const updated = applyDemoAction(state, { type: "dress.save", value: code });
  assert.equal(updated.dress[0].day, "");
  assert.equal(updated.dress[0].activity, "");
  assert.throws(
    () =>
      applyDemoAction(state, {
        type: "dress.save",
        value: { ...code, scope: "DAY", day: "31/02/2026" },
      }),
    /Chọn ngày/,
  );
  assert.throws(
    () =>
      applyDemoAction(state, {
        type: "dress.save",
        value: { ...code, scope: "ACTIVITY", activity: "missing" },
      }),
    /hoạt động/,
  );
  assert.throws(
    () =>
      applyDemoAction(state, {
        type: "dress.save",
        value: { ...code, palette: "missing" },
      }),
    /bảng màu/,
  );
});
test("metadata budget and member estimate do not change fund balances or members", () => {
  const state = createDemoState();
  const next = applyDemoAction(state, {
    type: "details",
    value: {
      ...state.details,
      destination: "Đà Lạt",
      budget: "20000000",
      travelers: "6",
      cover: "dalat",
    },
  });
  assert.equal(next.details.destination, "Đà Lạt");
  assert.deepEqual(next.entries, state.entries);
  assert.throws(
    () =>
      applyDemoAction(state, {
        type: "details",
        value: { ...state.details, travelers: "0" },
      }),
    /Số người/,
  );
  assert.throws(
    () =>
      applyDemoAction(state, {
        type: "details",
        value: { ...state.details, destination: " " },
      }),
    /Điểm đến/,
  );
});
test("VND amounts reject unsafe, decimal, nonpositive or decorated input", () => {
  for (const value of [
    "0",
    "-1",
    "1.5",
    "1e6",
    "1,000",
    " 12",
    "1000000000000",
    "NaN",
    "Infinity",
  ])
    assert.throws(() => parseAmount(value));
  assert.equal(parseAmount("999999999999"), 999999999999);
});
test("confirmation is repeat-safe and cancellation does not erase the history", () => {
  const state = createDemoState();
  const confirmed = applyDemoAction(state, { type: "entry.confirm", id: "e4" });
  assert.equal(fundTotals(confirmed.entries).contributed, 9000000);
  assert.strictEqual(
    applyDemoAction(confirmed, { type: "entry.confirm", id: "e4" }),
    confirmed,
  );
  assert.strictEqual(
    applyDemoAction(confirmed, { type: "entry.cancel", id: "e4" }),
    confirmed,
  );
  const cancelled = applyDemoAction(state, { type: "entry.cancel", id: "e5" });
  assert.equal(fundTotals(cancelled.entries).available, 3600000);
  assert.equal(
    cancelled.entries.find((e) => e.id === "e5").status,
    "CANCELLED",
  );
  assert.equal(cancelled.history.length, state.history.length + 1);
});
test("refund reserves reduce available, confirmation releases reserve and decreases balance once", () => {
  const next = applyDemoAction(createDemoState(), {
    type: "entry.confirm",
    id: "e5",
  });
  assert.equal(fundTotals(next.entries).reserved, 0);
  assert.equal(fundTotals(next.entries).balance, 3300000);
  assert.equal(fundTotals(next.entries).available, 3300000);
});
test("new entries are pending, bounded and cannot overspend reserved money", () => {
  const state = createDemoState();
  const value = {
    ...state.entries[2],
    id: "new-expense",
    amount: "3400000",
    status: "CONFIRMED",
  };
  const next = applyDemoAction(state, { type: "entry.add", value });
  assert.equal(next.entries.at(-1).status, "PENDING");
  assert.throws(
    () => applyDemoAction(next, { type: "entry.confirm", id: value.id }),
    /không đủ/,
  );
  assert.throws(
    () =>
      applyDemoAction(state, {
        type: "entry.add",
        value: { ...value, kind: "refund" },
      }),
    /vượt/,
  );
  assert.throws(
    () =>
      applyDemoAction(state, {
        type: "entry.add",
        value: { ...value, date: "2026-02-30" },
      }),
    /ngày hợp lệ/,
  );
  assert.strictEqual(applyDemoAction(next, { type: "entry.add", value }), next);
});

test("replaying the final allowed entry stays idempotent at the demo limit", () => {
  let state = createDemoState();
  const template = state.entries[0];
  for (let index = state.entries.length; index < 100; index++) {
    state = applyDemoAction(state, {
      type: "entry.add",
      value: { ...template, id: `bounded-${index}` },
    });
  }
  const last = state.entries.at(-1);
  assert.strictEqual(
    applyDemoAction(state, { type: "entry.add", value: last }),
    state,
  );
  assert.throws(
    () => applyDemoAction(state, {
      type: "entry.add", value: { ...last, id: "overflow" },
    }),
    /100 khoản/,
  );
});

test("demo commands reject missing entry IDs and unsupported discriminants", () => {
  const state = createDemoState();
  for (const value of [
    { ...state.entries[0], id: "" },
    { ...state.entries[0], id: "new", kind: "unknown" },
  ]) {
    assert.throws(() => applyDemoAction(state, { type: "entry.add", value }));
  }
  assert.throws(() => applyDemoAction(state, {
    type: "dress.save", value: { ...state.dress[0], scope: "unknown" },
  }), /phạm vi/);
  for (const patch of [{ cover: "missing" }, { style: "missing" }]) {
    assert.throws(() => applyDemoAction(state, {
      type: "details", value: { ...state.details, ...patch },
    }));
  }
});
test("reset restores demo only, including the original cover and sample history", () => {
  const state = createDemoState();
  const edited = applyDemoAction(state, {
    type: "details",
    value: { ...state.details, coverUri: "blob:local-preview" },
  });
  assert.deepEqual(
    applyDemoAction(edited, { type: "reset" }),
    createDemoState(),
  );
});
test("confirmed expense reduces the balance while outside payments do not", () => {
  let state = createDemoState();
  const expense = {
    ...state.entries[2],
    id: "expense-small",
    amount: "200000",
  };
  state = applyDemoAction(state, { type: "entry.add", value: expense });
  state = applyDemoAction(state, { type: "entry.confirm", id: expense.id });
  assert.equal(fundTotals(state.entries).available, 3100000);
  const outside = {
    ...expense,
    id: "outside-new",
    kind: "outside",
    amount: "9999999",
  };
  state = applyDemoAction(state, { type: "entry.add", value: outside });
  state = applyDemoAction(state, { type: "entry.confirm", id: outside.id });
  assert.equal(fundTotals(state.entries).available, 3100000);
});
test("cancelled contributions do not credit the fund and new refunds reserve immediately", () => {
  let state = createDemoState();
  state = applyDemoAction(state, { type: "entry.cancel", id: "e4" });
  assert.equal(fundTotals(state.entries).contributed, 6000000);
  state = applyDemoAction(state, {
    type: "entry.add",
    value: { ...state.entries[4], id: "refund-new", amount: "100000" },
  });
  assert.equal(fundTotals(state.entries).reserved, 400000);
  assert.equal(fundTotals(state.entries).available, 3200000);
});
