import assert from "node:assert/strict";
import test from "node:test";
import { groupAccount } from "../src/features/finance/account-format.ts";

test("account numbers are grouped in threes with a longer lead group", () => {
  assert.equal(groupAccount("0866706255"), "0866 706 255");
  assert.equal(groupAccount("0012345678"), "0012 345 678");
  assert.equal(groupAccount("19036781234018"), "19036 781 234 018");
  assert.equal(groupAccount("123456789"), "123 456 789");
  // Short or non-numeric identifiers are shown as typed.
  assert.equal(groupAccount("ABC123"), "ABC123");
  assert.equal(groupAccount("12345"), "12345");
});
