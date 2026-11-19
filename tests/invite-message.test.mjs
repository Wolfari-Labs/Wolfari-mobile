import assert from "node:assert/strict";
import test from "node:test";
import { inviteMessage } from "../src/features/trips/model/invite-message.ts";
import { invitationToken, joinCode } from "../src/features/trips/utils.ts";

test("invite message carries the short code and instructions, never a link", () => {
  const text = inviteMessage({ tripName: "Đà Lạt", code: "K7PQ-4M2X", expiresLabel: "26/11/2026" });
  const lines = text.split("\n");
  assert.match(lines[0], /"Đà Lạt"/);
  assert.equal(lines[1], "Mã mời: K7PQ-4M2X");
  assert.match(text, /hết hạn 26\/11\/2026/);
  assert.doesNotMatch(text, /https?:|:\/\/|inv1_/);
});

test("join codes are normalized from what people type or paste", () => {
  assert.equal(joinCode("k7pq4m2x"), "K7PQ-4M2X");
  assert.equal(joinCode(" K7PQ - 4M2X "), "K7PQ-4M2X");
  assert.equal(joinCode("O1IL-ABCD"), "0111-ABCD");
  assert.equal(joinCode("K7PQ-4M2U"), undefined);
  assert.equal(joinCode("K7PQ4M2"), undefined);
  // A whole shared message still yields the code.
  const text = inviteMessage({ tripName: "Huế", code: "K7PQ-4M2X", expiresLabel: "01/12/2026" });
  assert.equal(invitationToken(text), "K7PQ-4M2X");
  // Legacy link tokens keep working.
  const token = `inv1_${"a".repeat(43)}`;
  assert.equal(invitationToken(`https://x.test/invitations/local#token=${token}`), token);
});
