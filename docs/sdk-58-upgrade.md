# Expo SDK 58 migration

The project now uses Expo 58.0.20, React Native 0.88.0, React 19.3.0,
Reanimated 4.7.1, Worklets 0.13.0, Skia 2.14.0 and Gesture Handler 3.3.0.
NativeWind stays on 4.2.7 with Tailwind 3. All Expo-managed versions were aligned
with `expo install --fix`; the package lock was updated alongside the source changes.
Node.js must be 22.13+ on 22.x, 24.3+ on 24.x, or 26+.

## Source migrations

- React Native refs use `ViewInstance`, `TextInputInstance`, `ScrollViewInstance`.
- The demo edit guard uses Router's `usePreventRemove` and `repeat()` after
  disabling prevention, preserving the blocked destination rather than dispatching
  an obsolete React Navigation removal action.
- Expo Router owns the safe-area provider. Web uses CSS `env()` insets, with no
  additional measuring provider that could interrupt streamed hydration. Native
  still uses measured safe-area insets. Screen-specific minimum padding is retained.
- Web remains a static export, with SDK 58's default asynchronous route chunks.
- Existing Gesture builder code is retained through RNGH 3's compatibility path.
  Native dragging and modal interaction still require physical-device QA.

## ExpoCrypto launch error

`Cannot find native module 'ExpoCrypto'` means the running native binary cannot
provide the module requested by its JavaScript. Installing an npm package alone
does not add native code to an already installed app. The reported trace occurred
while a route imported `use-command.ts`, before a user submitted anything.

Wolfari only needed `expo-crypto` for UUIDs, so those five call sites now use the
public `uuid.v4()` API from `expo` via `src/shared/operations/operation-id.ts`.
The separate `expo-crypto` dependency is removed. This is Expo core's native UUID
generator (browser crypto on web), not a timestamp/Math.random fallback. UUIDs
remain generated on demand, and retries retain their original idempotency key.
Command setup now runs inside `try/finally`, so generation or serialization
failure cannot leave the submit lock stuck.

This removes the reported ExpoCrypto dependency; it does **not** make an SDK 57
binary compatible with all SDK 58 modules. To run the upgraded app:

```powershell
# Stop the existing Metro terminal with Ctrl+C first.
npm.cmd ci
npm.cmd run start:go -- --clear
```

Close and reopen Expo Go, using a version supporting SDK 58. If using a custom
development client/APK, rebuild and install that client for SDK 58. Metro reload
or an OTA update cannot update its native modules. Do not downgrade React Native
alone, suppress missing-module errors or substitute insecure random IDs.

The original manifest and lockfile before upgrading were backed up under
`.cache/sdk58-before-09f1ddf8be5c411baa12a156e6dcf5ab/`. No source edits were reset.
The first in-place dependency resolution conflicted with the previous installed
tree; clean lockfile resolution and `npm ci` succeeded without `--force` or
`--legacy-peer-deps`.

## Checks

```powershell
npx.cmd expo install --check
npx.cmd expo-doctor@latest
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
```

Run the existing browser suites against a static web export using fixture API
requests. These checks and Android/iOS JavaScript bundle exports do not verify
native linking on a device. Before release, test cold launch/splash, persisted
sessions, UUID-backed writes/retries, camera, QR scanning, image picker, maps,
glass, gestures and safe areas on rebuilt Android and iOS clients.

Verification after removing `expo-crypto`: lint, typecheck and all 113 unit tests
passed; web/Android/iOS JavaScript exports succeeded. All nine fixture-backed
browser suites passed (auth, trips, order, backend features, finance, motion,
splash, parity and demo). The trip screenshot helper now waits for visible,
loaded images instead of treating an empty async-route placeholder as ready.

The dependency audit still reports 9 affected packages (3 high, 6 low), from
`zod` and `deepmerge` in Expo tooling. Do not run `npm audit fix --force`: its
proposed downgrade to Expo 51 is incompatible with this migration.

References: [SDK 58 upgrade](https://expo.dev/blog/how-to-upgrade-to-sdk-58),
[Router migration](https://docs.expo.dev/router/migrate/sdk-57-to-58/),
[Expo UUID API](https://docs.expo.dev/versions/v58.0.0/sdk/expo/#uuid),
[web safe areas](https://docs.expo.dev/develop/user-interface/safe-areas/#usage-with-web).
