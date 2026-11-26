# Wolfari brand assets

Wolfi, the grey wolf cub in a blue-to-mint scarf with a gold compass star, is the Wolfari mark. The compass star is the brand's signature: it is the pin on Wolfi's scarf, the dot of the "i" in the wordmark, and the gold accent in the in-app glyphs.

## Masters (`assets/brand/`)

| File | Use |
| --- | --- |
| `wolfi-mark.png` | Transparent square bust, the master for every launcher, splash and favicon PNG |
| `wolfari-lockup-master.png` | Full-resolution horizontal lockup (bust + wordmark) |
| `wolfari-wordmark.png` | 600 × 171 wordmark; the star is the dot of the "i" |
| `wolfari-wordmark-dotless.png` | Same wordmark without the star; the launch animation flies the star in |
| `compass-star.svg` | The gold compass star |
| `splash-halo.svg` | Compass halo that turns behind Wolfi on launch |
| `icon-backdrop.svg` / `.png` | 1024 px launcher backdrop: soft canvas gradient and compass ring |
| `icons/` | 34 glyphs on a 24-unit grid, split into `line/`, `fill/` and `spark/` layers (flat full-colour copies alongside) |

The glyph layers let `DesignIcon` take any tint without flooding the art: ink lines take the tint, brand washes take it at 24 % opacity, and the gold star stays gold (pass `spark={false}` for resting states, as the tab bar does for inactive tabs). Regenerate the glyphs with `python3 scripts/brand/generate-icons.py assets/brand/icons`.

## Platform PNGs (`assets/images/`)

Run `node scripts/generate-app-icons.mjs` to regenerate them from the masters.

| Asset | Use |
| --- | --- |
| `wolfari-app-icon.png` | Opaque 1024 px launcher for iOS and legacy Android |
| `wolfari-adaptive-foreground.png`, `wolfari-adaptive-monochrome.png` | Android adaptive and themed launcher layers inside the 66/108 safe circle, on `#EAF0FF` |
| `wolfari-notification.png` | White 96 px stencil, drawn from `scripts/brand/notification.svg` |
| `wolfari-favicon.png`, `wolfari-avatar.png` | Browser tab and default profile image |
| `wolfari-splash-icon.png` | 152 pt native splash emblem and the first frame of the in-app launch |
| `wolfari-lockup.png` | 1128 px wide horizontal lockup |

## Launch sequence

The native splash shows Wolfi on `#EAF0FF`. The in-app cover starts from the identical frame, then (about 1 s): the compass halo opens and starts turning, Wolfi hops with a small head tilt, the wordmark rises, and the gold star leaves the scarf, arcs over Wolfi's ear and lands as the dot of the "i" with four small glints. Reduce Motion shows the final frame straight away. Native icon and splash changes ship in a new binary.

## Colour source

Every brand colour is an app token from `src/shared/theme/foundation.json`: glyph washes use `tealSoft`, `mint`, `peach` and `ice`; the map route is `route`; the star is `sun` with an `ink` outline; the splash and launcher backdrop use `gradients.canvas` (canvas → lavender → mintCanvas); the notification accent is `teal`. Only Wolfi's own artwork keeps its drawn colours.

## In-app motion

- `DesignIcon pop`: when `spark` turns on, the star spins a quarter turn and stamps in about its own centre (tab bar).
- `CompassLoader` (`src/shared/ui/brand/`): the star needle hunts for north on a still dial; system spinner under Reduce Motion.
- `BrandLockup`: on the guest header, the star stamps onto the "i" and Wolfi nods once the launch cover lifts.
- `Wolfi` poses now use the brand art in `assets/brand/poses/` (wave for cheerful moods, map for travel moods).

## Notifications

`toast` (src/shared/ui/toast.tsx) has six tones, each with its own one-time badge motion: `success` stamps in with a burst of compass stars, `error` shakes, `warning` pulses, `info` spins the compass in, `notice` (in-app push banner) rings the bell, and `celebrate` shows Wolfi hopping with a star burst (used when a trip is created). A thin bar under each card counts down the time left; holding the card pauses it. The header's unread dot stamps in with one soft ripple. All of it is skipped under Reduce Motion.
