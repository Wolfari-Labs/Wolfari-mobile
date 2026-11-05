import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Platform } from "react-native";

import type { createNotificationsApi } from "./api";

type NotificationsApi = ReturnType<typeof createNotificationsApi>;
export type PushStatus = "registered" | "denied" | "unsupported" | "error";

const deviceKey = (userId: string) => `wolfari.push-device.v1:${userId}`;

/** Remote push needs a development/production build; Expo Go and web cannot receive it. */
export function pushSupported() {
  return Platform.OS !== "web" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

let handlerReady = false;
export function setupNotificationHandling() {
  if (handlerReady || Platform.OS === "web") return () => {};
  handlerReady = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  const open = (data: Record<string, unknown> | undefined) => {
    const type = typeof data?.type === "string" ? data.type : undefined;
    const tripId = typeof data?.trip_id === "string" ? data.trip_id : undefined;
    if (type === "TRIP_INVITATION") router.push("/invitation");
    else if (tripId) router.push({ pathname: "/trip/[id]", params: { id: tripId } });
    else router.push("/notifications");
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(event => open(event.notification.request.content.data));
  // App opened by tapping a notification while it was closed.
  void Notifications.getLastNotificationResponseAsync().then(event => { if (event) open(event.notification.request.content.data); }).catch(() => {});
  return () => { subscription.remove(); handlerReady = false; };
}

/** Ask permission (only when `prompt`), get the Expo push token and register it with the backend. */
export async function registerPushDevice(api: NotificationsApi, userId: string, prompt: boolean): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported";
  try {
    if (Platform.OS === "android") {
      // Android 13+ shows the permission prompt only after a channel exists.
      await Notifications.setNotificationChannelAsync("default", { name: "Wolfari", importance: Notifications.AndroidImportance.HIGH });
    }
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && prompt && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return "denied";
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return "error";
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const device = await api.registerDevice(Platform.OS === "ios" ? "IOS" : "ANDROID", token);
    await AsyncStorage.setItem(deviceKey(userId), device.id);
    return "registered";
  } catch {
    return "error";
  }
}

/** Best-effort: stop pushes to this phone before signing out. */
export async function unregisterPushDevice(api: NotificationsApi, userId: string) {
  try {
    const id = await AsyncStorage.getItem(deviceKey(userId));
    if (!id) return;
    await api.deleteDevice(id);
    await AsyncStorage.removeItem(deviceKey(userId));
  } catch { /* the backend also deactivates stale tokens */ }
}
