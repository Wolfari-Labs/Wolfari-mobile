import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";
import { createDeviceQueue } from "./device-queue";
import { openNotification } from "./open-notification";

import type { createNotificationsApi } from "./api";

type NotificationsApi = ReturnType<typeof createNotificationsApi>;
export type PushStatus = "registered" | "denied" | "unsupported" | "error";

const deviceKey = (userId: string) => `wolfari.push-device.v1:${userId}`;

/** Remote push needs a development/production build; Expo Go and web cannot receive it. */
export function pushSupported() {
  // SDK 58 reports both Expo Go and development clients as StoreClient.
  // expoGoConfig is populated only by Expo Go, so development builds stay enabled.
  return Platform.OS !== "web" && Constants.expoGoConfig == null;
}

let handlerReady = false;
const enqueueDevice = createDeviceQueue();
export function setupNotificationHandling() {
  if (handlerReady || Platform.OS === "web") return () => {};
  handlerReady = true;
  let active = true;
  const handledResponses = new Set<string>();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  const open = (event: Notifications.NotificationResponse) => {
    if (!active) return;
    const key = event.notification.request.identifier;
    if (handledResponses.has(key)) return;
    handledResponses.add(key);
    if (handledResponses.size > 100) handledResponses.delete(handledResponses.values().next().value!);
    openNotification(event.notification.request.content.data);
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(open);
  // App opened by tapping a notification while it was closed.
  void Notifications.getLastNotificationResponseAsync().then(event => { if (event) open(event); }).catch(() => {});
  return () => { active = false; subscription.remove(); handlerReady = false; };
}

/** Ask permission (only when `prompt`), get the Expo push token and register it with the backend. */
export function registerPushDevice(api: NotificationsApi, userId: string, prompt: boolean, isCurrent = () => true): Promise<PushStatus> {
  return enqueueDevice(() => registerDevice(api, userId, prompt, isCurrent));
}
async function registerDevice(api: NotificationsApi, userId: string, prompt: boolean, isCurrent: () => boolean): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported";
  if (!isCurrent()) return "error";
  try {
    if (Platform.OS === "android") {
      // Android 13+ shows the permission prompt only after a channel exists.
      await Notifications.setNotificationChannelAsync("default", { name: "Wolfari", importance: AndroidImportance.HIGH });
    }
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && prompt && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return "denied";
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return "error";
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!isCurrent()) return "error";
    const device = await api.registerDevice(Platform.OS === "ios" ? "IOS" : "ANDROID", token);
    await AsyncStorage.setItem(deviceKey(userId), device.id);
    if (!isCurrent()) { await api.deleteDevice(device.id); await AsyncStorage.removeItem(deviceKey(userId)); return "error"; }
    return "registered";
  } catch {
    return "error";
  }
}

/** Best-effort: stop pushes to this phone before signing out. */
export function unregisterPushDevice(api: NotificationsApi, userId: string) {
  return enqueueDevice(async () => {
  try {
    const id = await AsyncStorage.getItem(deviceKey(userId));
    if (!id) return;
    await api.deleteDevice(id);
    await AsyncStorage.removeItem(deviceKey(userId));
  } catch { /* Logout still revokes the session; backend delivery checks that session before every send. */ }
  });
}
