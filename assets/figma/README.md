# Wolfari screen assets

The current mobile implementation also uses frames M04–M32 and P15 `612:8805`.
Assets are downloaded locally; no temporary Figma URLs are used in the app.

- `danang-photo.png`: Cầu Rồng, Bùi Thụy Đào Nguyên,
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/),
  [original](https://commons.wikimedia.org/wiki/File:Cầu_Rồng.jpg).
  Used as a cropped trip cover, ticket, create/edit preview and settings thumbnail.
- `coast-photo.png`: Mỹ Khê, Ray in Manila,
  [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/),
  [original](https://commons.wikimedia.org/wiki/File:My_Khe_Beach,_Da_Nang,_Vietnam.jpg).
  Used as cropped inspiration/generic travel cover.
- `dalat-photo.png`: destination cover supplied by Figma M05; original export
  preserved, used for trip names containing Đà Lạt.
- `journal-underline.svg`: M05 heading accent, 96 × 10 slot.
- `profile-mascot.png`: M22/M32 account illustration, 64 × 64 contain slot.
- Additional local icons: trip, search, clock, gear and shirt. All keep their
  exported viewBox geometry and use contain sizing in touch-friendly wrappers.

Trip API has no cover-image field. These pictures illustrate a trip, rather than
claiming to be uploaded photos. P15 uses the supplied mascot in a 108 × 84 slot.

Original assets downloaded from the user's Figma file
`hdy2sOZk6rfjKXKDJ9HW9y`, frames M01 `317:2025`, M02 `317:2026`, M03 `317:2027`.
No temporary Figma URLs are used at runtime. SVG source and intrinsic dimensions
are preserved.

| Asset | Design slot |
| --- | --- |
| `logo.png` | M01 header 112 x 38; M02 content 114 x 38 |
| `mascot.png` | M01 cover 78 x 78; M02 greeting 92 x 92 |
| `danang.svg` | M01 destination cover 354 x 234, proportional on smaller devices |
| `lake.png` | M02 footer illustration 354 x 150, cover fit |
| `back.svg` | M02/M03 header, intrinsic 22 x 22 |
| `mail.svg`, `lock.svg`, `edit.svg` | Form leading icons, intrinsic 16.5 x 16.5 |
| `check.svg` | M03 selected consent, intrinsic 22 x 22 |
| `map.svg`, `bag.svg`, `wallet.svg` | M01 feature rows, intrinsic 22 x 22 |
| `chevron.svg` | M01 feature row trailing icon, intrinsic 22 x 22 |
| `signal.svg`, `wifi.svg`, `battery.svg` | Opt-in web preview status bar; native uses OS indicators |
