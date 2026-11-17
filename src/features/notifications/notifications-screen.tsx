import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useSession } from "@/features/auth/session/session-provider";
import { markAllNotificationsRead } from "./inbox";
import { openNotification } from "./open-notification";
import { useApi } from "@/shared/api/use-api";
import { errorMessage } from "@/shared/api/errors";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { EmptyState, Heading, ResourceFeedback, Segments, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import type { AppNotification } from "./api";

function timeLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function NotificationsScreen() {
  const { profile } = useSession();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  return <Inbox key={`${profile?.id}:${filter}`} filter={filter} setFilter={setFilter} />;
}
function Inbox({ filter, setFilter }: { filter: "all" | "unread"; setFilter(value: "all" | "unread"): void }) {
  const api = useApi();
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors[cursors.length - 1];
  const [busy, setBusy] = useState(false), [success, setSuccess] = useState<string>();
  const reading = useRef<AbortController | null>(null);
  useEffect(() => () => { reading.current?.abort(); }, []);
  const [error, setError] = useState<string>();
  const resource = useResource(useCallback((signal: AbortSignal) => api.notifications.list({ cursor, unread: filter === "unread" ? true : undefined, signal }), [api, filter, cursor]));
  const items = (resource.data?.items ?? []).filter(item => item.status !== "CANCELLED");

  async function open(item: AppNotification) {
    setError(undefined);
    if (!item.read_at) {
      try { await api.notifications.markRead(item.id); } catch (cause) { setError(errorMessage(cause)); }
    }
    openNotification({ type: item.type, trip_id: item.trip_id });
    void resource.reload();
  }
  async function readAll() {
    if (reading.current) return;
    const controller = new AbortController();
    reading.current = controller;
    setBusy(true); setError(undefined); setSuccess(undefined);
    try {
      await markAllNotificationsRead(api.notifications, controller.signal);
      if (!controller.signal.aborted) setSuccess("Đã đánh dấu các thông báo đã đọc.");
    } catch (cause) { if (!controller.signal.aborted) setError(errorMessage(cause)); }
    finally {
      reading.current = null;
      if (!controller.signal.aborted) { setBusy(false); await resource.reload(); }
    }
  }

  return <Screen title="Thông báo" refreshing={resource.loading && !!resource.data} onRefresh={() => { void resource.reload(); }}>
    <Heading title="Thông báo" subtitle="Lời mời chuyến đi và cập nhật từ nhóm." />
    <Segments items={[{ value: "all", label: "Tất cả" }, { value: "unread", label: "Chưa đọc" }]} value={filter} onChange={value => { if (!busy) setFilter(value); }} />
    {error && <Feedback message={error} />}
    {success && <Feedback success message={success} />}
    <ResourceFeedback {...resource} hasData={!!resource.data} onRetry={() => { void resource.reload(); }} />
    {resource.data && (items.length ? <>
      {items.some(item => !item.read_at) && <Button label="Đánh dấu tất cả đã đọc" loading={busy} variant="text" compact style={{ alignSelf: "flex-end" }} onPress={() => { void readAll(); }} />}
      {items.map(item => <Pressable key={item.id} disabled={busy} accessibilityRole="button" accessibilityLabel={`${item.title}${item.read_at ? "" : ", chưa đọc"}`} onPress={() => { void open(item); }} style={ui.link}>
        <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: item.read_at ? "transparent" : colors.teal }} />
        <View style={ui.flex}>
          <Text style={typography.headline}>{item.title}</Text>
          <Text style={[typography.body, { color: colors.muted }]}>{item.type === "TRIP_INVITATION" ? "Bạn được mời tham gia một chuyến đi. Mở email lời mời để lấy mã, rồi dán vào màn Lời mời chuyến đi." : item.body}</Text>
          <Text style={[typography.footnote, { marginTop: 4 }]}>{timeLabel(item.created_at)}</Text>
        </View>
      </Pressable>)}
    </> : <EmptyState title={filter === "unread" ? "Đã đọc hết" : "Chưa có thông báo"} message="Lời mời chuyến đi sẽ xuất hiện ở đây." icon="bell" />)}
    {resource.data && <View style={ui.row}>
      {cursors.length > 1 && <Button label="Thông báo mới hơn" variant="soft" disabled={busy || resource.loading} onPress={() => setCursors(value => value.slice(0, -1))} />}
      {!!resource.data.next_cursor && !cursors.includes(resource.data.next_cursor) && <Button label="Thông báo cũ hơn" variant="soft" disabled={busy || resource.loading} onPress={() => setCursors(value => [...value, resource.data!.next_cursor])} />}
    </View>}
    <Button label="Nhập mã lời mời" variant="soft" onPress={() => router.push("/invitation")} />
    <Button label="Cài đặt thông báo" variant="text" onPress={() => router.push("/notification-settings")} />
  </Screen>;
}
