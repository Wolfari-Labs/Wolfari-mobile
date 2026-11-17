import { resolveApiUrl } from "../src/shared/config/api-url.ts";

if (!process.env.EXPO_TOKEN?.trim())
  throw Error("Configure EXPO_TOKEN in the GitHub preview environment secrets.");
const base = resolveApiUrl({ configured: process.env.EXPO_PUBLIC_API_URL, development: false });
const hostname = new URL(base).hostname;
if (hostname.endsWith(".invalid") || hostname === "localhost" || hostname === "127.0.0.1")
  throw Error("Configure a deployed HTTPS Gateway URL in preview EXPO_PUBLIC_API_URL.");
if (
  process.env.WOLFARI_EXPECTED_API_URL &&
  base !== resolveApiUrl({ configured: process.env.WOLFARI_EXPECTED_API_URL, development: false })
)
  throw Error("The Expo preview Gateway URL must match the GitHub preview environment variable.");
console.log("Preview authentication and HTTPS Gateway configuration are present.");
