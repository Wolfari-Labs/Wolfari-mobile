import { Image } from "expo-image";
import { openURL } from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useApi } from "@/shared/api/use-api";
import { useCommand } from "@/shared/hooks/use-command";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, shadows, typography } from "@/shared/theme/tokens";
import { type DesignIconName } from "@/shared/ui/design-assets";
import { DesignIcon } from "@/shared/ui/design-icon";
import { Feedback } from "@/shared/ui/feedback";
import { EmptyState, ResourceFeedback } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { ClayButton, ClayIcon } from "@/shared/ui/setting-card";
import { usePlaceSelection } from "../components/place-selection";
import { useTrip } from "../hooks/use-trip";
import { centerOf, durationLabel, formActivityType } from "../model/place";
import { coordsOf, fromPoi, fromSaved, matchingLocation, storeLocation, type PlaceItem } from "../model/place-item";
import { activityDay, calendarLabel, sortedActivities, timeLabel, tripDays } from "../utils";

function usePlaceLookup(id: string, placeId: string | undefined, searchName: string | undefined, providerId: string | null | undefined,
  latitude: number | undefined, longitude: number | undefined, enabled: boolean) {
  const api = useApi();
  return useResource(useCallback(async (signal: AbortSignal): Promise<PlaceItem | undefined> => {
    if (!searchName || !placeId) return;
    if (providerId || placeId.startsWith("poi:")) {
      const result = await api.trips.poiSearch(id, { q: searchName, category: "all", latitude, longitude, limit: 40 }, signal);
      const poi = result.data.find(p => providerId ? p.id === providerId : "poi:" + p.id === placeId);
      return poi && fromPoi(poi);
    }
    const result = await api.trips.searchPlaces(id, searchName, signal);
    const item = result.data.find(p => "search:" + p.id === placeId);
    if (item) return { id: placeId, name: item.name, address: item.address, ...item.coordinates, attribution: result.meta.attribution ?? [], source: "Dịch vụ địa điểm" };
  }, [api, id, placeId, searchName, providerId, latitude, longitude]), enabled);
}

