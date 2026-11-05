# Splash screen

Wolfari opens on a deep-teal background with the existing transparent wolf mascot.
The animated layer adds a soft halo, two orbiting lights, a gentle mascot pulse,
the wordmark and “Cùng nhau, đi xa hơn.” It fades into the existing destination.
Small screens omit the footer so it cannot overlap the wordmark or tagline.

## Implementation

- `app.json`: native `expo-splash-screen` configuration, light/dark background
  `#073B49`, mascot image width 176. The app icon is unchanged.
- `src/shared/ui/launch/native-splash.ts`: retain the native splash at module
  scope; release once the React cover is laid out and its image has settled.
- `src/shared/ui/launch/app-launch.tsx`: a single overlay above the mounted
  navigator, inside the session provider. It is not a route and never changes
  the requested destination. Navigation does not replay it.
- `src/shared/ui/launch/launch-artwork.tsx`: local Expo Image, LinearGradient,
  NativeWind typography and finite Reanimated motion. Layout is measured after
  mount to keep static web HTML and client hydration consistent.
- `src/shared/ui/launch/launch-policy.ts`: bounded, independently tested timing.

No dependency was added for the splash. It does not wait for Skia/CanvasKit,
fetch remote images or initiate additional backend requests. Auth restoration
continues in parallel. The native image and React image use the same asset and
centered 176-point box to minimize the hand-off jump; device QA is still required.

The image-generation service failed during implementation. The original
`assets/figma/mascot.png` is reused **unchanged**; the new lighting, composition
and movement are implemented in code, not baked into a newly generated image.

## Timing and accessibility

Normal motion runs for at least 1.2 seconds once the cover is ready. If the
session is still restoring, it waits at most 2.4 seconds, followed by a 260ms
fade. The image has a 650ms grace period; motion-preference detection has 450ms.
A separate 4-second JS timer and 4.5-second native-release timer are safeguards,
not backend timeouts. As JS timers, these cannot run while the JS thread is blocked.
The underlying page can still show its own loading state after the splash leaves.

Reduce Motion disables transforms/fades and removes the decorative minimum;
pending auth is capped at 900ms. Reduce Transparency removes the gradient and
filled halos. Going to the background dismisses the splash. Decorative timers
and animations are cleaned up when it unmounts; there is no infinite animation.

While covered, navigation content is hidden from assistive technology and touch.
The overlay exposes one busy status: “Wolfari đang mở hành trình”. Decorative
copy is hidden from screen readers and uses fixed branding sizes; it is not
interactive app content. Native GlassView ancestors are never faded to zero.

## Verification

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
# Serve a web export on port 8083, or specify WOLFARI_PREVIEW_URL:
npm.cmd run test:ui:splash
```

The browser suite checks actual mascot motion, Reduce Motion, a 320px layout,
pending auth, an image-load failure, deep-link preservation, accessible control
hiding and no replay during navigation. All API calls are intercepted fixtures.
Screenshots are written to `.cache/visual/splash/` (ignored by Git).
Optional video recording uses `WOLFARI_RECORD_SPLASH=1` and requires Playwright's
FFmpeg binary; it is not required by the standard suite.

Unit tests verify timing limits, image transparency, shared native light/dark
configuration and the Android splash image's safe circle. Auth, motion/Skia and
Finance browser suites also cover the root-wrapper regression surface.

### Before shipping

Changes to the native splash config require a **new native build**, not just
Metro reload or an OTA update. Expo Go and development builds do not fully
represent the OS splash; verify a release build on iOS and Android. See the
[Expo SDK 58 splash-screen documentation](https://docs.expo.dev/versions/v58.0.0/sdk/splash-screen/).

Check cold starts in light/dark mode, small devices and safe areas, native-to-JS
image alignment, no blank frame, restored and anonymous sessions, offline starts,
Reduce Motion/Transparency, large system text, deep links and background/resume.
JavaScript bundle exports and browser tests do not establish native frame rate
or pixel-perfect OS-to-React continuity.
