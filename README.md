# Wolfari Mobile

Wolfari Mobile is the mobile application for the **Wolfari** platform.

**Chạy trên máy mới:** xem [hướng dẫn Backend + Mobile từ đầu](docs/local-setup.md)
(cài công cụ, khởi tạo database, cấu hình môi trường, 3 terminal và xử lý lỗi Wi-Fi).

It provides a mobile experience for users to access Wolfari's travel features, manage trips, explore travel information, track expenses, and interact with other Wolfari services.

## Tech Stack

- Expo SDK 58 / Expo Router
- React Native / TypeScript
- NativeWind 4 / Reanimated 4 / Skia 2

Use Node.js 22.13+ (22.x), 24.3+ (24.x), or 26+. After the SDK 58 upgrade,
clear Metro's cache and use a matching Expo Go version or rebuild your native
client. See [SDK 58 migration and verification](docs/sdk-58-upgrade.md).

## Project Status

### Interactive trip preview

Choose **Khám phá chuyến đi mẫu** on the welcome or Explore screen to try packing,
dress codes, group-fund states and trip details without a backend or sign-in.
This isolated `/demo-trip` preview uses fictional, in-memory data only; it does
not sync a group or perform payments. See [the preview guide](docs/trip-demo.md).

🚧 **Under Development**

The project is currently in the early development stage. The architecture, folder structure, and technical implementation may change as the project evolves.

The mobile screens follow the Wolfari Figma mobile design and use the current
API Gateway contracts: authentication, trip list/create/update, itinerary,
activity create/edit/complete/delete, place search, members, invitations,
plan permissions, profile updates and session revocation.
Additional Gateway flows include password recovery/change, email verification,
avatar upload/removal, LINK invitations, selected-editor permissions and member
history. Leave/remove-member screens track asynchronous operation receipts; the
backend now has Trip–Finance obligation checks but its lifecycle flag remains off
by default. Mobile persists lookup receipts across restarts and links financial
blockers to the group fund. See [Finance integration](docs/mobile-finance.md).

The current mobile UI follows **D · Pastel mềm 3D**: a blue/lilac/mint canvas,
opaque rounded clay surfaces, local Nunito fonts, exported Figma artwork and
blue-to-mint actions. Guest, authentication, Home, My Trips, overview and the
demo share the existing NativeWind/StyleSheet theme; see
[design D implementation and QA](docs/mobile-design-d.md) for coverage and differences.
Existing native sheets/date pickers, keyboard avoidance, measured tab clearance
and reduced-motion behavior remain. Skia is not loaded for Home/My Trips decoration.

Cold launch now uses a matching native/animated mascot splash, with a short
Reanimated orbit and fade, bounded auth waiting and accessibility fallbacks.
The original mascot asset is reused; the app icon is unchanged. Native splash
configuration requires a new build. See the [splash guide](docs/mobile-splash.md)
for timing, tests and release-device QA.

Login and registration have independent password visibility controls, hidden by
default and reset when the app goes into the background. In an itinerary, choose
**Sắp xếp lịch trình**, drag the handles (or use the up/down buttons), then
**Lưu thứ tự cho nhóm**. Reordering changes only the selected day's order, not
its times or other days. One versioned, idempotent request applies the full order;
concurrent edits preserve the local draft and require an explicit reload instead
of overwriting another member. The editor checks for updates every 15 seconds
while foregrounded and not dragging; this is polling, not live presence/WebSocket sync.

Finance and Price Watch now call the real Gateway. Fund setup, destinations,
contributions, expenses, refunds, outside-fund notes, ledger, closure snapshots,
member audit history and Sandbox payment commands are connected. Price Watch has
create/edit/pause/resume/stop, per-user thresholds, observation history and stale
source labels. The provider remains `MOCK_FLIGHT`, not live airline prices.
Private drafts remain available from separate links; they never alter server balances.
Export and notification-preference integration are outside this increment.

See [Finance / Price Watch coverage and verification](docs/finance-price-watch-mobile.md)
and [Windows + iPhone demo, step by step](docs/iphone-finance-demo.md).

Run on your phone with **Expo Go over Wi-Fi**, without USB debugging:

```powershell
# Start the backend separately, then keep these two terminals open:
npm.cmd run dev:gateway
npm.cmd run start:go
```

Scan the QR code with Expo Go on the same Wi-Fi. Leave `EXPO_PUBLIC_API_URL`
empty to use the Expo host IP and the development bridge on port 3001.

- [Expo Go setup and troubleshooting (Vietnamese)](docs/expo-go.md)
- [API coverage and automated checks](docs/mobile-api.md)

With the configured local test account, verify real Gateway integration and create
or reuse the Expo Go demo Trip:

```powershell
npm.cmd run test:backend -- --auth --trips --seed-demo
npm.cmd run test:ui:backend
```

The second command checks actual app screens without API fixtures. Place search
requires the Geoapify key configured privately in the backend; the app offers
manual activity entry while that provider is unavailable.

## Wolfari Ecosystem

Wolfari is developed as a multi-platform system consisting of:

- **Wolfari Backend** — Backend services and APIs
- **Wolfari Web** — Web application
- **Wolfari Mobile** — Mobile application

## License

This project is part of the Wolfari ecosystem.
