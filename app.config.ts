import type { ConfigContext, ExpoConfig } from "expo/config";

/** EAS file variable or a developer-supplied local Firebase client configuration. */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "Wolfari-mobile",
  slug: config.slug ?? "wolfari-mobile",
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
  },
});
