import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSession } from "@/features/auth/session/session-provider";
import { markAllNotificationsRead } from "./inbox";
import { openNotification } from "./open-notification";
import { useApi } from "@/shared/api/use-api";
import { errorMessage } from "@/shared/api/errors";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, pastelTones, shadows, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { Snackbar } from "@/shared/ui/toast";
import { ClayChip } from "@/shared/ui/clay-form";
import { CardIcon, ClayIconButton } from "@/shared/ui/setting-card";
import { Sheet } from "@/shared/ui/sheet";
import { EmptyState, ResourceFeedback, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import type { AppNotification } from "./api";

function timeLabel(value: string) {
  const date = new Date(value), now = new Date();
  if (!Number.isFinite(date.getTime())) return "";
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (minutes >= 0 && date.toDateString() === now.toDateString()) {
    if (minutes < 1) return "Vừa xong";
    return minutes < 60 ? `${minutes} phút trước` : `${Math.floor(minutes / 60)} giờ trước`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return date.toDateString() === yesterday.toDateString() ? "Hôm qua" : date.toLocaleDateString("vi-VN");
}

function appearance(type: string) {
  if (type === "TRIP_INVITATION") return { tone: "lilac", icon: "notifyInvite" } as const;
  if (type.includes("PACKING")) return { tone: "butter", icon: "notifyPacking" } as const;
  if (type.startsWith("PRICE_")) return { tone: "mint", icon: "notifyPrice" } as const;
  if (/CONTRIBUTION|TRANSFER|CLOSURE|REFUND|FINANCE/.test(type)) return { tone: "mint", icon: "wallet" } as const;
  return { tone: "blue", icon: "notifyPlan" } as const;
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
  const [menu, setMenu] = useState(false);
  const unread = useResource(useCallback((signal: AbortSignal) => api.notifications.list({ unread: true, signal }), [api]));
  const unreadTotal = unread.data && String(unread.data.items.filter(item => item.status !== "CANCELLED" && !item.read_at).length) + (unread.data.next_cursor ? "+" : "");
  const today = new Date().toDateString();
  const items = (resource.data?.items ?? []).filter(item => item.status !== "CANCELLED");

  async function open(item: AppNotification) {
    setError(undefined);
    if (!item.read_at) {
      try { await api.notifications.markRead(item.id); } catch (cause) { setError(errorMessage(cause)); }
    }
    openNotification({ type: item.type, trip_id: item.trip_id });
    void resource.reload(); void unread.reload();
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
      if (!controller.signal.aborted) { setBusy(false); await Promise.all([resource.reload(), unread.reload()]); }
    }
  }

  return <Screen clay tab="notifications" title="Thông báo" headerRight={<ClayIconButton icon="more" label="Tùy chọn thông báo" onPress={() => setMenu(true)} />}
    refreshing={resource.loading && !!resource.data} onRefresh={() => { void resource.reload(); void unread.reload(); }}>
    <View style={{ gap: 4 }}><Text accessibilityRole="header" style={typography.largeTitle}>Có gì mới?</Text>
      {unreadTotal !== undefined && <Text style={typography.body}>{unreadTotal} thông báo chưa đọc</Text>}
    </View>
    <View style={styles.filters}>{(["all", "unread"] as const).map(value => <ClayChip key={value} role="tab" accessibilityLabel={value === "all" ? "Tất cả" : "Chưa đọc"}
      label={value === "all" ? "Tất cả" : "Chưa đọc" + (unreadTotal ? " · " + unreadTotal : "")} selected={filter === value} disabled={busy} onPress={() => setFilter(value)} />)}</View>
    {error && <Feedback message={error} />}
    <Snackbar message={success} />
    <ResourceFeedback {...resource} hasData={!!resource.data} onRetry={() => { void resource.reload(); }} />
    {resource.data && (items.length ? ["Hôm nay", "Trước đó"].map((label, index) => {
      const group = items.filter(item => (new Date(item.created_at).toDateString() === today) === (index === 0));
      return group.length > 0 && <View key={label} style={styles.group}><Text accessibilityRole="header" style={typography.section}>{label}</Text>
        {group.map(item => {
          const { tone, icon } = appearance(item.type);
          return <Pressable key={item.id} cssInterop={false} disabled={busy} accessibilityRole="button" accessibilityLabel={item.title + (item.read_at ? "" : ", chưa đọc")}
            onPress={() => { void open(item); }} style={({ pressed }) => [styles.card, !item.read_at && { backgroundColor: pastelTones[tone].surface }, pressed && { opacity: 0.8 }]}>
            <CardIcon tone={tone} icon={icon} /><View style={styles.copy}><Text style={typography.headline}>{item.title}</Text>
              <Text style={typography.body}>{item.type === "TRIP_INVITATION" ? "Mở để xem lời mời đang chờ và trả lời." : item.body}</Text>
              <Text style={[typography.eyebrow, { color: colors.tealPressed }]}>{timeLabel(item.created_at).toLocaleUpperCase("vi-VN")}</Text></View>
            {!item.read_at && <View style={styles.dot} />}
          </Pressable>;
        })}</View>;
    }) : <EmptyState title={filter === "unread" ? "Đã đọc hết" : "Chưa có thông báo"} message="Lời mời và cập nhật từ nhóm sẽ xuất hiện ở đây." icon="bell" scene="quiet" />)}
    {resource.data && <View style={ui.row}>
      {cursors.length > 1 && <Button label="Thông báo mới hơn" variant="soft" disabled={busy || resource.loading} onPress={() => setCursors(value => value.slice(0, -1))} />}
      {!!resource.data.next_cursor && !cursors.includes(resource.data.next_cursor) && <Button label="Thông báo cũ hơn" variant="soft" disabled={busy || resource.loading} onPress={() => setCursors(value => [...value, resource.data!.next_cursor])} />}
    </View>}
    <Sheet visible={menu} title="Tùy chọn thông báo" onClose={() => setMenu(false)}>
      <Button label="Đánh dấu tất cả đã đọc" disabled={busy || unreadTotal === "0"} onPress={() => { setMenu(false); void readAll(); }} />
      <Button label="Nhập mã lời mời" variant="soft" onPress={() => { setMenu(false); router.push("/invitation"); }} />
      <Button label="Cài đặt thông báo" variant="text" onPress={() => { setMenu(false); router.push("/notification-settings"); }} />
    </Sheet>
  </Screen>;
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: 8 },
  group: { gap: 12 },
  card: { padding: 16, borderRadius: 24, flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: colors.surface, ...shadows.card },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue, marginTop: 3 },
});
