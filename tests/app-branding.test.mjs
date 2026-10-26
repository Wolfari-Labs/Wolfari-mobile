import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import imageUtils from "@expo/image-utils";

const { getPngInfo } = imageUtils;
const root = fileURLToPath(new URL("../", import.meta.url));
const { expo } = JSON.parse(await readFile(join(root, "app.json"), "utf8"));
const splash = expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen")?.[1];

test("mobile branding uses Wolfari instead of Expo template assets", () => {
  assert.equal(expo.icon, "./assets/images/wolfari-app-icon.png");
  assert.equal(expo.ios.icon, expo.icon);
  assert.equal(expo.android.icon ?? expo.icon, expo.icon);
  assert.equal(expo.android.adaptiveIcon.foregroundImage, "./assets/images/wolfari-adaptive-foreground.png");
  assert.equal(expo.android.adaptiveIcon.backgroundColor, "#DDF7EF");
  assert.equal(expo.android.adaptiveIcon.backgroundImage, undefined);
  assert.equal(expo.android.adaptiveIcon.monochromeImage, undefined);
  assert.equal(splash.image, "./assets/images/wolfari-splash-icon.png");
  assert.equal(splash.resizeMode, "contain");
  assert.equal(splash.backgroundColor, expo.android.adaptiveIcon.backgroundColor);
});

test("the iOS app icon is a 1024px square with no alpha channel", async () => {
  const data = await readFile(join(root, expo.ios.icon));
  const icon = await getPngInfo(join(root, expo.ios.icon));
  assert.equal(icon.width, 1024);
  assert.equal(icon.height, 1024);
  assert.equal(data[25], 2, "PNG color type must be RGB, not RGBA");
  for (let index = 3; index < icon.data.length; index += 4) {
    assert.equal(icon.data[index], 255);
  }
});

test("the complete Android foreground stays inside the adaptive-icon safe circle", async () => {
  const icon = await getPngInfo(join(root, expo.android.adaptiveIcon.foregroundImage));
  assert.equal(icon.width, 1024);
  assert.equal(icon.height, 1024);
  const center = icon.width / 2;
  const safeRadius = icon.width * 33 / 108;
  let visiblePixels = 0;
  for (let y = 0; y < icon.height; y++) {
    for (let x = 0; x < icon.width; x++) {
      if (icon.data[(y * icon.width + x) * 4 + 3] === 0) continue;
      visiblePixels++;
      assert.ok(Math.hypot(x + 0.5 - center, y + 0.5 - center) <= safeRadius,
        `Visible pixel (${x}, ${y}) would be clipped by the safe-circle mask`);
    }
  }
  assert.ok(visiblePixels > 100000, "Foreground must contain the logo, not an empty canvas");
});

test("the splash export preserves transparent outer corners", async () => {
  const icon = await getPngInfo(join(root, splash.image));
  assert.equal(icon.width, 1024);
  assert.equal(icon.height, 1024);
  for (const [x, y] of [[0, 0], [1023, 0], [0, 1023], [1023, 1023]]) {
    assert.equal(icon.data[(y * icon.width + x) * 4 + 3], 0);
  }
  assert.equal(icon.data[(512 * icon.width + 512) * 4 + 3], 255);
});
