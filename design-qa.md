# Wolfari travel-editorial redesign — 2026-10-30

## Scope and reference

The user approved implementing directly in the existing mobile app after image
generation was unavailable. The agreed direction is travel editorial: destination
photography, a warm light canvas, strong hierarchy and restrained Liquid Glass.
This is a redesign, not a pixel-faithful recreation of an approved image.

Source visual baseline: `.cache/visual/motion/home-animated.png`,
`.cache/visual/m01-guest.png` and the existing native app. No new visual target was
generated; the image-selection/comparison requirement was explicitly waived.
There is therefore no claim of measured image-to-image fidelity.

## Rendered evidence

Screenshots were rendered inline in the task using Windows Computer Use and the
in-app browser. Exporting browser screenshots to `.cache/visual/editorial/` was
denied by the browser runtime; no saved screenshot file is claimed.

- Android emulator DailyBible_API35: native Home, My Trips, trip overview and
  sort sheet. The window capture was 394 × 882 pixels including desktop title
  chrome; it was reviewed as native visual QA, not normalized pixel comparison.
- Web at 402 × 874 CSS pixels: guest, sign-in, sign-in with `?preview=1`.
- Web at 320 × 720 CSS pixels: sign-in and sign-up. DOM verification confirmed
  document scroll width equals 320; inputs remain inside the viewport.
- At 402px, sign-in destination image measured exactly 354 × 148; all nine images
  (including preview status icons) loaded. No horizontal page overflow.

## Findings and iterations

1. Resolved P2: Home's no-upcoming-trip panel dominated the first viewport.
   Moved destination inspiration above the empty copy and made the create-trip
   section an open, compact layout. A second native capture showed the photograph,
   heading and primary CTA together without the oversized white panel.
2. Resolved P2: two persistent filter/sort bars delayed the trip list.
   Kept lifecycle filtering visible; moved date sort to an accessible sheet.
   Native screenshots confirmed the sheet, selected descending order, automatic
   dismissal and updated trigger label. Only local UI state was changed.
3. Resolved P1: web CSS hydration raised NativeWind's media-mode colorScheme error.
   Set Tailwind's dark mode strategy to class. Reloaded pages rendered normally;
   subsequent console inspection contained the earlier pre-fix entry, with no new
   occurrence in the inspected reloads.
4. Resolved P2: initial muted text was 4.45:1 against the warm canvas.
   Darkened the muted token and added AA contrast checks for text/action pairs.

## Required surfaces

- Typography: platform system font; 36/43 display, 28/36 title, 16/24 body,
  13/18 supporting copy. Vietnamese diacritics and 320px heading wraps inspected.
- Layout: consistent 24px page margin, open headings, image-led cards, reduced
  shadow duplication. Keyboard avoidance and measured tab/inset padding retained.
- Colors: cream canvas, forest-teal actions, dark ink. Text/primary combinations
  meet 4.5:1 in regression tests. Semantic error colors remain unchanged.
- Assets: existing Wolfari wordmark, destination photos and icon set reused.
  Native and web crops checked; no generated asset or fabricated icon introduced.
- Copy: Vietnamese app copy, preserved action labels and form validation.
  Demo remains explicitly labelled; no invented live trips or user data.
- Glass: iOS native availability checks and Reduce Transparency fallback retained;
  Android dock retains its separate blur target. Other Android controls use a
  translucent tint, not a claim of native Apple Liquid Glass.

## Verification

- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed.
- Unit/contract regression suite: 118 tests passed.
- `git diff --check`: passed (line-ending warnings only).
- Native navigation Home ↔ My Trips and sort-sheet selection verified.
- Web guest → sign-in → sign-up navigation verified without submitting accounts.
- Updated browser test expectations for the intentional photo and heading changes;
  automated Playwright suites were not rerun in this turn.

## Remaining checks

Physical iOS native-glass behavior, large system text, Reduce Motion/Transparency
device settings and full authenticated end-to-end regression remain release checks.
No backend schema, account, trip or financial data was changed for this redesign.
The final filter-empty-state capture was interrupted when the emulator session
closed; do not count that interaction as verified.

## Result

Manual redesign QA passed for the inspected states under the user's direct-build
exception. This is not a source-image fidelity certification.

final result: passed

## Follow-up: open-page layout (2026-10-30)

User requested direct implementation of the reviewed direction, without a Figma
step: remove excessive rounded content containers while retaining floating glass.

- Shared SectionLink/group/empty/notice surfaces now use spacing, plain icons and
  separators. `ui.card` remains available for bounded form and selection surfaces;
  reading content uses explicit `ui.section` and `ui.record` styles instead.
- Inline filters/navigation use animated underlines, including selected semantics
  and reduced-motion behavior. Dock, back control, photo chips and sheets retain
  the existing glass implementation and transparency fallbacks.
- Demo overview: title outside photo, compact edit action, unboxed metadata,
  avatars and progress, unified three-row utility list, quiet reset trigger.
- Demo packing/dress/fund and real trip overview/tools/packing/finance record
  surfaces use open sections. Trip previews on Home/My Trips no longer have a
  white outer card; photo corners remain softly rounded. Real overview no longer
  presents its own trip heading as a self-navigation button.
- No API, permissions, form validation, confirmation or mutation logic changed.

Validation for this follow-up:

- Lint, typecheck and 122 unit/contract tests passed; diff whitespace check passed.
- Manual browser QA: overview at 402x874 and 320x720; no horizontal page overflow
  at 320px, edit control measured 44px high. Edit route opens and returns without
  submitting. Packing “Chưa xong” filter removes completed items; fund “Chờ xử lý”
  filter shows two pending mock records. No financial action submitted.
- New `open-layout.test.mjs` guards unboxed reading styles, underline selection,
  accessible quiet actions and non-interactive overview heading.
- Native emulator/physical iOS and authenticated screens were not visually
  rechecked in this follow-up. Automated browser suites were not rerun.

## Follow-up: selective layered overview (2026-10-30)

The open-page version felt too sparse. The approved follow-up is scoped to the
demo trip overview: retain open content, but restore a small number of deliberate
surfaces and visual layers. Other trip screens remain unchanged in this iteration.

- Full-width cover photo with its title, destination and 44x44 glass navigation
  controls. A stronger photo gradient keeps the wrapped title readable at 320px.
- One overlapping glass summary holds date, budget and planned travelers; one
  softly tinted preparation group holds progress and three separated utility rows.
  Member initials and description stay directly on the page.
- Added opt-in `Screen.immersive`, disabled by default, retaining safe-area,
  keyboard, scroll, footer and dock behavior. Existing glass accessibility and
  platform fallbacks are reused. No data model, backend or mutation changes.

Validation for this follow-up:

- Typecheck, lint and 124 unit/contract tests passed.
- Manual browser QA at 402x874 and 320x720: inspected photo/summary overlap,
  wrapped title/member row and preparation/footer content. At 320px, page width
  equals viewport width; edit control measures 44x44px.
- Edit and packing routes open and return. Reset confirmation opens and cancels
  with "Giữ nguyên"; no edits, reset or backend actions submitted.
- Final inspected browser console contains no error entries. Screenshot saved as
  `C:/Users/thanh/.codex/visualizations/2026/10/30/01a18ad3-0d60-79c3-bbf1-0ad178dcbafe/layered-trip-overview.png`.
- Native emulator/physical iOS, system accessibility settings and authenticated
  screens were not rechecked. Automated browser suites were not rerun.
