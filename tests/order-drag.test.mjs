import assert from "node:assert/strict";
import test from "node:test";
import { dragPosition, dragScrollOffset, orderFrames, settleOffset, shiftFor, ORDER_HOLD_MS } from "../src/features/trips/model/order-drag.ts";

const measured = new Map([
  ["short", { y: 999, height: 88 }],
  ["tall", { y: 4, height: 260 }],
  ["last", { y: 2, height: 96 }],
]);
test("drag frames use the current order, not stale keyed-row positions", () => {
  const first = orderFrames(["short", "tall", "last"], measured);
  assert.deepEqual([...first.values()], [{ y: 0, height: 88 }, { y: 100, height: 260 }, { y: 372, height: 96 }]);
  const second = orderFrames(["last", "short", "tall"], measured);
  assert.deepEqual([...second.values()], [{ y: 0, height: 96 }, { y: 108, height: 88 }, { y: 208, height: 260 }]);
  assert.equal(measured.get("short").y, 999);
  assert.equal(orderFrames(["short", "missing"], measured), undefined);
  assert.equal(orderFrames(["short", "short"], measured), undefined);
  assert.equal(orderFrames(["x"], new Map([["x", { height: NaN }]])), undefined);
});

test("variable-height rows can be dropped at either end and visual movement stays bounded", () => {
  const ids = ["short", "tall", "last"], frames = orderFrames(ids, measured);
  assert.deepEqual(dragPosition(ids, frames, "short", 0), { translation: 0, index: 0 });
  assert.deepEqual(dragPosition(ids, frames, "short", 190), { translation: 190, index: 1 });
  assert.deepEqual(dragPosition(ids, frames, "tall", 10000), { translation: 108, index: 2 });
  assert.deepEqual(dragPosition(ids, frames, "last", -10000), { translation: -372, index: 0 });
  assert.equal(dragPosition(ids, frames, "missing", 1), undefined);
  assert.equal(dragPosition(ids, frames, "short", NaN), undefined);
});

test("drag delta includes list scrolling so the target advances with auto-scroll", () => {
  const ids = ["short", "tall", "last"], frames = orderFrames(ids, measured);
  const fingerDelta = 150, startOffset = 0, currentOffset = 230;
  assert.equal(dragPosition(ids, frames, "short", fingerDelta).index, 1);
  assert.equal(dragPosition(ids, frames, "short", fingerDelta + currentOffset - startOffset).index, 2);
});

test("edge scrolling clamps at both ends and does not scroll in the middle or a short list", () => {
  assert.equal(dragScrollOffset(50, 10, 300, 1000), 41);
  assert.equal(dragScrollOffset(50, 290, 300, 1000), 59);
  assert.equal(dragScrollOffset(50, 150, 300, 1000), 50);
  assert.equal(dragScrollOffset(0, 10, 300, 1000), 0);
  assert.equal(dragScrollOffset(700, 290, 300, 1000), 700);
  assert.equal(dragScrollOffset(0, 290, 300, 200), 0);
  assert.equal(dragScrollOffset(50, 290, 0, 1000), 50);
  assert.equal(ORDER_HOLD_MS, 250);
});

test("a dropped row settles exactly into its slot and neighbours make room", () => {
  const ids = ["short", "tall", "last"], frames = orderFrames(ids, measured);
  // short (88) moved below last: ends where last ended (372 + 96 - 88).
  assert.equal(settleOffset(ids, frames, 0, 2), 380);
  assert.equal(settleOffset(ids, frames, 2, 0), -372);
  assert.equal(settleOffset(ids, frames, 1, 1), 0);
  assert.deepEqual([0, 1, 2].map(i => shiftFor(i, 0, 2, 100)), [0, -100, -100]);
  assert.deepEqual([0, 1, 2].map(i => shiftFor(i, 2, 0, 100)), [100, 100, 0]);
  assert.deepEqual([0, 1, 2].map(i => shiftFor(i, -1, 0, 100)), [0, 0, 0]);
});
