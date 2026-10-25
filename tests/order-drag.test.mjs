import assert from "node:assert/strict";
import test from "node:test";
import { dragPosition, dragScrollOffset, orderFrames, ORDER_HOLD_MS } from "../src/features/trips/model/order-drag.ts";

const measured = new Map([
  ["short", { y: 999, height: 88 }],
  ["tall", { y: 4, height: 260 }],
  ["last", { y: 2, height: 96 }],
]);
test("drag frames use the current order, not stale keyed-row positions", () => {
  const first = orderFrames(["short", "tall", "last"], measured);
  assert.deepEqual([...first.values()], [{ y: 3, height: 88 }, { y: 101, height: 260 }, { y: 371, height: 96 }]);
  const second = orderFrames(["last", "short", "tall"], measured);
  assert.deepEqual([...second.values()], [{ y: 3, height: 96 }, { y: 109, height: 88 }, { y: 207, height: 260 }]);
  assert.equal(measured.get("short").y, 999);
  assert.equal(orderFrames(["short", "missing"], measured), undefined);
  assert.equal(orderFrames(["short", "short"], measured), undefined);
  assert.equal(orderFrames(["x"], new Map([["x", { height: NaN }]])), undefined);
});

test("variable-height rows can be dropped at either end and visual movement stays bounded", () => {
  const ids = ["short", "tall", "last"], frames = orderFrames(ids, measured);
  assert.deepEqual(dragPosition(ids, frames, "short", 0), { translation: 0, index: 0 });
  assert.deepEqual(dragPosition(ids, frames, "short", 190), { translation: 190, index: 1 });
  assert.deepEqual(dragPosition(ids, frames, "tall", 10000), { translation: 106, index: 2 });
  assert.deepEqual(dragPosition(ids, frames, "last", -10000), { translation: -368, index: 0 });
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
