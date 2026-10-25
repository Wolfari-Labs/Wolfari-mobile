# Wolfari app branding

`wolfari-logo.png` is the user-supplied artwork with its outer white border
removed. Keep this source unchanged. The horizontal wordmark used inside app
headers remains in `assets/figma/logo.png`.

Regenerate the platform exports after replacing the source:

```sh
node scripts/generate-app-icons.mjs
```

The script uses the image utilities already bundled with Expo; no additional
runtime dependency or image-generation service is needed.

- `wolfari-app-icon.png`: opaque 1024 x 1024 PNG for iOS, legacy Android and web.
  Transparent areas are flattened onto mint (`#DDF7EF`), not a white border.
- `wolfari-adaptive-foreground.png`: 1024 x 1024 transparent Android layer with
  centered artwork inside the 66/108 safe circle, so launcher masks preserve it.
- `wolfari-splash-icon.png`: 1024 x 1024 transparent splash asset, shown at 160dp
  using contain sizing on the same mint background.

`app.json` no longer references the Expo template's iOS Icon Composer directory,
Android background, or monochrome mark. A monochrome layer is intentionally
omitted until a dedicated Wolfari silhouette is available; a solid rounded
rectangle would lose the identity of this detailed logo.

Icon and splash changes require a new native build. Verify the actual splash
screen in a preview/production build, not Expo Go. See the
[Expo guide](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/).
