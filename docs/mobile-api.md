# Mobile API integration

All endpoints below are relative to the existing Gateway URL ending in `/api/v1`.
See [Expo Go over Wi-Fi](expo-go.md) for networking and the development LAN bridge.

| Screen / flow | Gateway endpoints | Behavior |
| --- | --- | --- |
| Register / login / restore | `POST /auth/register`, `/auth/login`, `/auth/refresh` | Registration returns 202 without login; native refresh token in SecureStore |
| Password recovery | `POST /auth/password-reset-requests`, `/auth/password-resets` | Generic anti-enumeration response; paste email link/token; validate 15–128 Unicode characters and confirmation; clear local session after reset |
| Password change | `POST /me/password-change` | Current/new password; credential 401 does not trigger a refresh/replay; backend revokes all sessions, then mobile returns to sign-in |
| Email verification | `POST /auth/email-verifications`, `/auth/email-verifications/confirm` | Authenticated resend, public token confirmation, refresh own profile; links parsed locally and never fetched |
| Avatar | `POST/GET /me/avatar`, `PATCH /me` | System image picker, JPEG/PNG up to 10 MB/40 MP, multipart upload then versioned profile save, preview/remove; private image fetched with auth into memory |
| Home / My trips | `GET /trips?lifecycle=&limit=&cursor=` | Actual data, four lifecycle filters, pagination, loading/error/empty/retry |
| Create trip | `POST /trips` | Name, description, Vietnam timezone, validated dates; client_request_id equals Idempotency-Key |
| Overview / itinerary | `GET /trips/:id`, `GET /trips/:id/plan` | Actual activities, packing counts, descriptions and permissions |
| Activities | `POST /trips/:id/activities`, `PATCH/DELETE .../activities/:activityId`, `PATCH .../completion` | Add/edit/delete/complete, scheduled/unscheduled, overnight dates, public description, attach/detach existing selected location, expected plan version |
| Reorder itinerary | `PUT /trips/:id/activities/order` | All activity IDs in one atomic, versioned order; explicit group save, no time shifts |
| Places | `GET /travel/places?trip_id=&q=` and plan selected locations | Actual coordinates, native map, external maps, provider attribution/stale/mock metadata |
| Members | `GET /trips/:id/members?include_left=` | All pages; active/history filters; own profile name and short user IDs for others (endpoint does not return names) |
| Leave/remove member | `POST /trips/:id/leave`, `DELETE /trips/:id/members/:memberId`, `GET /operations/:operationId` | Confirmation/reason, role checks, frozen idempotency key/body/revision on uncertain reply; foreground polling, success only for SUCCEEDED + COMMITTED; backend feature remains disabled by default |
| Invite | `GET/POST /trips/:id/invitations`, `POST .../:invitationId/resend`, `POST .../:invitationId/revoke` | Owner controls, EMAIL/LINK creation, one-time link shown for manual sharing, revision/version checks, revoke confirmation |
| Respond to invite | `POST /invitations/preview`, `/invitations/accept`, `/invitations/decline` | Paste token or fragment link, preview before responding, memory-only pending token through login |
| Plan permissions | `PUT /trips/:id/plan-policy` | OWNER_ONLY, ALL_MEMBERS, SELECTED_MEMBERS with real active membership IDs; explicit confirmation replaces the editor list because the current read API does not return it |
| Edit trip | `PATCH /trips/:id` | Name, group/public descriptions, plan/export revisions |
| Packing / dress code | `GET /trips/:id/plan` | Read-only shared data, packing filters, P15 modal when actual items are all complete |
| Edit profile | `GET/PATCH /me` | Actual profile/version, 150-character name limit |
| Sessions | `GET /me/sessions`, `DELETE /me/sessions/:id` | All pages, explicit revocation, real session IDs without invented device names |

The create API has no destination, cover, member-count or budget fields. The form
saves supported fields only. Trip pictures are bundled Figma illustrations.
Provider search IDs are not selected-location UUIDs: search results can prefill
activity title/note; existing selected locations attach using actual Trip IDs.

## Backend gaps

The inspected Gateway has no mutation endpoints for packing/dress code and no
public finance, fare-tracking, export/share, notification-preference, archive,
trip-delete or ownership-transfer routes. The app does not simulate successful
saves or call speculative endpoints. Packing/dress code stay read-only, and
future tools are marked as coming later.

### Source audit — 2026-10-18

Compared the sibling `Wolfari-backend/apps/api-gateway/src/{identity,trip,plan,invitation,membership}-proxy.ts`
against mobile and checked Identity controller/service/avatar validation plus the
membership lifecycle handoff. Backend source/configuration were not modified.

- Membership lifecycle is Trip-side implementation only. The backend defaults to
  `TRIP_MEMBERSHIP_LIFECYCLE_ENABLED=false` and explicitly requires Finance/shared
  protocol readiness before enabling it for real users. Mobile implements the
  contract, not that missing dependency. A 503 is not reported as success.
- Pending membership requests keep the same key, reason and revision in memory
  across navigation during the current app process. They are not an offline queue
  and do not survive an app restart; the UI shows the operation ID to retain.
- Current-session logout cannot safely infer `refresh_sessions.id` from JWT `sid`.
  Local sign-out remains local; session management revokes actual IDs with DELETE.
  The alternative POST `/auth/logout` takes that same server session ID and is not
  treated as a current-session discovery API.
