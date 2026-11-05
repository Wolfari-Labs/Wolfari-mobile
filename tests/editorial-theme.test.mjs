import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { colors } = require("../src/shared/theme/foundation.json");
const config = require("../tailwind.config.js");
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => {
    const s = parseInt(value, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

test("D pastel text and primary controls retain AA text contrast", () => {
  for (const [fg, bg] of [
    ["ink", "canvas"], ["muted", "canvas"], ["muted", "surface"],
    ["teal", "surface"], ["teal", "tealSoft"], ["surface", "tealPressed"],
    ["onAccent", "gradientBlue"], ["onAccent", "gradientMint"],
    ["muted", "tealSoft"], ["muted", "mint"], ["muted", "butter"], ["muted", "peach"],
  ]) assert.ok(contrast(colors[fg], colors[bg]) >= 4.5, `${fg} on ${bg} must reach 4.5:1`);
});

test("NativeWind shares tokens and permits late web CSS hydration", () => {
  assert.deepEqual(config.theme.extend.colors, colors);
  assert.equal(config.darkMode, "class");
});

test("floating chrome uses opaque soft clay and a decorative pastel canvas (direction D)", async () => {
  const glass = await readFile(new URL("../src/shared/ui/glass-surface.tsx", import.meta.url), "utf8");
  // Clay is opaque by construction, so Reduce Transparency needs no fallback.
  assert.doesNotMatch(glass, /BlurView|GlassView/);
  assert.doesNotMatch(glass, /borderColor: colors\.ink/);
  assert.match(glass, /shadows\.card/);
  assert.match(glass, /backgroundColor: colors\.surface/);
  const screen = await readFile(new URL("../src/shared/ui/screen.tsx", import.meta.url), "utf8");
  assert.match(screen, /BlurTargetView ref=\{blurTarget\}/);
  assert.match(screen, /onHeightChange=\{setTabHeight\}/);
  // The pastel canvas is decoration only and never intercepts touches.
  assert.match(screen, /<LinearGradient pointerEvents="none" colors=\{gradients.canvas\}/);
});

test("direction D keeps its exact canvas and local static font families", async () => {
  assert.deepEqual([colors.canvas, colors.lavender, colors.mintCanvas], ["#EAF0FF", "#F3F0FF", "#E9FBF3"]);
  const tokens = await readFile(new URL("../src/shared/theme/tokens.ts", import.meta.url), "utf8");
  const layout = await readFile(new URL("../src/app/_layout.tsx", import.meta.url), "utf8");
  for (const weight of ["SemiBold", "Bold", "ExtraBold"]) {
    assert.ok(tokens.includes(`Nunito-${weight}`));
    assert.ok(layout.includes(`@/assets/fonts/Nunito-${weight}.ttf`));
    const bytes = await readFile(new URL(`../assets/fonts/Nunito-${weight}.ttf`, import.meta.url));
    assert.equal(bytes.readUInt32BE(0), 0x00010000, "Bundled fonts are real TrueType files");
  }
  // Static font families select the weight; iOS must not synthesize it again.
  assert.doesNotMatch(tokens.slice(tokens.indexOf("export const typography"), tokens.indexOf("mapLabel:")), /fontWeight/);
});

test("the active bottom tab can return from a nested detail screen", async () => {
  const dock = await readFile(new URL("../src/shared/ui/bottom-tab-bar.tsx", import.meta.url), "utf8");
  assert.match(dock, /router\.navigate\(tab\.route\)/);
  assert.doesNotMatch(dock, /if \(tab\.key !== activeTab\)/);
});