export default function PlaceDetailScreen() {
  const { placeId, activityId, q } = useLocalSearchParams<{ placeId?: string; activityId?: string; q?: string }>();
  const resource = useTrip();
  const { id, data, api } = resource;
  const command = useCommand();
  const { place: selected } = usePlaceSelection();
  const cached = selected?.id === placeId ? selected : undefined;
  const savedById = data?.plan.selected_locations.find(p => p.id === placeId);
  const providerId = savedById?.provider_place_id;
  const searchName = savedById?.name ?? q;
  const center = savedById ? coordsOf(fromSaved(savedById)) : centerOf((data?.plan.selected_locations ?? []).flatMap(p => coordsOf(fromSaved(p)) ?? []));
  const latitude = center?.latitude, longitude = center?.longitude;
  const needsSearch = !!q && !cached && !!data && (placeId?.startsWith("poi:") || placeId?.startsWith("search:")) === true;
  const lookup = usePlaceLookup(id, placeId, searchName, providerId, latitude, longitude, needsSearch || !!providerId);
  // Keep the group's saved identity/address while enriching it with its provider's photo and tips.
  const place = savedById ? { ...lookup.data, ...fromSaved(savedById) } : cached ?? lookup.data;
  const saved = place && data && matchingLocation(data.plan.selected_locations, place);
  const activities = saved && data ? sortedActivities(data.plan.activities.filter(a => a.selected_location_id === saved.id)) : [];
  const activity = activities.find(a => a.id === activityId) ?? activities[0];
  const trip = data?.trip;
  const days = trip ? tripDays(trip) : [];
  const day = activity && trip ? activityDay(activity, trip.timezone) : undefined;
  const dayLabel = day && days.includes(day) ? "Ngày " + (days.indexOf(day) + 1) : undefined;
  const writable = !!data?.plan.permissions.can_edit && !resource.loading && !resource.error && !command.busy;
  const [linkError, setLinkError] = useState<string>();
  const back = () => router.canGoBack() ? router.back() : router.replace({ pathname: "/trip/[id]/places", params: { id } });
  async function save() {
    if (saved || !place || !data?.plan.capabilities?.locations_write || !writable) return saved;
    const version = data.plan.plan_version;
    const added = await command.run({ placeId, version }, key => storeLocation(api.trips, id, place, version, key));
    if (added) await resource.reload();
    return added;
  }
  async function add() {
    if (!place || !writable) return;
    const location = saved ?? await save();
    if (!location && data?.plan.capabilities?.locations_write) return;
    router.push({ pathname: "/trip/[id]/activity", params: { id, title: place.name, note: place.address,
      ...(location ? { locationId: location.id } : {}), ...(place.durationMin ? { duration: String(place.durationMin) } : {}),
      ...(place.activityType ? { activityType: formActivityType(place.activityType) } : {}) } });
  }
  if (!data || !place || !trip) return <Screen title="Chi tiết địa điểm" onBack={back}>
    <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
    {needsSearch && <ResourceFeedback {...lookup} hasData={!!lookup.data} onRetry={() => { void lookup.reload(); }} />}
    {data && !lookup.loading && !lookup.error && <EmptyState scene="notFound" title="Chưa tìm thấy địa điểm" message="Mở bản đồ để chọn lại địa điểm của chuyến đi." icon="pin" action={<ClayButton label="Về bản đồ" onPress={back} />} />}
  </Screen>;
  const showItinerary = () => router.push({ pathname: "/trip/[id]/itinerary", params: { id, day: day ?? "unscheduled" } });
  return <Screen immersive clay footer={activity ? <View style={styles.actions}>
    {data.plan.permissions.can_edit && <View style={styles.flex}><ClayButton label="Chỉnh sửa" tone="secondary" disabled={!writable} onPress={() => router.push({ pathname: "/trip/[id]/activity", params: { id, activityId: activity.id } })} /></View>}
    <View style={styles.flex}><ClayButton label="Xem lịch trình" onPress={showItinerary} /></View>
  </View> : data.plan.permissions.can_edit && <ClayButton label="Thêm vào lịch trình" disabled={!writable} loading={command.busy} onPress={() => { void add(); }} />}>
    <View style={styles.hero}>
      {place.photo ? <Image source={{ uri: place.photo.fullUri ?? place.photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={"Ảnh " + place.name} alt={"Ảnh " + place.name} />
        : <DesignIcon name="pin" size={96} tintColor={colors.tealPressed} />}
      <View style={styles.chrome} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={back} style={styles.round}><DesignIcon name="back" size={22} /></Pressable>
        {saved ? <View accessible accessibilityLabel="Đã lưu cho nhóm" style={styles.round}><ClayIcon name="checkMint" size={24} /></View>
          : data.plan.capabilities?.locations_write && data.plan.permissions.can_edit && <Pressable accessibilityRole="button" accessibilityLabel="Lưu địa điểm cho nhóm" disabled={!writable} onPress={() => { void save(); }} style={styles.round}><ClayIcon name="heart" size={22} /></Pressable>}
      </View>
      {activity && <View style={styles.badge}><ClayIcon name="checkMint" size={16} /><Text style={typography.footnote}>{dayLabel ? "Đã thêm vào " + dayLabel : "Đã thêm vào lịch trình"}</Text></View>}
    </View>
    <View style={styles.panel}>
      <Text accessibilityRole="header" style={typography.largeTitle}>{place.name}</Text>
      {!!place.address && <View style={styles.line}><ClayIcon name="fieldPin" size={20} /><Text style={[typography.body, styles.flex]}>{place.address}</Text></View>}
      <View style={styles.actions}>
        <Fact icon="clock" label="Thời gian gợi ý" value={durationLabel(place.durationMin) || "Chưa rõ"} />
        <Fact icon="wallet" label="Chi phí" value="Chưa có giá" />
        <Fact icon="compass" label="Loại hình" value={place.categoryLabel || "Địa điểm"} />
      </View>
      {!!activity?.public_description && <View style={{ gap: 4 }}><Text style={typography.section}>Giới thiệu</Text><Text style={typography.body}>{activity.public_description}</Text></View>}
      {!!place.dressHint && <View style={{ gap: 4 }}><Text style={typography.section}>Khi ghé thăm</Text><Text style={typography.body}>Trang phục gợi ý · {place.dressHint}</Text></View>}
      {activities.length > 0 && <View style={styles.schedule}><Text accessibilityRole="header" style={typography.section}>Trong lịch của bạn</Text>
        {activities.map(item => {
          const date = activityDay(item, trip.timezone);
          const index = date ? days.indexOf(date) : -1;
          return <View key={item.id}><Text style={typography.headline}>{date ? (index >= 0 ? "Ngày " + (index + 1) + " · " : "") + calendarLabel(date) : "Chưa xếp ngày"}</Text>
            <Text style={typography.body}>{[item.starts_at && [timeLabel(item.starts_at, trip.timezone), item.ends_at && timeLabel(item.ends_at, trip.timezone)].filter(Boolean).join(" – "), item.title].filter(Boolean).join(" · ")}</Text></View>;
        })}</View>}
      {place.latitude !== null && place.longitude !== null && <ClayButton compact tone="soft" label="Chỉ đường" onPress={() => { void openURL(`https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`).catch(() => setLinkError("Chưa thể mở chỉ đường.")); }} />}
      <Text style={typography.footnote}>Nguồn địa điểm · {place.source}</Text>
      {[...place.attribution, ...(place.photo ? [{ text: place.photo.attribution, url: place.photo.sourceUrl }] : [])].map(({ text, url }, i) => <Text key={i} accessibilityRole="link" style={styles.credit} onPress={() => { void openURL(url).catch(() => setLinkError("Chưa thể mở nguồn.")); }}>{text}</Text>)}
      {(linkError || command.error || resource.error) && <Feedback message={linkError || command.error || resource.error!} />}
    </View>
  </Screen>;
}

function Fact({ icon, label, value }: { icon: DesignIconName; label: string; value: string }) {
  return <View style={styles.fact}><DesignIcon name={icon} size={24} tintColor={icon === "clock" ? colors.violet : icon === "wallet" ? colors.pinGreen : colors.blue} /><Text style={[typography.headline, styles.center]}>{value}</Text><Text style={[typography.footnote, styles.center]}>{label}</Text></View>;
}
const styles = StyleSheet.create({
  hero: { height: 292, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  chrome: { position: "absolute", top: 14, left: 18, right: 18, flexDirection: "row", justifyContent: "space-between" },
  round: { width: 44, height: 44, justifyContent: "center", alignItems: "center", borderRadius: 22, backgroundColor: colors.surface, ...shadows.floating },
  badge: { position: "absolute", bottom: 35, left: 24, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.mint, flexDirection: "row", gap: 6, alignItems: "center" },
  panel: { marginTop: -20, backgroundColor: colors.canvas, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, gap: 16 },
  actions: { flexDirection: "row", gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  line: { flexDirection: "row", alignItems: "center", gap: 6 },
  fact: { flex: 1, paddingVertical: 14, paddingHorizontal: 3, gap: 5, alignItems: "center", backgroundColor: colors.surface, borderRadius: 20, ...shadows.glass },
  center: { textAlign: "center" },
  schedule: { backgroundColor: colors.mint, borderRadius: 22, padding: 16, gap: 8 },
  credit: { ...typography.footnote, color: colors.tealPressed, textDecorationLine: "underline" },
});
