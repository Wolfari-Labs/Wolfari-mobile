import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = (name) => readFile(new URL(`../src/${name}`, import.meta.url), "utf8");

// Inspect style declarations without loading native modules in Node.
function stylesIn(text) {
  const file = ts.createSourceFile("view.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const styles = new Map();
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(file) === "StyleSheet.create") {
      const arg = node.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const prop of arg.properties) {
          if (ts.isPropertyAssignment(prop)) styles.set(prop.name.getText(file), prop.initializer.getText(file));
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return styles;
}

test("reading sections and navigation rows do not recreate nested cards", async () => {
  const styles = stylesIn(await source("shared/ui/journal.tsx"));
  for (const name of ["section", "record", "group", "link", "rowIcon", "empty"]) {
    assert.ok(styles.has(name), `${name} exists`);
    assert.doesNotMatch(styles.get(name), /backgroundColor|borderRadius|shadows\./, `${name} stays on the canvas`);
  }
  assert.match(styles.get("link"), /minHeight: 76/);
  assert.match(styles.get("record"), /borderBottomColor: colors.line/);
});

test("quiet actions retain accessible button semantics and a 44-point target", async () => {
  const button = await source("shared/ui/button.tsx");
  assert.match(stylesIn(button).get("text"), /minHeight: 44/);
  assert.match(button, /accessibilityLabel=\{accessibilityLabel \?\? label\}/);
  assert.match(button, /disabled=\{inactive\}/);
  assert.match(button, /cssInterop=\{false\}/);
  const overview = await source("features/trip-demo/overview-screen.tsx");
  assert.doesNotMatch(overview, /ui\.card/);
  assert.match(overview, /label="Chỉnh sửa chuyến đi mẫu"/);
  assert.match(overview, /setResetting\(true\)/);
  assert.match(overview, /ConfirmSheet/);
});

test("pastel overview keeps real demo values, editable cover and accessible tool tiles", async () => {
  const overview = await source("features/trip-demo/overview-screen.tsx");
  const styles = stylesIn(overview);
  assert.match(styles.get("hero"), /height: 200/);
  assert.match(styles.get("preparation"), /backgroundColor: colors.surface/);
  assert.equal((overview.match(/<StatTile /g) ?? []).length, 4);
  assert.match(overview, /details.coverUri \? \{ uri: details.coverUri \}/);
  assert.match(overview, /fundTotals\(state.entries\)/);
  assert.match(overview, /accessibilityLabel="Hành lý mẫu"/);
  assert.match(overview, /Không lưu lên máy chủ/);
});

test("edge-to-edge layout is opt-in and retains safe-area and keyboard handling", async () => {
  const screen = await source("shared/ui/screen.tsx");
  assert.match(screen, /immersive = false/);
  assert.match(screen, /!immersive && <View/);
  assert.match(screen, /insets.top \+ \(immersive \? 0 : headerHeight\)/);
  assert.match(screen, /webSafeArea\.content\(bottomPadding\)/);
  assert.match(stylesIn(screen).get("immersiveContent"), /paddingHorizontal: 0/);
  assert.match(await source("features/trip-demo/overview-screen.tsx"), /<Screen title=\{details.name\}/);
});

test("inline filters use a sliding pastel marker while keeping selected state and reduced-motion support", async () => {
  const journal = await source("shared/ui/journal.tsx");
  const styles = stylesIn(journal);
  assert.doesNotMatch(styles.get("segments"), /borderColor: colors.ink/);
  assert.match(styles.get("segmentPill"), /backgroundColor: colors.gradientBlue/);
  assert.match(journal, /colors=\{gradients.primary\}/);
  assert.match(styles.get("segment"), /minHeight: 44/);
  assert.match(journal, /accessibilityState=\{\{ selected: value === item.value \}\}/);
  assert.match(journal, /reduceMotion \? Math.max\(0, selectedIndex\)/);
});

test("trip previews use rounded clay cards but the overview is not a self-navigation button", async () => {
  const card = await source("features/trips/components/trip-card.tsx");
  assert.match(stylesIn(card).get("card"), /borderRadius: radii.cardLarge/);
  assert.match(stylesIn(card).get("card"), /shadows.card/);
  assert.match(card, /if \(!interactive\) return <View/);
  assert.match(card, /GlassSurface variant="subtle"/);
  assert.match(await source("features/trips/screens/trip-overview-screen.tsx"), /<TripCard trip=\{trip\} interactive=\{false\}/);
});
