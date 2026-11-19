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

test("month grid starts on Monday and covers leap Februaries", async () => {
  const { monthCells } = await import("../src/shared/ui/date-time-values.ts");
  const november = monthCells(2026, 10);
  assert.equal(november.indexOf(1), 6, "1/11/2026 is a Sunday");
  assert.equal(november.at(-1), 30);
  assert.equal(monthCells(2028, 1).at(-1), 29);
  assert.equal(monthCells(2027, 1).at(-1), 28);
});

test("minimum picker date accepts only real DD/MM/YYYY days", async () => {
  const { minimumPickerDate } = await import("../src/shared/ui/date-time-values.ts");
  assert.equal(minimumPickerDate("12/11/2026")?.toISOString(), "2026-11-12T12:00:00.000Z");
  for (const invalid of [undefined, "", "31/02/2026", "2026-11-12", "1/1/2026"])
    assert.equal(minimumPickerDate(invalid), undefined);
});

test("money input keeps raw digits and groups thousands for display", async () => {
  const { groupMoney, moneyDigits, moneyWords } = await import("../src/shared/ui/money-input.ts");
  assert.equal(moneyDigits("1.500.000 ₫"), "1500000");
  assert.equal(moneyDigits("12345", 3), "123");
  assert.equal(groupMoney("1500000"), "1.500.000");
  assert.equal(groupMoney("0"), "0");
  assert.equal(groupMoney(""), "");
  assert.equal(moneyWords("1500000"), "1,5 triệu");
  assert.equal(moneyWords("250000"), "250 nghìn");
  assert.equal(moneyWords("999"), undefined);
});
