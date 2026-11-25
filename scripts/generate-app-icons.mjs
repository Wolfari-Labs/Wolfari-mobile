// Regenerates every launcher, splash and favicon PNG from the Wolfari brand masters:
//   assets/brand/wolfi-mark.png      Wolfi bust (transparent, square)
//   assets/brand/icon-backdrop.png   1024 px launcher backdrop (compass halo, from icon-backdrop.svg)
// The notification stencil is drawn from scripts/brand/notification.svg (vector, kept as PNG).
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import imageUtils from "@expo/image-utils";
import { PNG } from "pngjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = join(root, "assets/images");
const master = join(root, "assets/brand/wolfi-mark.png");
const backdrop = join(root, "assets/brand/icon-backdrop.png");
const paper = "#EAF0FF";

async function resize(size, options = {}) {
  const { source } = await imageUtils.generateImageAsync({ projectRoot: root }, {
    src: master, width: size, height: size, resizeMode: "contain", ...options,
  });
  return source;
}

async function place(background, size, dy = 0) {
  const canvas = PNG.sync.read(background);
  return imageUtils.compositeImagesAsync({
    foreground: await resize(size), background, x: (canvas.width - size) / 2, y: (canvas.height - size) / 2 + dy,
  });
}

const save = (name, buffer) => writeFile(join(directory, `wolfari-${name}.png`), buffer);

function opaque(buffer) {
  const png = PNG.sync.read(buffer);
  return PNG.sync.write(png, { colorType: 2 });
}

/** White stencil: Wolfi's ink lines become the gaps that keep the face readable. */
function silhouette(buffer) {
  const png = PNG.sync.read(buffer);
  for (let offset = 0; offset < png.data.length; offset += 4) {
    const luminance = (png.data[offset] + png.data[offset + 1] + png.data[offset + 2]) / 3;
    if (luminance < 70) png.data[offset + 3] = 0;
    png.data.fill(255, offset, offset + 3);
    if (png.data[offset + 3] <= 1) png.data.fill(0, offset, offset + 4);
  }
  return PNG.sync.write(png);
}

const { source: backdropPng } = await imageUtils.generateImageAsync({ projectRoot: root }, {
  src: backdrop, width: 1024, height: 1024, resizeMode: "cover",
});
const transparent = await imageUtils.generateImageBackgroundAsync({
  width: 1024, height: 1024, backgroundColor: "transparent", resizeMode: "contain",
});
const paperSquare = await imageUtils.generateImageBackgroundAsync({
  width: 160, height: 160, backgroundColor: paper, resizeMode: "contain",
});

// 560 px keeps every visible pixel inside Android's 66/108 safe circle.
const adaptive = await place(transparent, 560);
await save("app-icon", opaque(await place(backdropPng, 860, 30)));
await save("adaptive-foreground", adaptive);
await save("adaptive-monochrome", silhouette(adaptive));
await save("splash-icon", await resize(456));
await save("avatar", opaque(await place(paperSquare, 144, 4)));
await save("favicon", await resize(64));
