# Motion, glass and Skia

> Historical visual-layer notes: the D refresh replaces the glass/paper material
> and editorial Home/My Trips heroes described below. Current appearance and QA
> are documented in [Mobile design D](mobile-design-d.md). Motion/accessibility
> primitives remain; the current dock is opaque clay, not optical Liquid Glass.

The UI uses NativeWind 4.2.7 (Tailwind 3), Reanimated 4.7.1 and React Native
Skia 2.14.0 on Expo SDK 58. NativeWind v5 is not required. Existing Finance and
membership workflows are unchanged by this visual layer.

## What changed

- Home and My Trips share `JourneyHero`: open editorial headings on the warm
  canvas. Destination photos now lead the page; the decorative Skia panel was
  removed from these two screens. Short `MotionReveal` entrances are preserved.
- Buttons, icon buttons and trip cards share `usePressMotion`; disabled/loading
  controls reset their scale, and Reduce Motion disables the spring.
- Tab controls use a glass dock and teal selection pill. Segments and progress
  bars use Reanimated instead of JavaScript-driven animation.
- `foundation.json` is the single palette/radius source for NativeWind and
  existing StyleSheet components. Custom components still accept `style`;
  className is used on supported React Native primitives.

Keep a Pressable with a callback-valued `style` entirely in StyleSheet and set
`cssInterop={false}` (as in `Button`). NativeWind v4's native interop can flatten
the callback even without a className, losing its background, padding and minimum
height. Do not add className to these controls. ClassName-only controls such as
the bottom tabs still use NativeWind. `tests/pressable-styles.test.mjs` guards the
opt-out; native visual QA and the motion browser test check the rendered controls.

## Performance and accessibility

The launch artwork retains its finite Reanimated motion, with no repeating animation
or per-frame React state. Focus, foreground state and Reduce Motion gate it.
Entrance motion uses a translation, never an opacity-to-zero transition on
native glass. Text remains ordinary accessible React Native text, not canvas
text. Reduce Transparency switches glass to an opaque surface and removes the
decorative launch layers.

Liquid Glass uses `expo-glass-effect` when the runtime reports support. Other
iOS versions and web use `expo-blur`. The Android tab dock samples its separate
`BlurTargetView` on Android 12/API 31+; older Android versions fall back to a
tinted surface. Other Android glass surfaces use inexpensive translucent tinted
backgrounds, switching to opaque white when Reduce Transparency is enabled.
The fallback is **not** native Liquid Glass or a full optical-refraction shader.

## Setup

```powershell
npm.cmd ci
npm.cmd run start -- --clear
```

Rebuild an existing development client after adding Skia; restarting Metro alone
does not install native code. Use the project's EAS development profile (see
`eas.json`) or your configured native development environment. Do not hand-edit
generated `ios/` or `android/` directories.

The reusable Aurora component can load Skia lazily, after CanvasKit initializes.
Current editorial screens do not mount it. The root UI does not wait
for WASM. `postinstall` copies the matching WASM into `public/`; it is generated
and ignored by Git. If install scripts were disabled, run:

```powershell
npm.cmd run setup:skia:web
```

Deploy the generated `/canvaskit.wasm` with the web build. No third-party CDN
is used. The loader fetches and validates the binary before initializing
CanvasKit from a temporary local blob, avoiding unhandled loader rejections on
network failure. It loads once per page load, shared across tabs, and revokes the blob URL.
A gradient remains visible if the canvas cannot load. Web deployment
currently assumes the app is served at the origin root.

## Verification

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
# With a web preview on port 8082 (or set WOLFARI_PREVIEW_URL):
npm.cmd run test:ui:motion
npm.cmd run test:ui:finance
```

The motion browser test checks computed NativeWind styles, editorial headings,
settled entrance animation, Reduce Motion, resilience without WASM, tabs/search,
minimum button height and a 320px viewport. Launch animation is covered
by the separate splash flow. API fixtures never change a real backend.

The editorial palette has AA normal-text contrast regression checks in
`tests/editorial-theme.test.mjs`. Tailwind uses `darkMode: "class"` because
NativeWind's web hydration observer calls `colorScheme.set()` after late CSS
injection; its default media strategy throws in that path. This does not add a
dark theme or change the device's appearance settings.

Before release, verify on physical iOS and Android devices: scroll/press frame
rate, glass contrast over imagery, larger system text, Reduce Motion/Transparency,
background/foreground transitions and long lists. Browser screenshots and Metro
bundling cannot establish native frame rate, battery use or native glass quality.

After the SDK 58 upgrade, the dependency audit reports 9 affected packages
(3 high, 6 low), propagated from `zod` and `deepmerge` in Expo tooling.
They need a separate SDK-compatible dependency review; do not use
`npm audit fix --force`, whose proposed changes include downgrading Expo to SDK 51.

References: [NativeWind installation](https://www.nativewind.dev/docs/getting-started/installation),
[Expo BlurView SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/blur-view/),
[Skia v2 web setup](https://wcandillon.github.io/react-native-skia/v2/docs/getting-started/web/).
