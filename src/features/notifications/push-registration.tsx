import { useEffect } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";

import { useSession } from "@/features/auth/session/session-provider";
import { useApi } from "@/shared/api/use-api";
import { pushSupported, registerPushDevice, setupNotificationHandling } from "./push";

/** Mounted once in the root layout: wires tap handling and silently re-registers if permission was already granted. */
export function PushRegistration() {
  const { status, profile, getSessionSnapshot } = useSession();
  const api = useApi();
  // Keep the cold-start notification until an authenticated navigator can handle it.
  useEffect(() => {
    if (status === "authenticated" && profile?.id) return setupNotificationHandling();
  }, [status, profile?.id]);
  useEffect(() => {
    if (status !== "authenticated" || !profile?.id || !pushSupported()) return;
    const userId = profile.id;
    let active = true, pending = false;
    const isCurrent = () => active && getSessionSnapshot().status === "authenticated" && getSessionSnapshot().profile?.id === userId;
    const register = async () => {
      if (pending || !isCurrent()) return;
      pending = true;
      try { await registerPushDevice(api.notifications, userId, false, isCurrent); }
      finally { pending = false; }
    };
    void register();
    const foreground = AppState.addEventListener("change", state => { if (state === "active") void register(); });
    const token = Notifications.addPushTokenListener(() => { void register(); });
    return () => { active = false; foreground.remove(); token.remove(); };
  }, [api, status, profile?.id, getSessionSnapshot]);
  return null;
}
