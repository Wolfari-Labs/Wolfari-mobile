import type { ApiClient } from "../../shared/api/api-client.ts";

export type AppNotification = {
  id: string; type: string; title: string; body: string;
  trip_id: string | null; source_id: string | null;
  status: "CREATED" | "AVAILABLE" | "CANCELLED"; created_at: string; read_at: string | null;
};

export const notificationGroups = ["INVITATION", "PLAN", "PACKING", "CONTRIBUTION", "CLOSURE", "PRICE"] as const;
export type NotificationGroup = (typeof notificationGroups)[number];
export type GroupOverride = { push?: boolean; email?: boolean };
export type NotificationPreferences = {
  push_enabled: boolean; email_enabled: boolean;
  group_overrides: Partial<Record<NotificationGroup, GroupOverride>>; version: number;
};

export function createNotificationsApi(client: ApiClient) {
  return {
    list: async (options: { cursor?: string | null; unread?: boolean; limit?: number; signal?: AbortSignal } = {}) => {
      const query = new URLSearchParams({ limit: String(options.limit ?? 30), ...(options.cursor ? { cursor: options.cursor } : {}), ...(options.unread === undefined ? {} : { unread: String(options.unread) }) });
      const { data, meta } = await client.requestWithMeta<AppNotification[], { next_cursor?: string | null }>(`/me/notifications?${query}`, { signal: options.signal });
      return { items: data, next_cursor: meta.next_cursor ?? null };
    },
    preferences: (signal?: AbortSignal) => client.request<NotificationPreferences>("/me/notification-preferences", { signal }),
    updatePreferences: (value: NotificationPreferences) => client.request<NotificationPreferences>("/me/notification-preferences", {
      method: "PUT",
      body: { push_enabled: value.push_enabled, email_enabled: value.email_enabled, group_overrides: value.group_overrides, expected_version: value.version },
    }),
    registerDevice: (platform: "IOS" | "ANDROID" | "WEB", token: string) =>
      client.request<{ id: string; platform: string; active: boolean; last_seen_at: string }>("/me/devices", { method: "POST", body: { platform, token } }),
    deleteDevice: (id: string) => client.request<unknown>(`/me/devices/${encodeURIComponent(id)}`, { method: "DELETE" }),
    // Backend rejects any request body on this route.
    markRead: (id: string) => client.request<AppNotification>(`/me/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" }),
  };
}
