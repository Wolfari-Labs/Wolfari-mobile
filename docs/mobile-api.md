# Mobile API integration

All endpoints below are relative to the existing Gateway URL ending in `/api/v1`.
See [Expo Go over Wi-Fi](expo-go.md) for networking and the development LAN bridge.

| Screen / flow | Gateway endpoints | Behavior |
| --- | --- | --- |
| Register / login / restore | `POST /auth/register`, `/auth/login`, `/auth/refresh` | Registration returns 202 without login; native refresh token in SecureStore |
| Home / My trips | `GET /trips?lifecycle=&limit=&cursor=` | Actual data, four lifecycle filters, pagination, loading/error/empty/retry |
| Create trip | `POST /trips` | Name, description, Vietnam timezone, validated dates; client_request_id equals Idempotency-Key |
| Overview / itinerary | `GET /trips/:id`, `GET /trips/:id/plan` | Actual activities, packing counts, descriptions and permissions |
| Activities | `POST /trips/:id/activities`, `PATCH/DELETE .../activities/:activityId`, `PATCH .../completion` | Add/edit/delete/complete, scheduled/unscheduled, overnight dates, expected plan version |
| Reorder itinerary | `PUT /trips/:id/activities/order` | All activity IDs in one atomic, versioned order; explicit group save, no time shifts |
| Places | `GET /travel/places?trip_id=&q=` and plan selected locations | Actual coordinates, native map, external maps, provider attribution/stale/mock metadata |
| Members | `GET /trips/:id/members` | All pages; own profile name and short user IDs for others (endpoint does not return names) |
| Invite | `GET/POST /trips/:id/invitations`, `POST .../:invitationId/resend`, `POST .../:invitationId/revoke` | Owner controls, email validation, revision/version checks, revoke confirmation |
| Respond to invite | `POST /invitations/preview`, `/invitations/accept`, `/invitations/decline` | Paste token or fragment link, preview before responding, memory-only pending token through login |
| Plan permissions | `PUT /trips/:id/plan-policy` | Owner chooses OWNER_ONLY or ALL_MEMBERS; existing SELECTED_MEMBERS displayed without inventing its editor list |
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

## Client behavior

- Native sends `X-Client-Type: mobile`, Bearer tokens and no cookies. Refresh token
  uses SecureStore; access token/profile remain in memory.
- Web keeps HttpOnly refresh cookies and CSRF. No token in localStorage.
- Concurrent refreshes share one request. Authenticated 401 gets one refresh/retry
  with the same operation ID.
- Writes carry UUID Idempotency-Key and backend revisions. A lost/503 response
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

`npm run lint`, `npm run typecheck`, `npm test` cover contracts, session races,
date/timezone/DST validation, idempotency/revisions, pagination and bridge boundaries.
`npm run test:ui`, `npm run test:ui:trips` and `npm run test:ui:order` cover auth,
password toggles, trip workflows, repeated pointer drag/drop, long-list auto-scroll,
two-editor conflicts, lost-response retries and revoked permissions using
contract fixtures. They do not send email or create real backend trips. Screenshots
are in `.cache/visual/`. Native Maps, SecureStore and Wi-Fi still require a physical
phone check in Expo Go, as do native Liquid Glass, touch dragging and screen readers.

`npm run test:backend -- --auth --trips` checks the current Trip, Plan, members,
invitations and Travel search against the real Gateway. Add `--seed-demo` to create
or reuse the clearly labelled “Đà Nẵng · Expo Go” demo and verify activity writes,
idempotency, revision conflicts, completion/deletion, and a temporary LINK invitation.
The temporary activity and invitation are cleaned up; one demo Trip/activity remains.
No email is sent by this check. `npm run test:ui:backend` opens the real app without
API fixtures and checks those demo screens; credentials stay in the local env file.
