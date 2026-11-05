import assert from "node:assert/strict";
import test from "node:test";
import { launchTiming, remainingLaunchTime } from "../src/shared/ui/launch/launch-policy.ts";

test("normal launch is brief once the session is ready", () => {
  assert.equal(remainingLaunchTime(0, true, false), 1200);
  assert.equal(remainingLaunchTime(800, true, false), 400);
  assert.equal(remainingLaunchTime(1500, true, false), 0);
});
test("slow, offline or permanently pending auth never holds splash indefinitely", () => {
  assert.equal(remainingLaunchTime(0, false, false), 2400);
  assert.equal(remainingLaunchTime(2401, false, false), 0);
  assert.ok(launchTiming.assetGrace + launchTiming.maximum + launchTiming.exit < launchTiming.safety);
});
test("reduced motion removes decorative delay and bounds auth wait", () => {
  assert.equal(remainingLaunchTime(0, true, true), 0);
  assert.equal(remainingLaunchTime(0, false, true), 900);
  assert.equal(remainingLaunchTime(901, false, true), 0);
});
test("clock rollback and late readiness remain bounded", () => {
  assert.equal(remainingLaunchTime(-100, true, false), 1200);
  assert.equal(remainingLaunchTime(2300, true, false), 0);
});
