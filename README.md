# Wolfari Mobile

Wolfari Mobile is the mobile application for the **Wolfari** platform.

It provides a mobile experience for users to access Wolfari's travel features, manage trips, explore travel information, track expenses, and interact with other Wolfari services.

## Tech Stack

- Expo SDK 57 / Expo Router
- React Native / TypeScript

## Project Status

🚧 **Under Development**

The project is currently in the early development stage. The architecture, folder structure, and technical implementation may change as the project evolves.

The mobile screens follow the Wolfari Figma mobile design and use the current
API Gateway contracts: authentication, trip list/create/update, itinerary,
activity create/edit/complete/delete, place search, members, invitations,
plan permissions, profile updates and session revocation.

The interface uses Liquid Glass floating controls, grouped cards, system typography,
native page sheets and system date/time pickers. Capable iOS 26+ devices use
`expo-glass-effect`; older iOS/web use blur, and Android uses a lightweight opaque
gradient fallback. Forms keep the save action
inside keyboard avoidance; tab spacing follows its measured height for larger
text. Reduce Motion and Reduce Transparency preferences are respected.
These modules are included in Expo Go.

Login and registration have independent password visibility controls, hidden by
default and reset when the app goes into the background. In an itinerary, choose
**Sắp xếp lịch trình**, drag the handles (or use the up/down buttons), then
**Lưu thứ tự cho nhóm**. Reordering changes only the selected day's order, not
its times or other days. One versioned, idempotent request applies the full order;
concurrent edits preserve the local draft and require an explicit reload instead
of overwriting another member. The editor checks for updates every 15 seconds
while foregrounded and not dragging; this is polling, not live presence/WebSocket sync.

Packing and dress code show the shared plan in read-only mode. Finance, fare
tracking, export and notification preferences await public Gateway APIs.

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
