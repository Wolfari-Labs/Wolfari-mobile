import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

async function rasterFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await rasterFiles(path));
    else if (/\.(png|jpe?g|webp|gif)$/i.test(entry.name)) files.push(path);
  }
  return files;
}

test("raster file extensions match their encoded format for Android resources", async () => {
  const files = await rasterFiles(join(root, "assets"));
  assert.ok(files.length > 0);
  for (const path of files) {
    const data = await readFile(path);
    const extension = extname(path).toLowerCase();
    const header = data.subarray(0, 8).toString("hex");
    const valid = extension === ".png"
      ? header === "89504e470d0a1a0a"
      : extension === ".jpg" || extension === ".jpeg"
        ? header.startsWith("ffd8ff")
        : extension === ".webp"
          ? data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP"
          : ["GIF87a", "GIF89a"].includes(data.toString("ascii", 0, 6));
    assert.ok(valid, `${relative(root, path)} has an incorrect image extension (${header})`);
  }
});

test("every bundled design asset resolves to an existing file", async () => {
  const source = await readFile(join(root, "src/shared/ui/design-assets.ts"), "utf8");
  const references = [...source.matchAll(/require\("@\/(assets\/[^"\n]+)"\)/g)];
  assert.ok(references.length > 0);
  for (const [, path] of references) await access(join(root, path));
});
