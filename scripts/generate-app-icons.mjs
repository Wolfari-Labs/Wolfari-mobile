import { writeFile } from "node:fs/promises";
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
// iOS requires a square, opaque PNG. Use mint instead of restoring a white border.
const appIcon = await resizeLogo(iconSize, { backgroundColor, removeTransparency: true });
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
