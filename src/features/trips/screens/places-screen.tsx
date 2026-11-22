import { openURL } from "expo-linking";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ApiError } from "@/shared/api/api-client";
import { errorMessage } from "@/shared/api/errors";
import { useCommand } from "@/shared/hooks/use-command";
import { colors, fonts, radii, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { EmptyState, Notice, ResourceFeedback, Segments } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { Sheet } from "@/shared/ui/sheet";
import { PlaceCard, type PlaceItem } from "../components/place-card";
import { TripMap, type MapPoint, type MapRoute } from "../components/trip-map";
import { TripNavigation } from "../components/trip-navigation";
import { useTrip } from "../hooks/use-trip";
import {
  DEFAULT_CENTER,
  POI_GROUPS,
  centerOf,
  distanceLabel,
  durationLabel,
  formActivityType,
  regionBbox,
  straightLine,
  validCoordinates,
  type MapRegion,
} from "../model/place";
import type { Activity, PoiCategory, PoiPlace, PoiQuery, RouteMode, SelectedLocation } from "../types";
import { activityDay, sortedActivities, timeLabel, tripDays } from "../utils";

type Tab = "saved" | "explore" | "route";
/** Metres per second for walking estimates (~4.5 km/h). */
const WALKING_SPEED = 1.25;
const groupIcon = (category?: string) => POI_GROUPS.find((group) => group.value === category)?.icon;
const travelWarnings: Record<string, string> = {
  OPENING_HOURS_NOT_AVAILABLE: "Chưa có giờ mở cửa. Hãy kiểm tra trước khi ghé thăm.",
  STALE_CACHE: "Thông tin gần nhất được lưu tạm và có thể đã thay đổi.",
};

function fromPoi(place: PoiPlace): PlaceItem {
  return {
    id: "poi:" + place.id,
    name: place.name,
    address: place.address ?? place.province_name ?? "",
    latitude: place.coordinates.latitude,
    longitude: place.coordinates.longitude,
    token: place.selection_token,
    icon: groupIcon(place.category_group ?? undefined) ?? "📍",
    categoryLabel: place.category_label || undefined,
    durationMin: place.typical_duration_min,
    activityType: place.activity_type,
    dressHint: place.dress_code_hint || undefined,
    verified: place.coord_verified,
    source: `Dữ liệu: ${place.attribution || "OpenStreetMap"}`,
    attribution: [],
  };
}

function fromSaved(location: SelectedLocation): PlaceItem {
  return {
    id: location.id,
    name: location.name,
    address: location.address ?? "",
    latitude: location.latitude === null ? null : Number(location.latitude),
    longitude: location.longitude === null ? null : Number(location.longitude),
    source: "Kế hoạch chung",
    attribution: location.metadata?.attribution ?? [],
  };
}

const near = (a: number | null, b: number | null) => (a === null ? b === null : b !== null && Math.abs(a - b) < 0.0001);

export default function PlacesScreen() {
  const resource = useTrip();
  const { data, api, id } = resource;
  const command = useCommand();
  const plan = data?.plan,
    trip = data?.trip;
  const sharedWrites = plan?.capabilities?.locations_write === true;
  const editable = !!plan?.permissions.can_edit;
  const canWrite = editable && !resource.loading && !resource.error && !command.busy;
  const [tab, setTab] = useState<Tab>("saved");
  const [selected, setSelected] = useState<string>();
  const [fitKey, setFitKey] = useState(0);
  const [mapType, setMapType] = useState<"standard" | "satellite">("standard");
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  // Explore
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<PoiCategory>("tourism");
  const [results, setResults] = useState<{ items: PlaceItem[]; note?: string; mock?: boolean; warnings: string[]; truncated?: boolean }>();
  const [searching, setSearching] = useState(false);
  const [moved, setMoved] = useState<MapRegion>();
  const search = useRef<AbortController | null>(null);
  // Route
  const days = trip ? tripDays(trip) : [];
  const [day, setDay] = useState<string>();
  const [mode, setMode] = useState<RouteMode>("DRIVING");
  const [route, setRoute] = useState<{ line: MapRoute; distance: number; duration?: number; key: string }>();
  // Manual add / delete
  const [manual, setManual] = useState(false);
  const [placeName, setPlaceName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [manualError, setManualError] = useState<string>();
  const [deleting, setDeleting] = useState<PlaceItem>();
  useEffect(() => () => search.current?.abort(), []);

  const savedPlaces = (plan?.selected_locations ?? []).map(fromSaved);
  const savedCenter = centerOf(savedPlaces.flatMap((p) => (validCoordinates(p.latitude, p.longitude) ? [{ latitude: p.latitude!, longitude: p.longitude! }] : [])));
  const activitiesAt = (placeId: string) => (plan?.activities ?? []).filter((a) => a.selected_location_id === placeId);
  const sharedMatch = (place: PlaceItem) =>
    plan?.selected_locations.find((p) => p.id === place.id || (p.name === place.name && near(p.latitude === null ? null : Number(p.latitude), place.latitude) && near(p.longitude === null ? null : Number(p.longitude), place.longitude)));

  async function runSearch(next: PoiQuery & { label?: string }) {
    if (!data) return;
    search.current?.abort();
    const request = new AbortController();
    search.current = request;
    setSearching(true);
    setError(undefined);
    setSelected(undefined);
    setMoved(undefined);
    try {
      const response = await api.trips.poiSearch(id, { limit: 40, ...next }, request.signal);
      if (request.signal.aborted) return;
      setResults({
        items: response.data.map(fromPoi),
        warnings: response.meta.warnings ?? [],
        truncated: response.meta.bbox_truncated,
        note: response.meta.status === "ERROR" && !response.data.length ? "Nguồn địa điểm cho nhóm này chưa sẵn sàng. Thử nhóm khác hoặc tự thêm địa điểm." : undefined,
      });
      setFitKey((value) => value + 1);
    } catch (cause) {
      if (request.signal.aborted) return;
      // Older servers only offer text search through /travel/places.
      if (cause instanceof ApiError && cause.status === 404 && next.q) {
        try {
          const legacy = await api.trips.searchPlaces(id, next.q, request.signal);
          if (request.signal.aborted) return;
          setResults({
            mock: legacy.meta.is_mock,
            warnings: legacy.meta.warnings ?? [],
            items: legacy.data.map((p) => ({
              id: "search:" + p.id, name: p.name, address: p.address, latitude: p.coordinates.latitude, longitude: p.coordinates.longitude,
              icon: "📍", source: "Dịch vụ địa điểm", attribution: legacy.meta.attribution ?? [],
            })),
          });
          setFitKey((value) => value + 1);
          return;
        } catch (legacyCause) {
          if (!request.signal.aborted) setError(errorMessage(legacyCause) + " Bạn vẫn có thể tự nhập địa điểm.");
          return;
        }
      }
      if (cause instanceof ApiError && cause.status === 404) {
        setResults({ items: [], warnings: [], note: "Máy chủ này chỉ hỗ trợ tìm theo tên. Nhập tên địa điểm rồi bấm Tìm." });
        return;
      }
      setError(errorMessage(cause) + " Bạn vẫn có thể tự nhập địa điểm.");
    } finally {
      if (!request.signal.aborted) setSearching(false);
    }
  }
  const center = savedCenter ?? DEFAULT_CENTER;
  function searchText() {
    const q = query.trim();
    if (!q || q.length > 200) {
      setError("Nhập tên địa điểm từ 1 đến 200 ký tự.");
      return;
    }
    setTab("explore");
    void runSearch({ q, category: group, latitude: center.latitude, longitude: center.longitude });
  }
  function searchNearby(category = group) {
    void runSearch({ category, latitude: center.latitude, longitude: center.longitude, radius_m: 5000 });
  }
  function openExplore() {
    setTab("explore");
    setSelected(undefined);
    if (!results && !searching) searchNearby();
    else setFitKey((value) => value + 1);
  }

  async function saveShared(place: PlaceItem) {
    if (!canWrite || !data || !sharedWrites) return;
    const existing = sharedMatch(place);
    if (existing) return existing;
    const result = place.token
      ? await command.run({ token: place.token, version: data.plan.plan_version }, (key) =>
          api.trips.saveLocationToken(id, { selection_token: place.token!, expected_plan_version: data.plan.plan_version }, key),
        )
      : await (async () => {
          const input = {
            name: place.name.trim(), address: place.address.trim() || null,
            latitude: place.latitude === null ? null : place.latitude.toFixed(6), longitude: place.longitude === null ? null : place.longitude.toFixed(6),
            attribution: place.attribution.filter((a) => a.url.startsWith("https://")), expected_plan_version: data.plan.plan_version,
          };
          return command.run(input, (key) => api.trips.saveLocation(id, input, key));
        })();
    if (result) {
      setSaved(`Đã lưu “${place.name}” cho cả nhóm.`);
      await resource.reload();
    }
    return result;
  }
  async function addActivity(place: PlaceItem) {
    if (!canWrite) return;
    const location = sharedMatch(place) ?? (sharedWrites ? await saveShared(place) : undefined);
    if (sharedWrites && !location) return;
    router.push({
      pathname: "/trip/[id]/activity",
      params: {
        id, title: place.name, note: place.address,
        ...(location ? { locationId: location.id } : {}),
        ...(place.activityType ? { activityType: formActivityType(place.activityType) } : {}),
        ...(place.durationMin ? { duration: String(place.durationMin) } : {}),
        ...(tab === "route" && day ? { day } : {}),
      },
    });
  }
  async function addManual() {
    if (!sharedWrites || !editable) return;
    if (!placeName.trim()) { setManualError("Nhập tên địa điểm."); return; }
    const lat = latitude.trim() ? Number(latitude) : null, lon = longitude.trim() ? Number(longitude) : null;
    if ((latitude.trim() || longitude.trim()) && !validCoordinates(lat, lon)) {
      setManualError("Nhập đủ vĩ độ (-90 đến 90) và kinh độ (-180 đến 180), hoặc để trống cả hai.");
      return;
    }
    const place: PlaceItem = { id: "manual", name: placeName.trim(), address: address.trim(), latitude: lat, longitude: lon, source: "Tự nhập", attribution: [] };
    if (await saveShared(place)) {
      setManual(false); setPlaceName(""); setAddress(""); setLatitude(""); setLongitude(""); setTab("saved");
    }
  }
  async function directions(place: PlaceItem) {
    try {
      await openURL(`https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`);
    } catch {
      setError("Chưa thể mở chỉ đường trên thiết bị này.");
    }
  }

  // Day route: the day's activities that are attached to a place with coordinates, in order.
  const routeDay = day ?? days[0];
  const stops = !plan || !trip || !routeDay ? [] : sortedActivities(plan.activities.filter((a) => activityDay(a, trip.timezone) === routeDay)).flatMap((activity) => {
    const location = plan.selected_locations.find((p) => p.id === activity.selected_location_id);
    const place = location && fromSaved(location);
    return place && validCoordinates(place.latitude, place.longitude) ? [{ activity, place }] : [];
  });
  const unplaced = plan && trip && routeDay ? plan.activities.filter((a) => activityDay(a, trip.timezone) === routeDay && !stops.some((s) => s.activity.id === a.id)) : [];
  const stopKey = `${routeDay}|${mode}|` + stops.map((s) => `${s.place.latitude},${s.place.longitude}`).join(";");
  const needsRoute = tab === "route" && stops.length > 1 && route?.key !== stopKey;
  const routing = needsRoute;
  useEffect(() => {
    if (!needsRoute) return;
    // stopKey encodes the stops' coordinates in order.
    const coords = stopKey.split("|")[2].split(";").map((pair) => {
      const [lat, lon] = pair.split(",").map(Number);
      return { latitude: lat, longitude: lon };
    });
    const request = new AbortController();
    const fallback = straightLine(coords);
    api.trips.route(coords, mode, request.signal)
      .then((response) => {
        if (request.signal.aborted) return;
        setRoute(response.data
          ? {
              key: stopKey, line: { geometry: response.data.geometry, estimated: false }, distance: response.data.distance_m,
              // The server times every route by car; walking uses ~4.5 km/h over the same path.
              duration: mode === "WALKING" ? response.data.distance_m / WALKING_SPEED : response.data.duration_seconds,
            }
          : { key: stopKey, line: { geometry: fallback.geometry, estimated: true }, distance: fallback.distance_m });
        setFitKey((value) => value + 1);
      })
      .catch(() => {
        if (request.signal.aborted) return;
        // No road data (e.g. routing service not running): draw a dashed straight line.
        setRoute({ key: stopKey, line: { geometry: fallback.geometry, estimated: true }, distance: fallback.distance_m });
        setFitKey((value) => value + 1);
      })
    return () => request.abort();
  }, [needsRoute, stopKey, mode, api]);
  const activeRoute = tab === "route" && stops.length > 1 && route?.key === stopKey ? route : undefined;

  const listed: { place: PlaceItem; tone: "saved" | "result" | "stop"; marker?: string; meta?: string; activity?: Activity }[] =
    tab === "saved"
      ? savedPlaces.map((place, index) => {
          const count = activitiesAt(place.id).length;
          return { place, tone: "saved" as const, marker: String(index + 1), meta: count ? `Đã gắn với ${count} hoạt động` : "Chưa gắn với hoạt động nào" };
        })
      : tab === "explore"
        ? (results?.items ?? []).map((place) => ({ place, tone: "result" as const, meta: sharedMatch(place) ? "✓ Đã lưu cho nhóm" : undefined }))
        : stops.map((stop, index) => ({
            place: stop.place, tone: "stop" as const, marker: String(index + 1), activity: stop.activity,
            meta: stop.activity.title + (stop.activity.starts_at ? ` · ${timeLabel(stop.activity.starts_at, trip!.timezone)}` : ""),
          }));
  const points: MapPoint[] = listed.flatMap(({ place, tone, marker }) =>
    validCoordinates(place.latitude, place.longitude)
      ? [{ id: place.id, name: place.name, latitude: place.latitude!, longitude: place.longitude!, tone, label: marker ?? place.icon }]
      : [],
  );
  const switchTab = (next: Tab) => {
    if (next === "explore") { openExplore(); return; }
    setTab(next);
    setSelected(undefined);
    setFitKey((value) => value + 1);
  };

  return (
    <Screen title={trip?.name ?? "Bản đồ & địa điểm"} tab="trips" onRefresh={() => { void resource.reload(); }} refreshing={resource.loading && !!data}>
      <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
      {data && plan && trip && (
        <>
          <TripNavigation id={id} active="places" />
          {!sharedWrites && <Text style={typography.footnote}>Máy chủ chưa hỗ trợ lưu địa điểm cho nhóm. Bạn vẫn có thể tìm và thêm hoạt động.</Text>}
          <Segments
            value={tab}
            onChange={switchTab}
            items={[
              { value: "saved", label: `Của nhóm · ${savedPlaces.length}` },
              { value: "explore", label: "Tìm quanh đây" },
              { value: "route", label: "Lộ trình" },
            ]}
          />

          {tab === "explore" && (
            <View style={styles.searchBox}>
              <View style={styles.searchRow}>
                <View style={{ flex: 1 }}>
                  <FormField label="Khám phá địa điểm" icon="search" value={query} onChangeText={setQuery} placeholder="Tìm địa điểm, quán ăn…"
                    maxLength={200} returnKeyType="search" onSubmitEditing={searchText} />
                </View>
                <Button label="Tìm" accessibilityLabel="Tìm địa điểm" compact loading={searching} style={styles.searchButton} onPress={searchText} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {POI_GROUPS.map((item) => (
                  <Pressable cssInterop={false} key={item.value} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: group === item.value }}
                    onPress={() => { setGroup(item.value); if (query.trim()) void runSearch({ q: query.trim(), category: item.value, latitude: center.latitude, longitude: center.longitude }); else searchNearby(item.value); }}
                    style={({ pressed }) => [styles.chip, group === item.value && styles.chipActive, pressed && { opacity: 0.7 }]}>
                    <Text style={[styles.chipText, group === item.value && styles.chipTextActive]}>{item.icon} {item.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          {tab === "route" && (
            <View style={styles.searchBox}>
              <Segments scroll value={routeDay ?? ""} onChange={(value) => { setDay(value); setSelected(undefined); }}
                items={days.map((value, index) => ({ value, label: `Ngày ${index + 1} · ${value.slice(8)}/${value.slice(5, 7)}` }))} />
              <View style={styles.chips}>
                {([["DRIVING", "🚗 Ô tô, xe máy"], ["WALKING", "🚶 Đi bộ"]] as const).map(([value, label]) => (
                  <Pressable cssInterop={false} key={value} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: mode === value }} onPress={() => setMode(value)}
                    style={({ pressed }) => [styles.chip, mode === value && styles.chipActive, pressed && { opacity: 0.7 }]}>
                    <Text style={[styles.chipText, mode === value && styles.chipTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View>
            <TripMap points={points} selectedId={selected} onSelect={setSelected} route={activeRoute?.line} mapType={mapType} fitKey={`${tab}:${fitKey}`}
              onUserMove={tab === "explore" ? setMoved : undefined} />
            <View style={styles.overlay} pointerEvents="box-none">
              {tab === "explore" && moved && (
                <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Tìm trong khu vực này"
                  onPress={() => void runSearch({ bbox: regionBbox(moved), category: group, limit: 150 })} style={({ pressed }) => [styles.floating, pressed && { opacity: 0.8 }]}>
                  <Text style={styles.floatingText}>🔍 Tìm trong khu vực này</Text>
                </Pressable>
              )}
              {Platform.OS !== "web" && (
                <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={mapType === "standard" ? "Xem ảnh vệ tinh" : "Xem bản đồ đường"}
                  onPress={() => setMapType((value) => (value === "standard" ? "satellite" : "standard"))} style={({ pressed }) => [styles.floating, styles.floatingSmall, pressed && { opacity: 0.8 }]}>
                  <Text style={styles.floatingText}>{mapType === "standard" ? "🛰️" : "🗺️"}</Text>
                </Pressable>
              )}
            </View>
          </View>

          {tab === "route" && stops.length > 1 && (
            <View style={styles.summary}>
              {routing && !activeRoute ? <Text style={typography.footnote}>Đang tính lộ trình…</Text> : activeRoute && (
                <>
                  <Text style={typography.headline}>
                    {distanceLabel(activeRoute.distance)}
                    {activeRoute.duration ? ` · ${durationLabel(activeRoute.duration / 60)}` : ""}
                  </Text>
                  <Text style={typography.footnote}>
                    {activeRoute.line.estimated
                      ? "Đường chim bay (nét đứt) · chưa có dữ liệu chỉ đường, khoảng cách thực tế sẽ dài hơn."
                      : `Theo đường đi qua ${stops.length} điểm · ${mode === "WALKING" ? "thời gian đi bộ ước tính ~4,5 km/h" : "thời gian ước tính khi đi xe"}.`}
                  </Text>
                </>
              )}
            </View>
          )}

          {saved && <Feedback success message={saved} />}
          {error && <Feedback message={error} />}
          {command.error && <><Feedback message={command.error} /><Button label="Tải lại địa điểm của nhóm" variant="soft" onPress={() => { command.clearError(); void resource.reload(); }} /></>}
          {tab === "explore" && results?.mock && <Notice>Kết quả từ nguồn dữ liệu mô phỏng của môi trường thử nghiệm.</Notice>}
          {tab === "explore" && results?.truncated && <Text style={typography.footnote}>Có nhiều địa điểm trong khung này; phóng to bản đồ để xem đủ.</Text>}
          {tab === "explore" && results?.warnings.map((warning) => travelWarnings[warning] ? <Text key={warning} style={typography.footnote}>{travelWarnings[warning]}</Text> : null)}
          {tab === "explore" && results?.note && <Notice>{results.note}</Notice>}
          {tab === "saved" && editable && sharedWrites && (
            <Button label="Thêm địa điểm cho nhóm" variant="soft" compact icon="plus" disabled={!canWrite} onPress={() => { setManualError(undefined); setManual(true); }} />
          )}

          {listed.map(({ place, tone, marker, meta }) => {
            const savedRow = tab === "saved" ? plan.selected_locations.find((p) => p.id === place.id) : sharedMatch(place);
            const hasCoords = validCoordinates(place.latitude, place.longitude);
            return (
              <PlaceCard key={place.id} place={place} tone={tone} marker={marker} meta={meta} selected={selected === place.id}
                onPress={hasCoords ? () => { setSelected(place.id); } : undefined}>
                {editable && sharedWrites && tab === "explore" && !savedRow && (
                  <Button label="Lưu cho nhóm" accessibilityLabel={`Lưu ${place.name} cho nhóm`} compact variant="soft" disabled={!canWrite} onPress={() => { void saveShared(place); }} />
                )}
                {editable && tab !== "route" && (
                  <Button label="Thêm vào lịch trình" accessibilityLabel={`Thêm hoạt động tại ${place.name}`} compact disabled={!canWrite} onPress={() => { void addActivity(place); }} />
                )}
                {hasCoords && <Button label="Chỉ đường" accessibilityLabel={`Chỉ đường tới ${place.name}`} compact variant="text" onPress={() => { void directions(place); }} />}
                {editable && sharedWrites && tab === "saved" && !activitiesAt(place.id).length && (
                  <Button label="Xóa" accessibilityLabel={`Xóa ${place.name} khỏi nhóm`} compact variant="text" disabled={!canWrite} onPress={() => setDeleting(place)} />
                )}
              </PlaceCard>
            );
          })}

          {tab === "saved" && !savedPlaces.length && (
            <EmptyState title="Chưa có điểm dừng" message="Mở tab Tìm quanh đây để tìm nơi muốn đến rồi lưu cho cả nhóm." icon="pin"
              action={<Button label="Khám phá quanh đây" compact onPress={openExplore} />} />
          )}
          {tab === "explore" && !searching && results && !results.items.length && !results.note && (
            <EmptyState title="Thử một ý tưởng khác nhé" message="Đổi nhóm địa điểm, tìm theo tên hoặc kéo bản đồ rồi bấm “Tìm trong khu vực này”." icon="pin" />
          )}
          {tab === "route" && stops.length < 2 && (
            <EmptyState title={stops.length ? "Cần thêm một điểm dừng" : "Ngày này chưa có điểm dừng"}
              message="Lộ trình nối các hoạt động trong ngày đã gắn địa điểm. Mở một hoạt động và chọn địa điểm của nhóm để thêm vào lộ trình." icon="map" />
          )}
          {tab === "route" && unplaced.length > 0 && (
            <Text style={typography.footnote}>
              Chưa có trên lộ trình: {unplaced.map((a) => a.title).join(", ")} (chưa gắn địa điểm).
            </Text>
          )}

          <Sheet visible={!!deleting} title="Xóa địa điểm khỏi nhóm?" dismissible={!command.busy} onClose={() => setDeleting(undefined)}>
            <Text style={typography.body}>{deleting?.name} sẽ bị xóa khỏi danh sách chung. Địa điểm đang gắn với hoạt động phải được gỡ khỏi hoạt động trước.</Text>
            {command.error && <Feedback message={command.error} />}
            <Button label="Xác nhận xóa địa điểm" variant="destructive" loading={command.busy} disabled={!canWrite} onPress={() => { void (async () => {
              if (!deleting || !canWrite) return;
              const result = await command.run({ remove: deleting.id, version: plan.plan_version }, (key) => api.trips.removeLocation(id, deleting.id, plan.plan_version, key));
              if (result) { setDeleting(undefined); await resource.reload(); }
            })(); }} />
          </Sheet>
          <Sheet visible={manual} title="Địa điểm của nhóm" dismissible={!command.busy} onClose={() => setManual(false)}>
            <Notice>Địa điểm được lưu vào kế hoạch chung của nhóm. Tọa độ không bắt buộc; cần đủ hai tọa độ để hiện trên bản đồ.</Notice>
            {command.error && <Feedback message={command.error} />}
            <FormField label="Tên địa điểm" icon="pin" value={placeName} onChangeText={setPlaceName} maxLength={200} editable={!command.busy} />
            <FormField label="Địa chỉ" icon="map" value={address} onChangeText={setAddress} maxLength={500} editable={!command.busy} />
            <FormField label="Vĩ độ" icon="pin" value={latitude} onChangeText={setLatitude} placeholder="16.0544" maxLength={20} editable={!command.busy} />
            <FormField label="Kinh độ" icon="pin" value={longitude} onChangeText={setLongitude} placeholder="108.2022" maxLength={20} editable={!command.busy} />
            {manualError && <Feedback message={manualError} />}
            <Button label="Lưu địa điểm cho nhóm" disabled={!canWrite} loading={command.busy} onPress={() => { void addManual(); }} />
          </Sheet>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBox: { gap: 10 },
  searchRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  searchButton: { marginBottom: 4 },
  chipRow: { flexDirection: "row", gap: 6, paddingVertical: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { minHeight: 36, justifyContent: "center", paddingHorizontal: 12, borderRadius: radii.pill, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.ink },
  chipText: { color: colors.ink, fontSize: 13, fontFamily: fonts.bold },
  chipTextActive: { color: colors.surface },
  overlay: { position: "absolute", top: 10, left: 10, right: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", zIndex: 500 },
  floating: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: colors.surface, boxShadow: "0 4px 12px rgba(23,63,99,0.22)" },
  floatingSmall: { marginLeft: "auto", paddingHorizontal: 10 },
  floatingText: { color: colors.ink, fontSize: 13, fontFamily: fonts.bold },
  summary: { gap: 4, padding: 14, borderRadius: radii.card, backgroundColor: colors.surface },
});
