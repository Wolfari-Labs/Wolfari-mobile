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

test("a group invitation shares the web link that opens on any phone, then the code", () => {
  const link = "https://wolfari.example/invitations#code=K7PQ-4M2X";
  const text = inviteMessage({ tripName: "Đà Lạt", code: "K7PQ-4M2X", expiresLabel: "26/11/2026", link, maxUses: 20 });
  const lines = text.split("\n");
  assert.equal(lines[1], `Mở lời mời: ${link}`);
  assert.equal(lines[2], "Mã mời: K7PQ-4M2X");
  assert.match(text, /tối đa 20 người, hết hạn 26\/11\/2026/);
  // Pasting the shared link (or the whole message) back into the app finds the code.
  assert.equal(invitationToken(link), "K7PQ-4M2X");
  assert.equal(invitationToken(text), "K7PQ-4M2X");
});

test("invitation cards label trip dates and group-link usage", async () => {
  const { tripDatesLabel, invitationUsesLabel, GROUP_LINK_USES } = await import("../src/features/trips/model/invitation-labels.ts");
  assert.equal(tripDatesLabel({ trip_start_at: "2026-12-20T01:00:00Z", trip_end_at: "2026-12-22T10:00:00Z" }), "20/12/2026 – 22/12/2026");
  assert.equal(tripDatesLabel({ trip_start_at: "2026-12-20T01:00:00Z", trip_end_at: "2026-12-20T09:00:00Z" }), "20/12/2026");
  assert.equal(tripDatesLabel({}), "");
  assert.equal(tripDatesLabel({ trip_start_at: "bad", trip_end_at: "2026-12-20T09:00:00Z" }), "");
  assert.equal(invitationUsesLabel({}), "Dùng 1 lần");
  assert.equal(invitationUsesLabel({ max_uses: 1, use_count: 0 }), "Dùng 1 lần");
  assert.equal(invitationUsesLabel({ max_uses: 20, use_count: 3 }), "Mã nhóm · 3/20 người đã vào");
  assert.ok(GROUP_LINK_USES >= 2 && GROUP_LINK_USES <= 50);
});
