import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = path => readFile(new URL(`../src/${path}`, import.meta.url), "utf8");

test("reading summaries and floating chrome stay on opaque clay surfaces", async () => {
  const intro = await source("shared/ui/page-intro.tsx");
  assert.doesNotMatch(intro, /GlassSurface/);
  assert.match(intro, /backgroundColor: colors.surface/);
  const glass = await source("shared/ui/glass-surface.tsx");
  assert.match(glass, /interactive && styles.interactive/);
  assert.doesNotMatch(glass, /rgba\(255, ?255, ?255, ?0\.[0-6]/, "no translucent white glass tints");
  const screen = await source("shared/ui/screen.tsx");
  assert.match(screen, /variant="prominent"\s+blurTarget=\{blurTarget\}/);
});

test("frequent controls have bounded press feedback, not bouncing or staggered navigation", async () => {
  const press = await source("shared/hooks/use-press-motion.ts");
  assert.match(press, /Math.max\(0.97, pressedScale\)/);
  assert.match(press, /transitionDuration: reduceMotion \|\| disabled \? 0 : 120/);
  assert.match(press, /onPressOut: \(\) => setPressed\(false\)/);
  assert.doesNotMatch(press, /withSpring|withRepeat/);
  const paper = await source("shared/hooks/use-paper-press.ts");
  assert.match(paper, /transitionDuration: reduceMotion \|\| disabled \? 0/);
  assert.doesNotMatch(paper, /withSpring|withRepeat/);
  // The tab marker may slide between destinations, but never under Reduce Motion.
  const tabs = await source("shared/ui/bottom-tab-bar.tsx");
  assert.match(tabs, /if \(reduceMotion \|\| lastIndex === activeIndex\)/);
  assert.doesNotMatch(tabs, /withRepeat/);
  assert.match(tabs, /router\.navigate\(tab\.route\)/);
  assert.doesNotMatch(await source("features/trips/screens/my-trips-screen.tsx"), /MotionReveal/);
});

test("packing states explain completion with symbols and text, not color alone", async () => {
  const check = await source("shared/ui/packing-check.tsx");
  assert.match(check, /name="check"/);
  assert.match(check, /transitionDuration: reduceMotion \? 0 : 160/);
  const packing = await source("features/trip-demo/packing-screen.tsx");
  assert.match(packing, /accessibilityRole="checkbox"/);
  assert.match(packing, /accessibilityState=\{\{ checked: item.done \}\}/);
  assert.match(packing, /Đã chuẩn bị.*Cần chuẩn bị/);
  assert.match(packing, /<PackingCheck checked=\{item.done\}/);
  assert.doesNotMatch(packing, /layered.tint/);
});

test("overview distinguishes demo finances and preparation with explicit labels", async () => {
  const overview = await source("features/trip-demo/overview-screen.tsx");
  assert.match(overview, /Sẵn sàng lên đường/);
  assert.match(overview, /Quỹ khả dụng mô phỏng/);
  assert.match(overview, /tone="mint"/);
  assert.match(overview, /accessibilityLabel="Quỹ nhóm mẫu"/);
  const tokens = await source("shared/theme/tokens.ts");
  assert.doesNotMatch(tokens, /shadowOffset|shadowOpacity|shadowRadius/);
});
