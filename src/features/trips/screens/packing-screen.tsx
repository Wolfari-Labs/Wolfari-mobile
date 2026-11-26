import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useRef } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useResource } from "@/shared/hooks/use-resource";
import { gradients, shadows } from "@/shared/theme/tokens";
import { router } from "expo-router";
import { ClayIcon, ClayIconButton, SettingCard } from "@/shared/ui/setting-card";
import { ResourceFeedback } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { useTrip } from "../hooks/use-trip";
import { PackingList, type PackingListHandle } from "../components/packing-list";
import { collectPages } from "../api/pagination";

export default function PackingScreen() {
  const resource = useTrip(), { data, id, api } = resource;
  const members = useResource(useCallback((signal: AbortSignal) => collectPages(cursor => api.trips.members(id, cursor, signal), signal), [api, id]));
  const list = useRef<PackingListHandle>(null);
  const canAdd = !!data?.plan.permissions.can_edit && !!members.data && !members.loading && !members.error;
  return <Screen clay title="Hành lý" tab="trips" onRefresh={() => { void Promise.all([resource.reload(), members.reload()]); }} refreshing={resource.loading && !!data}
    headerRight={data && <ClayIconButton icon="more" label="Tùy chọn hành lý" onPress={() => list.current?.chooseCategory()} />}
    floating={data?.plan.permissions.can_edit ? <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Thêm vật dụng" accessibilityState={{ disabled: !canAdd }} disabled={!canAdd} onPress={() => list.current?.add()} style={({ pressed }) => [styles.fab, (pressed || !canAdd) && { opacity: 0.6 }]}>
      <LinearGradient pointerEvents="none" colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 30 }]} />
      <ClayIcon name="fabPlus" size={26} />
    </Pressable> : undefined}>
    <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
    {data && <>
      <SettingCard icon="sparkle" tone="lilac" title="Gợi ý theo thời tiết" subtitle="Wolfi đề xuất đồ nên mang dựa trên lịch trình và dự báo."
        onPress={() => router.push({ pathname: "/trip/[id]/suggestions", params: { id, type: "PACKING" } })} />
      <ResourceFeedback {...members} hasData={!!members.data} onRetry={() => { void members.reload(); }} />
      <PackingList ref={list} api={api} trip={data.trip} plan={data.plan} members={members.data ?? []} membersReady={!!members.data && !members.loading && !members.error} reload={resource.reload} />
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  fab: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", ...shadows.card },
});
