import assert from "node:assert/strict";

/** Inspect visible text and screen-reader labels; route/DOM keys stay internal. */
export async function assertPublicText(page) {
  const text = await page.locator("body").innerText();
  const labels = await page.locator("[aria-label]:visible").evaluateAll(nodes =>
    nodes.map(node => node.getAttribute("aria-label")).join("\n"));
  const visible = text + "\n" + labels;
  assert.doesNotMatch(visible, /\b[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\b/i, "Internal UUID exposed to the user");
  assert.doesNotMatch(visible, /\b[A-Z][A-Z\d]*(?:_[A-Z\d]+)+\b/, "Internal code exposed to the user");
  assert.doesNotMatch(visible, /Mã đối chiếu:|Bạn đồng hành #[\da-f]+|Phiên bản \d+/i);
}
