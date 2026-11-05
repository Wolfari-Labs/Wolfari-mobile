import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

// NativeWind's native style resolver flattens functions instead of passing them
// through to Pressable. Web-only screenshots do not catch that regression.
function unsafeCallbacks(source, fileName) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const pressables = new Set();
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== "react-native") continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const binding of bindings.elements) {
        if ((binding.propertyName ?? binding.name).text === "Pressable") pressables.add(binding.name.text);
      }
    }
  }
  const failures = [];
  function visit(node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && pressables.has(node.tagName.getText(file))) {
      const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
      const attribute = name => attributes.find(item => item.name.getText(file) === name);
      const style = attribute("style")?.initializer;
      if (style && ts.isJsxExpression(style) && style.expression &&
          (ts.isArrowFunction(style.expression) || ts.isFunctionExpression(style.expression))) {
        const interop = attribute("cssInterop")?.initializer;
        const optedOut = interop && ts.isJsxExpression(interop) && interop.expression?.kind === ts.SyntaxKind.FalseKeyword;
        if (!optedOut || attribute("className")) {
          failures.push(`${fileName}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return failures;
}

test("the guard rejects the original missing-style bug and className on opted-out controls", () => {
  const prefix = 'import { Pressable } from "react-native";';
  const style = 'style={({ pressed }) => [{ minHeight: 52 }, pressed && { opacity: 0.8 }]}';
  assert.equal(unsafeCallbacks(`${prefix}<Pressable ${style} />`, "button.tsx").length, 1);
  assert.equal(unsafeCallbacks(`${prefix}<Pressable cssInterop={false} className="p-4" ${style} />`, "button.tsx").length, 1);
  assert.deepEqual(unsafeCallbacks(`${prefix}<Pressable cssInterop={false} ${style} />`, "button.tsx"), []);
  assert.deepEqual(unsafeCallbacks(`${prefix}<Pressable className="p-4" />`, "tabs.tsx"), []);
});

test("all callback-styled native pressables bypass NativeWind without losing their styles", async () => {
  const root = new URL("../src/", import.meta.url);
  const files = (await readdir(root, { recursive: true })).filter(name => name.endsWith(".tsx"));
  const failures = (await Promise.all(files.map(async name =>
    unsafeCallbacks(await readFile(new URL(name.split(path.sep).join("/"), root), "utf8"), name)
  ))).flat();
  assert.deepEqual(failures, [], "Use cssInterop={false} and StyleSheet-only styles on these controls");
});
