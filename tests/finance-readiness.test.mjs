import assert from "node:assert/strict";
import test from "node:test";
import { closureChecklist } from "../src/features/finance/closure-readiness.ts";
import { localWatchValues, watchFormDates, watchInput } from "../src/features/price-watch/api.ts";

test("closure checklist explains every server blocker with an owner and a destination", () => {
  const items = closureChecklist({
    ready: false,
    fund_status: "OPEN",
    current_balance: "1500000",
    bank_transfers_needing_review: 0,
    blockers: [
      { kind: "CONTRIBUTIONS_OPEN", count: 2 },
      { kind: "PAYMENTS_OPEN", count: 1 },
      { kind: "PAYMENT_WEBHOOKS_OPEN", count: 1 },
      { kind: "EXPENSES_OPEN", count: 3 },
      { kind: "REFUNDS_OPEN", count: 1 },
      { kind: "HOLDER_HANDOVER_OPEN", count: 1 },
      { kind: "BALANCE_NOT_ZERO", count: 1 },
    ],
  });
  assert.equal(items.length, 7);
  assert.equal(items[0].title, "2 khoản góp chưa hoàn tất");
  assert.match(items[0].action, /miễn hoặc hủy riêng khoản đó/);
  assert.equal(items[0].target, "contribution-requests");
  assert.equal(items[1].target, "fund-tools");
  assert.equal(items.at(-1).title, "Quỹ còn 1.500.000 ₫");
  for (const item of items) assert.ok(item.owner && item.targetLabel && item.action);
});

test("ledger drift with a zero cached balance still reads as an unbalanced fund", () => {
  const [item] = closureChecklist({
    ready: false, fund_status: "OPEN", current_balance: "0", bank_transfers_needing_review: 0,
    blockers: [{ kind: "BALANCE_NOT_ZERO", count: 1 }],
  });
  assert.equal(item.title, "Sổ quỹ chưa cân");
});

test("price watch form takes Vietnam time and sends the matching UTC instant and day", () => {
  const values = {
    origin: "sgn", destination: "dad", departure_date: "02/01/2030", departure_time: "06:30",
    journey_type: "ROUND_TRIP", return_date: "05/01/2030", adults: "1", children: "0", infants: "0",
    cabin_class: "ECONOMY", threshold_price: "2000000",
  };
  const input = watchInput(localWatchValues(values), 0);
  // 06:30 in Vietnam is 23:30 UTC the previous day; the API requires the UTC calendar day.
  assert.equal(input.departure_at, "2030-01-01T23:30:00Z");
  assert.equal(input.departure_date, "2030-01-01");
  assert.equal(input.return_date, "2030-01-05");
  assert.throws(() => localWatchValues({ ...values, departure_date: "31/02/2030" }));
  assert.throws(() => localWatchValues({ ...values, return_date: "" }));
  assert.equal(localWatchValues({ ...values, journey_type: "ONE_WAY", return_date: "" }).return_date, "");
});

test("editing a watch shows its stored instant back in Vietnam time", () => {
  const dates = watchFormDates({
    normalized_query: { departure_at: "2030-01-01T23:30:00Z", return_date: "2030-01-05" },
  });
  assert.deepEqual(dates, { departure_date: "02/01/2030", departure_time: "06:30", return_date: "05/01/2030" });
  assert.deepEqual(watchFormDates(undefined), { departure_date: "", departure_time: "12:00", return_date: "" });
});
