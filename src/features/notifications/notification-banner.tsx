import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { useSession } from "@/features/auth/session/session-provider";
import { useApi } from "@/shared/api/use-api";
import { showToast } from "@/shared/ui/toast";

const POLL_MS = 30_000;

/**
 * In-app banner for notifications that arrive while the app is open. Expo Go has no
 * remote push, so the inbox is polled while the app is in the foreground; on devices with
 * push, a received push only triggers an immediate check (the banner replaces the system
 * one). The first read is a baseline: opening the app never replays old notifications.
 */
export function NotificationBanner() {
  const { status, profile } = useSession();
  const api = useApi();
  useEffect(() => {
    if (status !== "authenticated" || !profile?.id) return;
    let active = true;
    let baseline = true;
    let running: AbortController | undefined;
    const seen = new Set<string>();
    const check = async () => {
      if (!active || running || (AppState.currentState !== "active" && AppState.currentState !== null)) return;
      running = new AbortController();
      try {
        const page = await api.notifications.list({ unread: true, limit: 5, signal: running.signal });
        if (!active) return;
        const fresh = page.items.filter((item) => item.status !== "CANCELLED" && !item.read_at && !seen.has(item.id));
        for (const item of page.items) seen.add(item.id);
        if (baseline) {
          baseline = false;
          return;
        }
        const latest = fresh.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
        if (!latest) return;
        showToast({
          tone: "notice",
          icon: "bell",
          title: fresh.length > 1 ? `${fresh.length} thông báo mới` : latest.title,
          message: fresh.length > 1 ? latest.title : latest.body || "Chạm Xem để mở hộp thông báo.",
          action: { label: "Xem", onPress: () => router.push("/notifications") },
          duration: 7000,
        });
      } catch {
        // Best effort: the inbox stays the source of truth.
      } finally {
        running = undefined;
      }
    };
    void check();
    const timer = setInterval(() => void check(), POLL_MS);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    const received = Platform.OS === "web" ? undefined : Notifications.addNotificationReceivedListener(() => void check());
    return () => {
      active = false;
      running?.abort();
      clearInterval(timer);
      appState.remove();
      received?.remove();
    };
  }, [api, status, profile?.id]);
  return null;
}
