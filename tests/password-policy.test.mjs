import assert from "node:assert/strict";
import test from "node:test";
import { validateLogin, validateRegistration } from "../src/features/auth/validation.ts";
import { passwordError } from "../src/features/auth/account-validation.ts";

for (const character of ["a", "😀"]) {
  for (const length of [7, 8, 128, 129]) {
    test(`registration and password recovery agree for ${length} code points (${character})`, () => {
      const password = character.repeat(length);
      const accepted = length >= 8 && length <= 128;
      const result = validateRegistration("Demo", "demo@example.test", password, password);
      assert.equal(!result.password, accepted);
      assert.equal(!passwordError(password, password), accepted);
    });
  }
}
test("login preserves existing passwords; confirmation compares exact whitespace and Unicode", () => {
  assert.deepEqual(validateLogin("demo@example.test", "old"), {});
  assert.ok(passwordError(" Wolfari1", "Wolfari1"));
  assert.ok(passwordError("é".repeat(8), "e\u0301".repeat(8)));
});
