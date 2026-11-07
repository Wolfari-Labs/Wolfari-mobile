import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";

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
  const api = useApi();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [error, setError] = useState<string>();
  const resource = useResource(useCallback((signal: AbortSignal) => api.notifications.list({ unread: filter === "unread" ? true : undefined, signal }), [api, filter]));
  useFocusEffect(useCallback(() => { void resource.reload(); }, [resource.reload])); // eslint-disable-line react-hooks/exhaustive-deps
  const items = (resource.data?.items ?? []).filter(item => item.status !== "CANCELLED");

  async function open(item: AppNotification) {
    setError(undefined);
    if (!item.read_at) {
      try { await api.notifications.markRead(item.id); } catch (cause) { setError(errorMessage(cause)); }
    }
    if (item.type === "TRIP_INVITATION") router.push("/invitation");
    else if (item.trip_id) router.push({ pathname: "/trip/[id]", params: { id: item.trip_id } });
    void resource.reload();
  }
  async function readAll() {
    setError(undefined);
    try { await Promise.all(items.filter(item => !item.read_at).map(item => api.notifications.markRead(item.id))); }
    catch (cause) { setError(errorMessage(cause)); }
    void resource.reload();
  }

  return <Screen title="Thông báo" refreshing={resource.loading && !!resource.data} onRefresh={() => { void resource.reload(); }}>
    <Heading title="Thông báo" subtitle="Lời mời chuyến đi và cập nhật từ nhóm." />
    <Segments items={[{ value: "all", label: "Tất cả" }, { value: "unread", label: "Chưa đọc" }]} value={filter} onChange={setFilter} />
    {error && <Feedback message={error} />}
    <ResourceFeedback {...resource} hasData={!!resource.data} onRetry={() => { void resource.reload(); }} />
    {resource.data && (items.length ? <>
      {items.some(item => !item.read_at) && <Button label="Đánh dấu tất cả đã đọc" variant="text" compact style={{ alignSelf: "flex-end" }} onPress={() => { void readAll(); }} />}
      {items.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.title}${item.read_at ? "" : ", chưa đọc"}`} onPress={() => { void open(item); }} style={ui.link}>
        <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: item.read_at ? "transparent" : colors.teal }} />
        <View style={ui.flex}>
          <Text style={typography.headline}>{item.title}</Text>
          <Text style={[typography.body, { color: colors.muted }]}>{item.type === "TRIP_INVITATION" ? "Bạn được mời tham gia một chuyến đi. Mở email lời mời để lấy mã, rồi dán vào màn Lời mời chuyến đi." : item.body}</Text>
          <Text style={[typography.footnote, { marginTop: 4 }]}>{timeLabel(item.created_at)}</Text>
        </View>
      </Pressable>)}
      {resource.data.next_cursor && <Text style={typography.footnote}>Đang hiện 30 thông báo mới nhất.</Text>}
    </> : <EmptyState title={filter === "unread" ? "Đã đọc hết" : "Chưa có thông báo"} message="Lời mời chuyến đi sẽ xuất hiện ở đây." icon="bell" />)}
    <Button label="Nhập mã lời mời" variant="soft" onPress={() => router.push("/invitation")} />
    <Button label="Cài đặt thông báo" variant="text" onPress={() => router.push("/notification-settings")} />
  </Screen>;
}
