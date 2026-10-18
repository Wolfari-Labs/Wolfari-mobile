import assert from "node:assert/strict";
import test from "node:test";
import { pickerText, pickerValue } from "../src/shared/ui/date-time-values.ts";

test("native date selection preserves the calendar day independent of device timezone", () => {
  const selected = pickerValue("29/02/2028", "date");
  assert.equal(selected.toISOString(), "2028-02-29T12:00:00.000Z");
  assert.equal(pickerText(selected, "date"), "29/02/2028");
  const today = new Date(2026, 9, 16, 23, 30);
  for (const invalid of [
    "31/02/2026",
    "29/02/2027",
    "01/13/2026",
    "",
    "01/01/1999",
  ]) {
    assert.equal(
      pickerText(pickerValue(invalid, "date", today), "date"),
      "16/10/2026",
    );
  }
});

test("native time selection preserves midnight, late hours and leading zeros", () => {
  for (const value of ["00:00", "08:05", "23:59"])
    assert.equal(pickerText(pickerValue(value, "time"), "time"), value);
  for (const invalid of ["24:00", "12:60", ""])
    assert.equal(pickerText(pickerValue(invalid, "time"), "time"), "08:00");
});
