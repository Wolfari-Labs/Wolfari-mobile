import assert from 'node:assert/strict';
import { test } from 'node:test';
import { avatarLetter } from '../src/features/finance/avatar-letter.ts';

test('avatar shows the first letter of the given name (last word)', () => {
  assert.equal(avatarLetter('Huỳnh Bảo Quyên'), 'Q');
  assert.equal(avatarLetter('Demo owner'), 'O');
  assert.equal(avatarLetter('  Trần   Thị   Hà  '), 'H');
  assert.equal(avatarLetter('Bạn'), 'B');
  assert.equal(avatarLetter('đức'), 'Đ');
});

test('words are split on whitespace, not on the letter "s"', () => {
  // Regression: a lost backslash once turned /\s+/ into /s+/.
  assert.equal(avatarLetter('Thomas Sang'), 'S');
  assert.equal(avatarLetter('Demo holder'), 'H');
});

test('empty names fall back to a question mark', () => {
  assert.equal(avatarLetter(''), '?');
  assert.equal(avatarLetter('   '), '?');
});
