import assert from "node:assert/strict";
import test from "node:test";
import { packingForm, packingInput } from "../src/features/trips/model/packing.ts";
import { createTripsApi } from "../src/features/trips/api/trips.api.ts";

const member = { id: "membership", user_id: "user", left_at: null };
const context = { members: [member], timezone: "Asia/Ho_Chi_Minh", planVersion: 7 };
const initial = {
  ...packingForm(undefined, context.timezone),
  name: "Nước",
  quantity: "1,25",
  assignee: member.id,
  due: "01/12/2026",
};
test("shared packing uses membership IDs, exact quantities and Trip-local due dates", () => {
  const input = packingInput(initial, context);
  assert.equal(input.quantity, "1.25");
  assert.equal(input.assigned_member_id, "membership");
  assert.equal(input.due_at, "2026-12-01T16:59:00.000Z");
  assert.equal(input.expected_plan_version, 7);
  for (const quantity of ["0", "-1", "1e3", "1.234", "100000000"])
    assert.throws(() => packingInput({ ...initial, quantity }, context));
  assert.throws(() => packingInput({ ...initial, assignee: "user" }, context));
  assert.throws(() =>
    packingInput(initial, { ...context, members: [{ ...member, left_at: "now" }] }),
  );
  assert.throws(() => packingInput({ ...initial, due: "2026-02-30" }, context));
  assert.equal(packingInput({ ...initial, due: "", assignee: "" }, context).due_at, null);
});
test("packing commands and policy reads use the versioned Gateway contract", async () => {
  const calls = [];
  const api = createTripsApi({
    request: async (path, options) => {
      calls.push({ path, ...options });
      return {};
    },
  });
  const input = packingInput(initial, context);
  await api.savePacking("trip", undefined, input, "key");
  assert.equal(calls.at(-1).path, "/trips/trip/packing-items");
  assert.equal(calls.at(-1).headers["Idempotency-Key"], "key");
  await api.completePacking("trip", { id: "item", status: "TODO" }, 8, "complete");
  assert.deepEqual(calls.at(-1).body, { status: "COMPLETED", expected_plan_version: 8 });
  await api.removePacking("trip", "item", 9, "delete");
  assert.equal(calls.at(-1).method, "DELETE");
  assert.deepEqual(calls.at(-1).body, { expected_plan_version: 9 });
  await api.getPolicy("trip");
  assert.equal(calls.at(-1).path, "/trips/trip/plan-policy");
});

test("editing packing details preserves an existing deadline until its date changes", () => {
  const due_at = "2026-12-01T02:30:45.123Z";
  const form = packingForm({ name: "Nước", due_at }, context.timezone);
  assert.equal(packingInput({ ...form, note: "Đã mua" }, context).due_at, due_at);
  assert.equal(
    packingInput({ ...form, due: "02/12/2026" }, context).due_at,
    "2026-12-02T16:59:00.000Z",
  );
  assert.equal(packingInput({ ...form, due: "" }, context).due_at, null);
});

test("packing quantities read naturally in Vietnamese", async () => {
  const { quantityLabel } = await import("../src/features/trips/model/packing.ts");
  assert.equal(quantityLabel("1.50", "chai"), "1,5 chai");
  assert.equal(quantityLabel("2", "cái"), "2 cái");
  assert.equal(quantityLabel("3.00", null), "3");
  assert.equal(quantityLabel("1.25", "  "), "1,25");
});
