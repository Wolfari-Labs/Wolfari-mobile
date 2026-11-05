import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID as secureUUID } from "node:crypto";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { ApiError } from "../src/shared/api/api-client.ts";

// Exercise our adapter/command closure with a fake native boundary. Device
// availability still needs Expo Go/a native build; Node cannot verify linking.
async function load(relativePath, dependencies) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  runInNewContext(outputText, { exports, require: name => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}

test("operation IDs use Expo core lazily, with no ExpoCrypto native module", async () => {
  let calls = 0;
  const { randomUUID } = await load("../src/shared/operations/operation-id.ts", {
    expo: { uuid: { v4: () => { calls++; return secureUUID(); } } },
  });
  assert.equal(calls, 0, "Importing a route must not invoke a native UUID method");
  const ids = new Set(Array.from({ length: 100 }, randomUUID));
  assert.equal(calls, 100); assert.equal(ids.size, 100);
  for (const id of ids) assert.match(id, /^[a-f\d]{8}(-[a-f\d]{4})-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i);
});

async function command(uuid) {
  const states = [];
  const { useCommand } = await load("../src/shared/hooks/use-command.ts", {
    "@/shared/operations/operation-id": { randomUUID: uuid },
    react: { useRef: value => ({ current: value }), useState: value => {
      const state = { value }; states.push(state); return [value, next => { state.value = next; }];
    } },
    "@/shared/api/api-client": { ApiError },
    "@/shared/api/errors": { errorMessage: error => error.message },
  });
  return { ...useCommand(), states };
}

test("UUID-generation errors unlock the command and never submit a write", async () => {
  let attempts = 0, writes = 0;
  const instance = await command(() => {
    if (++attempts === 1) throw new Error("Native UUID unavailable");
    return secureUUID();
  });
  const work = async () => { writes++; return "done"; };
  assert.equal(await instance.run({ action: "create" }, work), undefined);
  assert.equal(writes, 0);
  assert.equal(instance.states[0].value, false);
  assert.equal(instance.states[1].value, "Native UUID unavailable");
  assert.equal(await instance.run({ action: "create" }, work), "done");
  assert.equal(writes, 1);
});

test("uncertain command retry reuses its UUID; completed commands receive fresh IDs", async () => {
  const instance = await command(secureUUID), ids = [];
  await instance.run({ amount: "100" }, async key => { ids.push(key); throw new Error("Lost reply"); });
  await instance.run({ amount: "100" }, async key => { ids.push(key); });
  await instance.run({ amount: "100" }, async key => { ids.push(key); });
  assert.equal(ids[0], ids[1]); assert.notEqual(ids[1], ids[2]);
});

test("application routes no longer import expo-crypto", async () => {
  const root = new URL("../src/", import.meta.url);
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
      if (entry.isDirectory()) await inspect(url);
      else if (/\.tsx?$/.test(entry.name)) assert.doesNotMatch(await readFile(url, "utf8"), /["']expo-crypto["']/);
    }
  }
  await inspect(root);
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.dependencies["expo-crypto"], undefined);
});
