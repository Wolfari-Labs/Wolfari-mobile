import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { releaseCoverUrl } from "../src/features/trip-demo/cover-resource.ts";

test("demo feature has no API, persistent storage or payment dependency", async () => {
  const directory = new URL("../src/features/trip-demo/", import.meta.url);
  for (const file of await readdir(directory)) {
    if (!/\.tsx?$/.test(file)) continue;
    const source = await readFile(new URL(file, directory), "utf8");
    assert.doesNotMatch(
      source,
      /useApi|api-client|AsyncStorage|SecureStore|fetch\(|localStorage|PaymentQr/,
      file,
    );
  }
});

test("cover cleanup revokes browser object URLs, never native or remote files", (t) => {
  const revoke = t.mock.method(URL, "revokeObjectURL", () => {});
  for (const uri of [
    undefined,
    "",
    "file:///local/cover.jpg",
    "content://photos/1",
    "https://example.test/cover.jpg",
  ]) {
    releaseCoverUrl(uri);
  }
  assert.equal(revoke.mock.callCount(), 0);
  releaseCoverUrl("blob:demo-cover");
  assert.deepEqual(revoke.mock.calls[0].arguments, ["blob:demo-cover"]);
});