- Existing mobile place search targets `/travel/places`, but the inspected sibling
  Gateway source does not currently route that path. Do not infer working search
  from a UI fixture; verify the deployed Gateway/provider separately. Manual
  activity entry and viewing plan locations remain available.

## Client behavior

- Native sends `X-Client-Type: mobile`, Bearer tokens and no cookies. Refresh token
  uses SecureStore; access token/profile remain in memory.
- Web keeps HttpOnly refresh cookies and CSRF. No token in localStorage.
- Concurrent refreshes share one request. Authenticated 401 gets one refresh/retry
  with the same operation ID, except password-change credential failures.
- Trip writes carry UUID Idempotency-Key and backend revisions. A lost/503 response
  retains the key for the same intent; duplicate in-flight submissions are blocked.
- A 409 keeps the form draft and offers reload before another submission.
- Resources reload on focus/pull-to-refresh. Older requests abort; permission
  flags gate edits/completion. Provider metadata stays with search results.
- Passwords start hidden. Login, registration and confirmation each have an
  accessible show/hide control; backgrounding the app hides them again.
- Sign out clears the local session. The Sessions screen revokes actual server
  session IDs; JWT sid is never treated as a refresh_sessions.id.

### Collaborative itinerary ordering

The editor opens a fresh plan and lets authorized editors drag within a day
(including the unscheduled group), with up/down controls as an accessible alternative.
Open **Sắp xếp lịch trình** or hold an activity card for 400 ms (a normal tap still
opens details). Hold its 48-point **☰** grip for 250 ms, then drag up/down and release.
Swipe the title area to scroll normally; moving the grip before the hold delay does
not reorder. The active row follows the finger, the destination position is shown,
and dragging near an edge auto-scrolls long days. At least two activities and edit
permission are required to open the editor.

Dragging uses the existing Gesture Handler/Reanimated dependencies; modal content
has its own gesture root for Android. Save/close/swipe dismissal are blocked during
a drag. Gesture cancellation, a second finger, backgrounding, focus loss or layout
changes cancel the current drag without changing the draft. Completed earlier
reorders remain until saved or explicitly discarded. No dependency or API change
is needed for this interaction.

The preview is local until the user selects **Lưu thứ tự cho nhóm**. Changing the
order does not change `starts_at`/`ends_at`, shift days or reschedule appointments.
The screen displays backend `position` order, so time labels can be nonchronological.

The request includes `activity_ids` for **every activity in the trip**,
`expected_plan_version` and a UUID `Idempotency-Key`. Only the selected day's slots
are replaced. The existing backend validates permissions, the full permutation
and the revision under a transaction; no backend changes are required.

While the editor is open, foreground polling runs every 15 seconds and on app
resume (paused while dragging or saving). A clean editor adopts the latest plan;
a dirty editor preserves its draft and blocks saving if the plan or permissions
changed. A 409/permission failure also blocks overwrites and offers an explicit
discard-and-reload. Closing a dirty draft requires confirmation. Read-only members
cannot reorder. The ordinary itinerary view still refreshes on focus/pull-to-refresh;
there is no WebSocket presence, edit lock or automatic draft merge.

An uncertain/lost save response freezes the draft and retries the same body,
version and idempotency key. If the editor is closed in this state, its warning
explains that the request may already have succeeded; reopening loads the server
state. There is no offline write queue or persisted draft.

## Checks

`npm run test:ui:features` uses contract fixtures (no real emails or backend writes)
for recovery, email verification, password change/credential-401 handling, avatar
upload, LINK invitations, selected-editor confirmation, member history, uncertain
request replay, asynchronous completion and Finance blocking. Screenshots are in
`.cache/visual/backend-features/`. Native image picking and multipart upload still
need a physical Android/iOS check.

`npm run lint`, `npm run typecheck`, `npm test` cover contracts, session races,
date/timezone/DST validation, idempotency/revisions, pagination and bridge boundaries.
`npm run test:ui`, `npm run test:ui:trips` and `npm run test:ui:order` cover auth,
password toggles, trip workflows, card long-press, browser touch and repeated pointer
drag/drop, quick-swipe/cancel/multitouch/background/resize guards, long-list auto-scroll,
two-editor conflicts, lost-response retries and revoked permissions using
contract fixtures. They do not send email or create real backend trips. Screenshots
are in `.cache/visual/`. Native Maps, SecureStore and Wi-Fi still require a physical
phone check in Expo Go, as do native Liquid Glass, touch dragging and screen readers.
For native drag QA, check Android/iOS modal gestures, ordinary list scrolling,
dragging at both scroll edges, screen rotation, app background/resume and TalkBack/
VoiceOver arrow controls. Browser touch emulation is not physical-device coverage.

`npm run test:backend -- --auth --trips` checks the current Trip, Plan, members,
invitations and Travel search against the real Gateway. Add `--seed-demo` to create
or reuse the clearly labelled “Đà Nẵng · Expo Go” demo and verify activity writes,
idempotency, revision conflicts, completion/deletion, and a temporary LINK invitation.
The temporary activity and invitation are cleaned up; one demo Trip/activity remains.
No email is sent by this check. `npm run test:ui:backend` opens the real app without
API fixtures and checks those demo screens; credentials stay in the local env file.
