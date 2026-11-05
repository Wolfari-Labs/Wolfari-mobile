import assert from "node:assert/strict";
import test from "node:test";
import { webSafeArea as native } from "../src/shared/ui/web-safe-area.ts";
import { webSafeArea as web } from "../src/shared/ui/web-safe-area.web.ts";

test("web safe areas are browser CSS values available during static rendering", () => {
  assert.equal(web.screen.paddingTop, "env(safe-area-inset-top, 0px)");
  assert.equal(web.screen.paddingLeft, "env(safe-area-inset-left, 0px)");
  assert.equal(web.screen.paddingRight, "env(safe-area-inset-right, 0px)");
  for (const key of ["footer", "tab", "sheetContent"]) {
    assert.match(web[key].paddingBottom, /env\(safe-area-inset-bottom, 0px\)/);
  }
  assert.match(web.splashTop.top, /safe-area-inset-top/);
  assert.match(web.splashBottom.bottom, /safe-area-inset-bottom/);
});

test("web scroll padding preserves screen-specific minimums", () => {
  assert.equal(web.content(126).paddingBottom, "max(126px, calc(env(safe-area-inset-bottom, 0px) + 24px))");
  assert.equal(web.content(32).paddingBottom, "max(32px, calc(env(safe-area-inset-bottom, 0px) + 24px))");
});

test("native never receives CSS-only styles or overrides its measured insets", () => {
  for (const value of Object.values(native)) {
    assert.deepEqual(typeof value === "function" ? value(126) : value, {});
  }
});
