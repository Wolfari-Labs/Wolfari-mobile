import * as SplashScreen from "expo-splash-screen";
import { Platform } from "react-native";

let watchdog: ReturnType<typeof setTimeout> | undefined;

// Called at module scope in the root layout, before Expo Router auto-hides it.
export function prepareNativeSplash() {
  if (Platform.OS === "web") return;
  void SplashScreen.preventAutoHideAsync().catch(() => {});
  watchdog = setTimeout(releaseNativeSplash, 4500);
}

export function releaseNativeSplash() {
  if (watchdog) clearTimeout(watchdog);
  watchdog = undefined;
  if (Platform.OS !== "web") void SplashScreen.hideAsync().catch(() => {});
}
