import type { ConfigContext, ExpoConfig } from "expo/config";

/** EAS file variable or a developer-supplied local Firebase client configuration. */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "Wolfari-mobile",
  slug: config.slug ?? "wolfari-mobile",
  plugins: [
    ...(config.plugins ?? []),
    ["react-native-maps", { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY }],
  ],
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
  },
});
