# Mobile Finance and membership integration

Implemented on `feat/mobile-trip-finance-membership` (renamed from
`feat/mobile-trip-features` without rebasing or replacing its commits).
Contracts were read from the sibling backend Gateway and Finance source on
2026-10-28. Backend files/configuration were not changed.

## Entry points

Trip → Tools → **Quỹ nhóm** opens `/trip/[id]/fund`.
Members → **Xóa …** and Settings → **Rời chuyến đi** use the shared durable
operation receipt flow. **Kiểm tra quỹ và nghĩa vụ** opens the fund after a blocker.
The old local estimates remain at `/trip/[id]/fund-drafts` with their existing
storage keys; they are never migrated into real transactions automatically.
`/demo-trip/fund` remains fictional, in-memory and independent of the Finance API.

## Implemented flows

| Area | Mobile behavior |
| --- | --- |
| Setup | Owner selects active Holder, optional budget, VietQR bank/account/name; initial balance comes from backend |
| Destinations | Owner adds/edits/enables/disables, sets the edited/added account as default; Holder separately confirms active accounts |
| Summary | Current balance, reserved refunds, available balance, budget, status and Finance revision; no optimistic balance math |
| Contributions | Owner creates an equal-per-selected-member request and can edit individual pending amounts, waive/cancel; Self reports transfer with optional image; Holder confirms, rejects or reverses |
| Expenses | Active members create server drafts; Creator/Owner edits/deletes/submits; Creator withdraws; Holder confirms actual paid date/method, rejects or reverses |
| Refunds | Owner creates reservations/cancels; Holder reports paid; recipient confirms receipt/nonreceipt; Holder requests reversal, recipient consents, Holder reverses with the same reason |
| Ledger | Cursor pages of server IN/OUT/reversal entries, sequence, amount and balance-after; original entries are never removed |
| Closure | Owner requests zero-balance closure; view frozen snapshot and confirmation progress; each required user confirms the exact hash; Owner cancels/reminds |
| Membership | Owner removes active non-Owner members; members leave with reason/revision; Finance blockers are explained; only server COMMITTED result is completion |

Roles are not interchangeable: Owner is not implicitly Holder; plan-edit
permissions are unrelated to Finance permissions. UI gates provide guidance;
the backend is authoritative for membership, available balances, versions and
payment/closure locks. Closed/archived funds expose reads only.

## Monetary and operation safety

- VND remains a decimal string up to PostgreSQL int64 max. Validation/formatting
  do not coerce to JavaScript Number or round amounts. Zero budget differs from
  no budget; contributions/expenses/refunds require positive amounts.
- Every mutation has an explicit review/confirmation step, UUID Idempotency-Key
  and the exact required entity/Finance revision. Closure confirmation uses the
  snapshot hash instead of inventing version fields.
- One local operation lock spans Finance and membership for a Gateway/account/trip.
  Persisting its lookup receipt must succeed **before** issuing a write.
- Authenticated clients are bound to the initiating account. Switching accounts
  while obtaining/refreshing a token cannot replay the previous user's intent
  with the new account's credentials; late reads are likewise discarded.
- A 202 Operation is pending, never success. Foreground/focused polling runs every
  five seconds and on resume; manual lookup remains available for NEEDS_REVIEW.
  Reminder `{accepted:true}` means queued in backend, not notification delivery.
- An uncertain write can be retried with its identical frozen body and key while
  this app process lives. A denial during such replay cannot prove the original
  write never committed. No new write is allowed until a terminal result is known
  and the user acknowledges/reloads.
- AsyncStorage contains only operation/trip IDs, action kind/title, optional
  target membership ID and server outcome. It contains **no** auth tokens, bank
  fields, money, reason text or file object keys. Scope includes Gateway + account.
- After a restart, the app looks up the durable operation ID; it does not replay
  the lost request body or generate a new key. If no result exists (404) or storage
  cannot be read, writes stay blocked and the UI asks for support/lookup. There is
  intentionally no unsafe “forget unknown transaction” button. Backend operations
  remain recoverable even after leaving the trip, subject to its actor lookup rules.
- After success, reload authoritative server state; do not update balances locally.
  Errors retain the safe lookup ID; never infer bank payment from a screenshot/QR.

## Evidence and QR boundaries

JPEG/PNG evidence uses the existing Expo image picker; max 10 MiB and 10 million
pixels. Server performs final content validation. An optional image is uploaded
privately before the review step, then its key is attached to the business write.
An upload alone is not a posted transaction. The backend cleans unused staging
objects. Web blob previews are revoked on replace/close/unmount; no native file
is deleted. PDF selection/download UI is not implemented in this increment.

The Finance API client supports authenticated binary receipt download **if a
valid authorized object key is available**. Current public contribution and expense
projections omit that key (expense exposes only `receipt_available`), and there is
no evidence-discovery endpoint. Therefore mobile cannot open historic/shared
receipts from these lists; it says so explicitly. A backend follow-up should expose
an authorized record-scoped receipt read route or stable opaque evidence ID, not
make the storage bucket public.

VietQR is available only to the contributor for an eligible pending contribution.
The UI renders backend account/amount/reference, TEST label and warning. It does
not load the external image until the user consents to send these fields to Casso.
Host is constrained to `https://img.vietqr.io`; web images have `no-referrer`, native
image caching is disabled. No analytics/logging of QR URLs is added. TEST is **not**
a bank sandbox: real accounts may receive real transfers. No real transfer is part
of verification. The primary screen does not initiate MoMo payments. After the
Finance/Price Watch merge, **Công cụ quỹ mở rộng** provides explicit Sandbox-only
payment tools, outside-fund notes and audit/reconciliation views; see
[the integration matrix](finance-price-watch-mobile.md). Both fund screens and
membership changes share the same receipt-only operation lock described above.

Refund reversal reason is also absent from public projections. The UI asks the
Holder to re-enter the agreed reason and warns the recipient to check it with the
Holder; backend enforces the matching reason. This is a current contract limitation,
not a claim that the app can display hidden audit data.

## Environment and QA

Backend needs the current Gateway + Identity + Trip + Finance services, migrations,
database and receipt object storage. Local Trip config was observed with
`TRIP_MEMBERSHIP_LIFECYCLE_ENABLED=false`; demo configuration sets it to true.
Enable lifecycle only in the intended reviewed/test environment and restart Trip.
Mobile must not bypass the flag, run migrations or silently alter server settings.

Automated checks:

```powershell
$env:EXPO_OFFLINE='1'
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
# Start web separately: npm.cmd run web -- --port 8082
$env:WOLFARI_PREVIEW_URL='http://localhost:8082'
npm.cmd run test:ui:finance
npm.cmd run test:ui:features
npm.cmd run test:ui:parity
npm.cmd run test:ui:demo
```

Unit/contract tests cover exact int64 amounts, roles/state machines, strict request
payloads, timezones/DST, duplicate taps, 202/lost responses, immutable retry,
lookup scope, restart recovery, privacy and storage failures. Browser tests use
intercepted Gateway fixtures, not live services, and cover setup to closure plus
receipt upload, explicit QR consent, optimistic conflicts and 320px layouts.
Screenshots: `.cache/visual/finance/` and `.cache/visual/backend-features/`.

Still required before release: live isolated-backend E2E with distinct Owner,
Holder and member accounts; all blocker/recovery cases with the lifecycle flag;
physical Android/iOS picker/multipart, keyboard, native date/time modal, gestures,
screen-reader behavior, process-kill/restart and offline/resume. Fixture success
does not certify real backend deployment, bank transfer or notification delivery.
