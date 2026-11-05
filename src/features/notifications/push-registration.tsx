import { useEffect } from "react";

import { useSession } from "@/features/auth/session/session-provider";
import { useApi } from "@/shared/api/use-api";
import { registerPushDevice, setupNotificationHandling } from "./push";

/** Mounted once in the root layout: wires tap handling and silently re-registers if permission was already granted. */
export function PushRegistration() {
  const { status, profile } = useSession();
  const api = useApi();
  useEffect(() => setupNotificationHandling(), []);
  useEffect(() => {
    if (status === "authenticated" && profile?.id) void registerPushDevice(api.notifications, profile.id, false);
  }, [api, status, profile?.id]);
  return null;
}
