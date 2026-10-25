# Mobile / Web feature parity

Implementation branch: feat/mobile-trip-tools-and-branding.
Only the Mobile repository changes. Existing shared-plan and account API contracts remain unchanged.

## Added

| Feature | Mobile behavior | Data boundary |
| --- | --- | --- |
| Trips | All/lifecycle counts, accent-insensitive name search, start-date sorting, cursor pagination | Filters/counts/sorting cover loaded pages; API list remains paginated |
| Create trip | Destination suggestions, 1–6 travelers, budget/person estimate, style/template, preset/custom cover preview; save/restore/discard draft | Only name, dates, timezone, description and existing idempotency identifier go to Gateway. Extras are draft-only. Custom photo is session-only, max 5 MB; no upload |
| Packing | Add/edit/delete, completion, assignee, category groups/filter/collapse, quantities, due date, reminder note | Starts from shared plan; edits are a private local copy. Reminder text is not a scheduled notification |
| Dress code | Trip/day/activity filters and draft editor, palette suggestions | Starts from shared plan; scope is checked against current trip days/activities |
| Fund | Expense/contribution/outside/refund drafts, projected totals, local change history, explicitly opt-in example balance | No finance API, no real balance, payments, confirmations, closure or automatic deductions |
| Payment QR | Camera scan or pasted VietQR payload, CRC/TLV validation, review and explicit field copying | Local-only account-transfer reader, no payment execution or verification, no scan history; see [payment-qr.md](payment-qr.md) |
| Price watch | One-way/round-trip request drafts, passenger/cabin/threshold validation, edit/delete/pause/resume, sample price history | No live provider polling, registration or price alerts. Sample observations are labeled and separate |
| Map | Private selection/hiding, manual candidates, schedule/day filters, native standard/satellite map, preserved provider attribution | Search requires the place-search endpoint in the client contract, currently unavailable in Backend. Manual candidates do not receive server UUIDs; only actual shared locations can be linked to real activity writes |
| Plan draft | Separate persistent private itinerary, cross-day assignment, title/time/note edits, selected map-place suggestions | Does not replace existing server-backed activity editing/reordering. A changed plan version/date range blocks editing the old draft until explicitly discarded |
| Shared itinerary ordering | Hold an activity to open sorting; hold ☰ to drag within the selected day, with target indicator, edge auto-scroll and accessible arrow buttons | Explicit group Save via existing versioned reorder API; no time/day changes. Interrupted gestures do not reorder; conflicts block overwrites. See [mobile-api.md](mobile-api.md#collaborative-itinerary-ordering) |

## Persistence and permissions

- AsyncStorage, schema version 1, isolated by user ID + trip ID + feature.
- Validated JSON, 30-day expiry, bounded payloads (500 items / 500,000 characters).
- Ordered writes/removals; loading/error states prevent accidental overwrite before hydration.
- Reloaded on screen focus; API shared-plan data stays the source of truth.
- Packing/dress drafts detect changed base content. Plan drafts detect changed shared plan version or trip dates/timezone.
- Plan permissions gate editing and completion. Authenticated screen state is remounted when account identity changes.
- Save failures remain visible and never report successful storage. Deletion of normal drafts requires confirmation.
- Local storage is not encrypted. Do not store banking credentials, real payment confirmations or sensitive identity documents in drafts.
- No cross-device sync or multi-tab conflict merging is provided.

## Verification

Run npm run typecheck, npm run lint -- --no-cache, npm test,
npm run test:ui:parity and npm run test:ui:trips.
Run npm run test:ui:order for drag/drop, gesture cancellation and collaborative-order checks.

UI suites run against the Mobile Expo web preview (http://localhost:8082 by default) with intercepted API fixtures. They must not be confused with test:ui:backend, which uses a real backend.

Native map interaction, image picker and persistence across process restarts should also be smoke-tested on a physical device before release.

SDK APIs checked against:

- https://docs.expo.dev/versions/v57.0.0/
- https://docs.expo.dev/versions/v57.0.0/sdk/async-storage/
- https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/
- https://docs.expo.dev/versions/v57.0.0/sdk/map-view/
