import { Platform } from "react-native";
import Constants from "expo-constants";
import { resolveApiUrl } from "./api-url";

export function getApiBaseUrl(): string {
  return resolveApiUrl({
    configured: process.env.EXPO_PUBLIC_API_URL,
    development: __DEV__,
    hostUri: Constants.expoConfig?.hostUri,
    webHost: Platform.OS === "web" && typeof window !== "undefined" ? window.location.hostname : undefined,
  });
}
