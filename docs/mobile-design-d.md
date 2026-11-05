# Mobile — D · Pastel mềm 3D

## Design source and scope

Source: [Wolfari Travel Workspace](https://www.figma.com/design/hdy2sOZk6rfjKXKDJ9HW9y?node-id=865-6668).
The URL selects the exploration page. This implementation uses **D**, not the older E paper-map direction.

Reference frames: guest `876:7083`, sign-in `876:7159`, sign-up `895:7691`, My Trips `876:7216`, Home `895:7783`, overview `877:7210`; D components `875:7113`.

- Shared canvas: `#EAF0FF → #F3F0FF → #E9FBF3`.
- White clay surfaces and sky/mint/butter/lilac/peach tiles; blue-to-mint primary actions.
- `foundation.json` remains the palette/radius source for both NativeWind and StyleSheet. `tokens.ts` adds fonts, gradients, pastel tones and shadows; no competing theme.
- `pastel.tsx` provides reusable icon capsules and two-column quick-action/stat tiles.
- Guest, sign-in/sign-up, Home, My Trips, real trip overview and demo overview are re-composed for D. Shared form, navigation and activity rows inherit D styling. This is not a claim of pixel-perfect completion of every Figma screen.

## Intentional adaptations

- Real screens derive lifecycle, activities, packing and dress-code counts from API data. No invented weather, member count, budget balance or trip progress. Fund tiles link to the existing fund workflow.
- The dock keeps three working destinations. Notifications and Google authentication are not implemented as decorative/nonfunctional controls. The bell opens trip invitations and is labeled accordingly.
- Primary actions use dark ink on the reference gradient to retain AA normal-text contrast. Local static Nunito font families select their own weight, without synthetic bold in the shared type ramp.
- Long labels wrap; screens scroll and preserve keyboard avoidance and measured dock clearance. A tap on the active bottom tab also returns from nested details to its list.
- Demo counters are computed from isolated in-memory fixtures and labeled as samples. Demo edits never write Trip/Finance APIs.
- Existing E artwork/components remain available for untouched consumers; no broad asset deletion or dependency removal was performed.

## Bundled asset provenance

`assets/figma/d/` contains exact exported bytes from the reference frames: the illustrated destination, waving mascot, two inspiration photos, and back/bag/calendar/chevron/compass/filter/map/plane/search/user/wallet SVGs. The three JPEG exports use `.jpg` extensions based on their encoded format, even though Figma's temporary URLs said `.png`. App runtime uses local imports, never expiring Figma asset URLs. Existing matching icons and the Wolfari logo are reused.

Nunito SemiBold, Bold and ExtraBold are bundled under `assets/fonts/`, sourced from the [Expo Google Fonts Nunito package](https://github.com/expo/google-fonts/tree/master/font-packages/nunito). The font license is preserved in `assets/fonts/OFL-Nunito.txt` (SIL Open Font License 1.1). Figma artwork remains subject to the project's existing asset rights; no additional redistribution license is assumed.

## Verification

Run a local Expo web server, then set its port explicitly:

```powershell
$env:WOLFARI_PREVIEW_URL='http://localhost:8084'
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:ui
npm.cmd run test:ui:trips
npm.cmd run test:ui:demo
npm.cmd run test:ui:motion
npm.cmd run test:ui:design-d
npm.cmd run test:ui:splash
```

All listed UI suites intercept API traffic; no production accounts or trips are modified. Screenshots are under `.cache/visual/`, with D responsive captures in `pastel-d/`. Checks cover local asset/font loading, contrast, auth validation/recovery, trip creation/edit/conflict recovery, active-tab navigation, demo cover cleanup/reset, 320/375/402px layouts, landscape and reduced-motion behavior.

Native device QA remains required: iOS/Android keyboard behavior, screen readers, largest Dynamic Type/font scale, native shadow rendering and safe areas. Browser viewport checks do not establish native parity. D is a light theme; a separate dark-mode palette is not included.

### Production-bundle checks

The SDK 58 development server intermittently returned `Requiring unknown module` on direct page requests during this session. Production static export did not reproduce that error, so final browser checks also use the exported build. To reproduce with fixtures only (do not deploy this test endpoint):

```powershell
$env:EXPO_PUBLIC_API_URL='https://api.wolfari.test/api/v1'
npx.cmd expo export --platform all --output-dir .cache/design-d-verified
# Serve the export on port 8085 with a static host that falls back to index.html.
# After the Finance merge, web output is single (SPA); expo serve alone returned
# 404 for direct nested routes in the merge verification.
# In the test terminal:
$env:WOLFARI_PREVIEW_URL='http://localhost:8085'
```

The test endpoint uses the reserved `.test` domain and is intercepted by Playwright. This command does not edit `.env.local`; real deployments still need their real HTTPS Gateway. Android/iOS Hermes bundle export is a compile/asset check, not a native device launch or signed APK/IPA.

Verified on 2026-11-05: typecheck, lint, all 130 unit tests, Android/iOS/web export, and the auth, trip, demo, motion, splash and D-responsive browser suites passed. Screenshots were inspected for guest, sign-in, Home, My Trips, overview, narrow phones and landscape. The narrow demo fund tile now uses compact currency formatting; exact balances remain on the fund screen.
