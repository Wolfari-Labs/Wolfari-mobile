const { colors, radii } = require("./src/shared/theme/foundation.json");

/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind's web CSS hydration observer calls colorScheme.set(). The media
  // strategy rejects that call when the stylesheet arrives after JavaScript.
  darkMode: "class",
  // NativeWind's web CSS hydration observer calls colorScheme.set(). The media
  // strategy rejects that call when the stylesheet arrives after JavaScript.
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors,
      borderRadius: Object.fromEntries(
        Object.entries(radii).map(([name, value]) => [name, `${value}px`]),
      ),
    },
  },
  plugins: [],
};
