import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import imageUtils from "@expo/image-utils";

const { generateImageAsync, generateImageBackgroundAsync, compositeImagesAsync } = imageUtils;
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const assetsDirectory = join(projectRoot, "assets/images");
const sourcePath = join(assetsDirectory, "wolfari-logo.png");
const backgroundColor = "#DDF7EF";
const iconSize = 1024;

async function resizeLogo(size, options = {}) {
  const { source } = await generateImageAsync({ projectRoot }, {
    src: sourcePath,
    width: size,
    height: size,
    resizeMode: "contain",
    ...options,
  });
  return source;
}

// Export platform sizes only; never crop, redraw, or overwrite the supplied logo.
// iOS requires a square, opaque PNG. The logo sits on its own sky-to-meadow gradient
// (wolfari-icon-background.png, sampled from the logo's edges), so the artwork reaches
// the tile edges and the OS mask is the only rounding: no mint frame, no double corner.
const fullBleed = await compositeImagesAsync({
  foreground: await resizeLogo(iconSize),
  background: await readFile(join(assetsDirectory, "wolfari-icon-background.png")),
  x: 0,
  y: 0,
});
const flatPath = join(tmpdir(), `wolfari-app-icon-${process.pid}.png`);
await writeFile(flatPath, fullBleed);
const { source: appIcon } = await generateImageAsync({ projectRoot }, {
  src: flatPath, width: iconSize, height: iconSize, resizeMode: "cover", backgroundColor, removeTransparency: true,
});
await rm(flatPath, { force: true });
const splashIcon = await resizeLogo(iconSize);

// The entire rounded-square logo fits inside Android's central 66/108 safe circle.
// Padding belongs in the foreground asset; Expo resizes the full layer to 108dp.
const foregroundSize = 512;
const foreground = await resizeLogo(foregroundSize);
const background = await generateImageBackgroundAsync({
  width: iconSize,
  height: iconSize,
  backgroundColor: "transparent",
  resizeMode: "contain",
});
const adaptiveIcon = await compositeImagesAsync({
  foreground,
  background,
  x: (iconSize - foregroundSize) / 2,
  y: (iconSize - foregroundSize) / 2,
});

for (const [filename, data] of [
  ["wolfari-app-icon.png", appIcon],
  ["wolfari-adaptive-foreground.png", adaptiveIcon],
  ["wolfari-splash-icon.png", splashIcon],
]) {
  await writeFile(join(assetsDirectory, filename), data);
  console.log(`Exported assets/images/${filename}`);
}
