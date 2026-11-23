import { openURL } from "expo-linking";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ApiError } from "@/shared/api/api-client";
import { getApiBaseUrl } from "@/shared/config/env";
import { errorMessage } from "@/shared/api/errors";
import { useCommand } from "@/shared/hooks/use-command";
import { colors, fonts, radii, shadows, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { DesignIcon } from "@/shared/ui/design-icon";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { GlassSurface } from "@/shared/ui/glass-surface";
import { EmptyState, Notice, ResourceFeedback } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { Sheet } from "@/shared/ui/sheet";
import { toast } from "@/shared/ui/toast";
import { PlaceCard, type PlaceItem } from "../components/place-card";
import { TripMap, type MapPoint, type MapRoute } from "../components/trip-map";
import { switchTripSection, TripNavigation } from "../components/trip-navigation";
import { useTrip } from "../hooks/use-trip";
import { activityMinutes, nextSlot } from "../model/auto-schedule";
import {
  DEFAULT_CENTER,
  POI_GROUPS,
  centerOf,
  distanceLabel,
  durationLabel,
  formActivityType,
  poiImageUrl,
  prettyAttribution,
  regionBbox,
  straightLine,
  validCoordinates,
  type LatLng,
  type MapRegion,
} from "../model/place";
import type { Activity, Plan, PoiCategory, PoiPlace, PoiQuery, RouteMode, SelectedLocation, Trip } from "../types";
import { activityDay, calendarLabel, sortedActivities, timeLabel, tripDays } from "../utils";

type Tab = "saved" | "explore" | "route";
/** Metres per second for time estimates when only a car route (or no route) is known. */
const SPEED: Record<RouteMode, number> = { DRIVING: 8.3, WALKING: 1.25, CYCLING: 4.2 };
const MODES: { value: RouteMode; label: string }[] = [
  { value: "DRIVING", label: "🛵 Xe máy, ô tô" },
  { value: "WALKING", label: "🚶 Đi bộ" },
  { value: "CYCLING", label: "🚲 Xe đạp" },
];
const MAP_HEIGHT = 340;
const PAGE = 12;
const groupIcon = (category?: string) => POI_GROUPS.find((group) => group.value === category)?.icon;
const travelWarnings: Record<string, string> = {
  OPENING_HOURS_NOT_AVAILABLE: "Chưa có giờ mở cửa. Hãy kiểm tra trước khi ghé thăm.",
  STALE_CACHE: "Thông tin gần nhất được lưu tạm và có thể đã thay đổi.",
};

function fromPoi(place: PoiPlace): PlaceItem {
  const image = place.hero_image;
  const uri = image ? poiImageUrl(image.thumbnail_url, getApiBaseUrl()) : undefined;
  return {
    ...(uri && image?.attribution && image.source_url ? { photo: { uri, attribution: image.attribution, sourceUrl: image.source_url } } : {}),
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
    source: prettyAttribution(place.attribution || "OpenStreetMap"),
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
const coordsOf = (place: PlaceItem): LatLng | undefined => (validCoordinates(place.latitude, place.longitude) ? { latitude: place.latitude!, longitude: place.longitude! } : undefined);

type RouteState = { line: MapRoute; distance: number; duration?: number; key: string; basis: "road" | "car-estimate" | "straight"; attribution: { text: string; url: string | null }[] };

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
  const [limit, setLimit] = useState(PAGE);
  // Explore
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<PoiCategory>("tourism");
  const [results, setResults] = useState<{ items: PlaceItem[]; note?: string; mock?: boolean; warnings: string[]; truncated?: boolean }>();
  const [searching, setSearching] = useState(false);
  const [moved, setMoved] = useState<MapRegion>();
  const search = useRef<AbortController | null>(null);
  const lastSearch = useRef("");
  // Route
  const days = useMemo(() => (trip ? tripDays(trip) : []), [trip]);
  const [day, setDay] = useState<string>();
  const [mode, setMode] = useState<RouteMode>("DRIVING");
  const [route, setRoute] = useState<RouteState>();
  // Manual add / delete / quick add
  const [manual, setManual] = useState(false);
  const [placeName, setPlaceName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [manualError, setManualError] = useState<string>();
  const [deleting, setDeleting] = useState<PlaceItem>();
  const [adding, setAdding] = useState<PlaceItem>();
  useEffect(() => () => search.current?.abort(), []);

  const savedPlaces = useMemo(() => (plan?.selected_locations ?? []).map(fromSaved), [plan?.selected_locations]);
  const savedCenter = useMemo(() => centerOf(savedPlaces.flatMap((p) => coordsOf(p) ?? [])), [savedPlaces]);
  const center = savedCenter ?? DEFAULT_CENTER;
  const activitiesAt = (placeId: string) => (plan?.activities ?? []).filter((a) => a.selected_location_id === placeId);
  const sharedMatch = (place: PlaceItem) =>
    plan?.selected_locations.find((p) => p.id === place.id || (p.name === place.name && near(p.latitude === null ? null : Number(p.latitude), place.latitude) && near(p.longitude === null ? null : Number(p.longitude), place.longitude)));

  async function runSearch(next: PoiQuery) {
    if (!data) return;
    search.current?.abort();
    const request = new AbortController();
    search.current = request;
    lastSearch.current = JSON.stringify(next);
    setSearching(true);
    setError(undefined);
    setMoved(undefined);
    setLimit(PAGE);
    try {
      const response = await api.trips.poiSearch(id, { limit: 40, ...next }, request.signal);
      if (request.signal.aborted) return;
      setResults({
        items: response.data.map(fromPoi),
        warnings: response.meta.warnings ?? [],
        truncated: response.meta.bbox_truncated,
        note: response.meta.status === "ERROR" && !response.data.length ? "Nguồn địa điểm cho nhóm này chưa sẵn sàng. Thử nhóm khác hoặc tự thêm địa điểm." : undefined,
      });
      setSelected(undefined);
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
  const textQuery = (q: string, category: PoiCategory): PoiQuery => ({ q, category, latitude: center.latitude, longitude: center.longitude });
  const nearbyQuery = (category: PoiCategory): PoiQuery => ({ category, latitude: center.latitude, longitude: center.longitude, radius_m: 5000 });
  function searchText() {
    const q = query.trim();
    if (!q || q.length > 200) {
      setError("Nhập tên địa điểm từ 1 đến 200 ký tự.");
      return;
    }
    setTab("explore");
    void runSearch(textQuery(q, group));
  }
  // Results follow the text as it is typed (debounced), so the map fills in while typing.
  const typed = query.trim();
  useEffect(() => {
    if (tab !== "explore" || typed.length < 2 || typed.length > 200) return;
    const next = textQuery(typed, group);
    if (lastSearch.current === JSON.stringify(next)) return;
    const timer = setTimeout(() => void runSearch(next), 380);
    return () => clearTimeout(timer);
  });
  function openExplore() {
    setTab("explore");
    setSelected(undefined);
    if (!results && !searching) void runSearch(nearbyQuery(group));
    else setFitKey((value) => value + 1);
  }

  async function saveShared(place: PlaceItem, quiet = false) {
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
      if (!quiet) toast.success(`Đã lưu “${place.name}” cho cả nhóm.`, { icon: "pin" });
      await resource.reload();
    }
    return result;
  }
  function customize(place: PlaceItem, chosenDay?: string, locationId?: string) {
    router.push({
      pathname: "/trip/[id]/activity",
      params: {
        id, title: place.name, note: place.address,
        ...(locationId ? { locationId } : {}),
        ...(place.activityType ? { activityType: formActivityType(place.activityType) } : {}),
        ...(place.durationMin ? { duration: String(place.durationMin) } : {}),
        ...(chosenDay && chosenDay !== "unscheduled" ? { day: chosenDay } : {}),
      },
    });
  }
  /** One step from the map to the plan: save the place if needed, then create the activity. */
  async function quickAdd(place: PlaceItem, chosenDay: string, slot?: { starts_at: string; ends_at: string }) {
    if (!canWrite || !data) return false;
    const location = sharedMatch(place) ?? (sharedWrites ? await saveShared(place, true) : undefined);
    if (sharedWrites && !location) return false;
    let latest: Plan;
    try {
      latest = await api.trips.plan(id);
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    }
    const input = {
      title: place.name.trim().slice(0, 255),
      activity_type: place.activityType ? formActivityType(place.activityType) : "SIGHTSEEING",
      description: place.address.trim() || null,
      public_description: null,
      selected_location_id: location?.id ?? null,
      position: latest.activities.length,
      expected_plan_version: latest.plan_version,
      ...(slot ? { starts_at: slot.starts_at, ends_at: slot.ends_at } : { starts_at: null, ends_at: null, scheduled_date: chosenDay === "unscheduled" ? null : chosenDay }),
    };
    const created = await command.run({ quickAdd: place.id, ...input }, (key) => api.trips.saveActivity(id, undefined, input, key));
    if (!created || !trip) return false;
    const where = chosenDay === "unscheduled" ? "mục Chưa xếp lịch" : `Ngày ${days.indexOf(chosenDay) + 1}${slot ? ` · ${timeLabel(slot.starts_at, trip.timezone)}` : ""}`;
    toast.success(`Đã thêm “${place.name}” vào ${where}.`, {
      icon: "calendar",
      action: { label: "Xem", onPress: () => switchTripSection(id, "places", "itinerary") },
    });
    await resource.reload();
    return true;
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
      await openURL(`https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}${mode === "WALKING" ? "&travelmode=walking" : mode === "CYCLING" ? "&travelmode=bicycling" : ""}`);
    } catch {
      setError("Chưa thể mở chỉ đường trên thiết bị này.");
    }
  }

  // Day route: the day's activities that are attached to a place with coordinates, in order.
  const routeDay = day ?? days[0];
  const stops = useMemo(() => !plan || !trip || !routeDay ? [] : sortedActivities(plan.activities.filter((a) => activityDay(a, trip.timezone) === routeDay)).flatMap((activity) => {
    const location = plan.selected_locations.find((p) => p.id === activity.selected_location_id);
    const place = location && fromSaved(location);
    return place && validCoordinates(place.latitude, place.longitude) ? [{ activity, place }] : [];
  }), [plan, trip, routeDay]);
  const unplaced = plan && trip && routeDay ? plan.activities.filter((a) => activityDay(a, trip.timezone) === routeDay && !stops.some((s) => s.activity.id === a.id)) : [];
  const stopKey = `${routeDay}|${mode}|` + stops.map((s) => `${s.place.latitude},${s.place.longitude}`).join(";");
  const needsRoute = tab === "route" && stops.length > 1 && route?.key !== stopKey;
  useEffect(() => {
    if (!needsRoute) return;
    const coords = stopKey.split("|")[2].split(";").map((pair) => {
      const [lat, lon] = pair.split(",").map(Number);
      return { latitude: lat, longitude: lon };
    });
    const request = new AbortController();
    const fallback = straightLine(coords);
    const straight = (): RouteState => ({ key: stopKey, line: { geometry: fallback.geometry, estimated: true }, distance: fallback.distance_m, duration: fallback.distance_m / SPEED[mode], basis: "straight", attribution: [] });
    const finish = (value: RouteState) => {
      if (request.signal.aborted) return;
      setRoute(value);
      setFitKey((current) => current + 1);
    };
    (async () => {
      try {
        const response = await api.trips.route(coords, mode, request.signal);
        if (!response.data) return finish(straight());
        // A car-profile answer for walking/cycling: road path, time from distance.
        const carOnly = mode !== "DRIVING" && response.meta.warnings?.includes("ESTIMATED_BY_CAR_PROFILE");
        return finish({
          key: stopKey, line: { geometry: response.data.geometry, estimated: false }, distance: response.data.distance_m,
          duration: carOnly ? response.data.distance_m / SPEED[mode] : response.data.duration_seconds,
          basis: carOnly ? "car-estimate" : "road", attribution: response.meta.attribution ?? [],
        });
      } catch {
        if (request.signal.aborted) return;
        // No walking/cycling server: follow the road network by car and estimate the time.
        if (mode !== "DRIVING") {
          try {
            const car = await api.trips.route(coords, "DRIVING", request.signal);
            if (car.data)
              return finish({
                key: stopKey, line: { geometry: car.data.geometry, estimated: false }, distance: car.data.distance_m,
                duration: car.data.distance_m / SPEED[mode], basis: "car-estimate", attribution: car.meta.attribution ?? [],
              });
          } catch {
            // Fall through to the straight line.
          }
        }
        finish(straight());
      }
    })();
    return () => request.abort();
  }, [needsRoute, stopKey, mode, api]);
  const activeRoute = tab === "route" && stops.length > 1 && route?.key === stopKey ? route : undefined;

  type Row = { place: PlaceItem; tone: "saved" | "result" | "stop"; marker?: string; meta?: string; activity?: Activity };
  const listed: Row[] = useMemo(() =>
    tab === "saved"
      ? savedPlaces.map((place, index) => {
          const count = (plan?.activities ?? []).filter((a) => a.selected_location_id === place.id).length;
          return { place, tone: "saved" as const, marker: String(index + 1), meta: count ? `Đã gắn với ${count} hoạt động` : "Chưa gắn với hoạt động nào" };
        })
      : tab === "explore"
        ? (results?.items ?? []).map((place) => ({ place, tone: "result" as const }))
        : stops.map((stop, index) => ({
            place: stop.place, tone: "stop" as const, marker: String(index + 1), activity: stop.activity,
            meta: stop.activity.title + (stop.activity.starts_at ? ` · ${timeLabel(stop.activity.starts_at, trip!.timezone)}` : ""),
          })),
  [tab, savedPlaces, plan?.activities, results, stops, trip]);
  const points: MapPoint[] = useMemo(() => listed.flatMap(({ place, tone, marker }) => {
    const at = coordsOf(place);
    return at ? [{ id: place.id, name: place.name, ...at, tone, label: marker ?? place.icon }] : [];
  }), [listed]);
  // The tapped place comes first in the list, right under the map.
  const ordered = selected ? [...listed.filter((row) => row.place.id === selected), ...listed.filter((row) => row.place.id !== selected)] : listed;
  const shown = tab === "explore" ? ordered.slice(0, limit) : ordered;
  const credits = tab === "explore" ? [...new Set((results?.items ?? []).map((item) => item.source).filter(Boolean))] : [];
  const switchTab = (next: Tab) => {
    if (next === tab) return;
    if (next === "explore") { openExplore(); return; }
    setTab(next);
    setSelected(undefined);
    setFitKey((value) => value + 1);
  };
  const tabs: { value: Tab; label: string; a11y: string }[] = [
    { value: "saved", label: `📍 Nhóm · ${savedPlaces.length}`, a11y: `Của nhóm · ${savedPlaces.length}` },
    { value: "explore", label: "🔎 Khám phá", a11y: "Tìm quanh đây" },
    { value: "route", label: "🧭 Lộ trình", a11y: "Lộ trình" },
  ];

  return (
    <Screen title={trip?.name ?? "Bản đồ & địa điểm"} tab="trips" onRefresh={() => { void resource.reload(); }} refreshing={resource.loading && !!data}>
      <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
      {data && plan && trip && (
        <>
          <TripNavigation id={id} active="places" />

          <View style={styles.mapShell}>
            <TripMap points={points} selectedId={selected} onSelect={setSelected} route={activeRoute?.line} mapType={mapType} fitKey={`${tab}:${fitKey}`}
              onUserMove={tab === "explore" ? setMoved : undefined} height={MAP_HEIGHT} />
            <View style={styles.topOverlay} pointerEvents="box-none">
              <GlassSurface variant="prominent" style={styles.modeBar}>
                {tabs.map((item) => (
                  <Pressable cssInterop={false} key={item.value} accessibilityRole="tab" accessibilityLabel={item.a11y} accessibilityState={{ selected: tab === item.value }}
                    onPress={() => switchTab(item.value)} style={({ pressed }) => [styles.mode, tab === item.value && styles.modeActive, pressed && { opacity: 0.75 }]}>
                    <Text style={[styles.modeText, tab === item.value && styles.modeTextActive]} numberOfLines={1}>{item.label}</Text>
                  </Pressable>
                ))}
              </GlassSurface>
            </View>
            <View style={styles.bottomOverlay} pointerEvents="box-none">
              {tab === "explore" && moved ? (
                <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Tìm trong khu vực này"
                  onPress={() => void runSearch({ bbox: regionBbox(moved), category: group, limit: 150 })} style={({ pressed }) => [styles.floating, pressed && { opacity: 0.8 }]}>
                  <Text style={styles.floatingText}>🔍 Tìm trong khu vực này</Text>
                </Pressable>
              ) : <View />}
              {Platform.OS !== "web" && (
                <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={mapType === "standard" ? "Xem ảnh vệ tinh" : "Xem bản đồ đường"}
                  onPress={() => setMapType((value) => (value === "standard" ? "satellite" : "standard"))} style={({ pressed }) => [styles.floating, styles.floatingSmall, pressed && { opacity: 0.8 }]}>
                  <Text style={styles.floatingText}>{mapType === "standard" ? "🛰️" : "🗺️"}</Text>
                </Pressable>
              )}
            </View>
            {searching && <View style={styles.loadingPill} pointerEvents="none"><Text style={styles.loadingText}>Đang tìm…</Text></View>}
          </View>

          {tab === "saved" && (
            <View style={styles.headRow}>
              <Text style={[typography.footnote, { flex: 1 }]}>
                {savedPlaces.length ? `${savedPlaces.length} địa điểm cả nhóm đã lưu · chạm để xem trên bản đồ` : "Nhóm chưa lưu địa điểm nào."}
              </Text>
              {editable && sharedWrites && <Button label="Thêm" accessibilityLabel="Thêm địa điểm cho nhóm" variant="soft" compact icon="plus" disabled={!canWrite} onPress={() => { setManualError(undefined); setManual(true); }} />}
            </View>
          )}
          {!sharedWrites && <Text style={typography.footnote}>Máy chủ chưa hỗ trợ lưu địa điểm cho nhóm. Bạn vẫn có thể tìm và thêm hoạt động.</Text>}

          {tab === "explore" && (
            <View style={styles.controls}>
              <View style={styles.searchBar}>
                <DesignIcon name="search" size={18} tintColor={colors.muted} />
                <TextInput accessibilityLabel="Khám phá địa điểm" value={query} onChangeText={setQuery} placeholder="Tìm quán ăn, bãi biển, bảo tàng…" placeholderTextColor={colors.muted}
                  maxLength={200} returnKeyType="search" onSubmitEditing={searchText} style={styles.searchInput} autoCorrect={false} />
                {!!query && <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Xóa từ khóa" hitSlop={8}
                  onPress={() => { setQuery(""); void runSearch(nearbyQuery(group)); }} style={styles.clear}><Text style={styles.clearText}>✕</Text></Pressable>}
                <Button label="Tìm" accessibilityLabel="Tìm địa điểm" compact loading={searching} onPress={searchText} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {POI_GROUPS.map((item) => (
                  <Pressable cssInterop={false} key={item.value} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: group === item.value }}
                    onPress={() => { setGroup(item.value); if (!query.trim()) void runSearch(nearbyQuery(item.value)); }}
                    style={({ pressed }) => [styles.chip, group === item.value && styles.chipActive, pressed && { opacity: 0.7 }]}>
                    <Text style={[styles.chipText, group === item.value && styles.chipTextActive]}>{item.icon} {item.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {results && !searching && !!results.items.length && (
                <Text style={typography.footnote}>{results.items.length} địa điểm {typed ? `cho “${typed}”` : "quanh địa điểm của nhóm"}{results.truncated ? " · phóng to để xem đủ" : ""}</Text>
              )}
            </View>
          )}
          {tab === "route" && (
            <View style={styles.controls}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {days.map((value, index) => (
                  <Pressable cssInterop={false} key={value} accessibilityRole="tab" accessibilityLabel={`Ngày ${index + 1} · ${value.slice(8)}/${value.slice(5, 7)}`} accessibilityState={{ selected: routeDay === value }}
                    onPress={() => { setDay(value); setSelected(undefined); }} style={({ pressed }) => [styles.chip, routeDay === value && styles.chipActive, pressed && { opacity: 0.7 }]}>
                    <Text style={[styles.chipText, routeDay === value && styles.chipTextActive]}>Ngày {index + 1} · {value.slice(8)}/{value.slice(5, 7)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.modeRow}>
                {MODES.map((item) => (
                  <Pressable cssInterop={false} key={item.value} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: mode === item.value }} onPress={() => setMode(item.value)}
                    style={({ pressed }) => [styles.modeChip, mode === item.value && styles.chipActive, pressed && { opacity: 0.7 }]}>
                    <Text style={[styles.chipText, mode === item.value && styles.chipTextActive]} numberOfLines={1}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {tab === "route" && stops.length > 1 && (
            <View style={styles.summary}>
              {!activeRoute ? <Text style={typography.footnote}>Đang tính lộ trình…</Text> : (
                <>
                  <Text style={styles.summaryValue}>
                    {distanceLabel(activeRoute.distance)}
                    {activeRoute.duration ? ` · ${durationLabel(activeRoute.duration / 60)}` : ""}
                  </Text>
                  <Text style={typography.footnote}>
                    {activeRoute.basis === "straight"
                      ? "Đường chim bay (nét đứt) · chưa có dữ liệu chỉ đường, khoảng cách thực tế sẽ dài hơn."
                      : activeRoute.basis === "car-estimate"
                        ? `Theo đường xe chạy qua ${stops.length} điểm · thời gian ${mode === "WALKING" ? "đi bộ" : "đạp xe"} ước tính theo quãng đường.`
                        : `Theo đường ${mode === "WALKING" ? "đi bộ" : mode === "CYCLING" ? "xe đạp" : "xe chạy"} thực tế qua ${stops.length} điểm.`}
                  </Text>
                  {activeRoute.attribution.length > 0 && (
                    <View style={styles.creditRow}>
                      {activeRoute.attribution.map((item) => item.url
                        ? <Pressable cssInterop={false} key={item.text} accessibilityRole="link" accessibilityLabel={item.text} onPress={() => { void openURL(item.url!).catch(() => {}); }}><Text style={[styles.credit, styles.creditLink]}>{item.text}</Text></Pressable>
                        : <Text key={item.text} style={styles.credit}>{item.text}</Text>)}
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {error && <Feedback message={error} />}
          {command.error && !adding && !deleting && !manual && <><Feedback message={command.error} /><Button label="Tải lại địa điểm của nhóm" variant="soft" onPress={() => { command.clearError(); void resource.reload(); }} /></>}
          {tab === "explore" && results?.mock && <Notice>Kết quả từ nguồn dữ liệu mô phỏng của môi trường thử nghiệm.</Notice>}
          {tab === "explore" && results?.warnings.map((warning) => travelWarnings[warning] ? <Text key={warning} style={typography.footnote}>{travelWarnings[warning]}</Text> : null)}
          {tab === "explore" && results?.note && <Notice>{results.note}</Notice>}

          {shown.map(({ place, tone, marker, meta }) => {
            const savedRow = tab === "saved" ? plan.selected_locations.find((p) => p.id === place.id) : sharedMatch(place);
            const hasCoords = !!coordsOf(place);
            return (
              <PlaceCard key={place.id} place={place} tone={tone} marker={marker} selected={selected === place.id}
                meta={tab === "explore" ? (savedRow ? "✓ Đã lưu cho nhóm" : undefined) : meta}
                onPress={hasCoords ? () => { setSelected(place.id); } : undefined}>
                {editable && tab !== "route" && (
                  <Button label="Thêm vào lịch trình" accessibilityLabel={`Thêm hoạt động tại ${place.name}`} icon="calendar" compact disabled={!canWrite}
                    onPress={() => { command.clearError(); setError(undefined); setAdding(place); }} />
                )}
                {editable && sharedWrites && tab === "explore" && !savedRow && (
                  <Button label="Lưu cho nhóm" accessibilityLabel={`Lưu ${place.name} cho nhóm`} compact variant="soft" disabled={!canWrite} onPress={() => { void saveShared(place); }} />
                )}
                {hasCoords && <Button label="Chỉ đường" accessibilityLabel={`Chỉ đường tới ${place.name}`} compact variant="text" onPress={() => { void directions(place); }} />}
                {editable && sharedWrites && tab === "saved" && !activitiesAt(place.id).length && (
                  <Button label="Xóa" accessibilityLabel={`Xóa ${place.name} khỏi nhóm`} compact variant="text" disabled={!canWrite} onPress={() => setDeleting(place)} />
                )}
              </PlaceCard>
            );
          })}
          {tab === "explore" && ordered.length > shown.length && (
            <Button label={`Xem thêm ${Math.min(PAGE, ordered.length - shown.length)} địa điểm`} variant="text" onPress={() => setLimit((value) => value + PAGE)} />
          )}

          {tab === "saved" && !savedPlaces.length && (
            <EmptyState title="Chưa có điểm dừng" message="Mở Khám phá để tìm nơi muốn đến rồi lưu cho cả nhóm." icon="pin"
              action={<Button label="Khám phá quanh đây" compact onPress={openExplore} />} />
          )}
          {tab === "explore" && !searching && results && !results.items.length && !results.note && (
            <EmptyState title="Thử một ý tưởng khác nhé" message="Đổi nhóm địa điểm, tìm theo tên hoặc kéo bản đồ rồi bấm “Tìm trong khu vực này”." icon="pin" />
          )}
          {tab === "route" && stops.length < 2 && (
            <EmptyState title={stops.length ? "Cần thêm một điểm dừng" : "Ngày này chưa có điểm dừng"}
              message="Lộ trình nối các hoạt động trong ngày đã gắn địa điểm. Thêm địa điểm vào lịch trình từ tab Nhóm hoặc Khám phá." icon="map" />
          )}
          {tab === "route" && unplaced.length > 0 && (
            <Text style={typography.footnote}>
              Chưa có trên lộ trình: {unplaced.map((a) => a.title).join(", ")} (chưa gắn địa điểm).
            </Text>
          )}
          {credits.length > 0 && <Text style={styles.footerCredit}>Dữ liệu địa điểm: {credits.join(" · ")}</Text>}

          <QuickAddSheet place={adding} trip={trip} plan={plan} days={days} defaultDay={tab === "route" ? routeDay : undefined} busy={command.busy} error={command.error ?? undefined}
            onClose={() => { if (!command.busy) { command.clearError(); setAdding(undefined); } }}
            onConfirm={async (chosenDay, slot) => { if (adding && await quickAdd(adding, chosenDay, slot)) setAdding(undefined); }}
            onCustomize={(chosenDay) => { const place = adding!; setAdding(undefined); customize(place, chosenDay, sharedMatch(place)?.id); }} />
          <Sheet visible={!!deleting} title="Xóa địa điểm khỏi nhóm?" dismissible={!command.busy} onClose={() => setDeleting(undefined)}>
            <Text style={typography.body}>{deleting?.name} sẽ bị xóa khỏi danh sách chung. Địa điểm đang gắn với hoạt động phải được gỡ khỏi hoạt động trước.</Text>
            {command.error && <Feedback message={command.error} />}
            <Button label="Xác nhận xóa địa điểm" variant="destructive" loading={command.busy} disabled={!canWrite} onPress={() => { void (async () => {
              if (!deleting || !canWrite) return;
              const result = await command.run({ remove: deleting.id, version: plan.plan_version }, (key) => api.trips.removeLocation(id, deleting.id, plan.plan_version, key));
              if (result) { toast.success(`Đã xóa “${deleting.name}” khỏi nhóm.`); setDeleting(undefined); await resource.reload(); }
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

/**
 * Add a place to the plan without leaving the map: pick a day, take the suggested slot
 * (after the day's last timed activity plus travel) or leave the time open.
 */
function QuickAddSheet({ place, trip, plan, days, defaultDay, busy, error, onClose, onConfirm, onCustomize }: {
  place?: PlaceItem; trip: Trip; plan: Plan; days: string[]; defaultDay?: string; busy: boolean; error?: string;
  onClose(): void; onConfirm(day: string, slot?: { starts_at: string; ends_at: string }): Promise<void>; onCustomize(day: string): void;
}) {
  const [picked, setPicked] = useState<string>();
  const [timing, setTiming] = useState<"slot" | "open">("slot");
  const firstFree = days.find((value) => !plan.activities.some((a) => activityDay(a, trip.timezone) === value)) ?? days[0];
  const chosen = picked ?? defaultDay ?? firstFree ?? "unscheduled";
  const places = new Map(plan.selected_locations.flatMap((item) => {
    const lat = Number(item.latitude), lon = Number(item.longitude);
    return item.latitude !== null && item.longitude !== null && Number.isFinite(lat) && Number.isFinite(lon) ? [[item.id, { latitude: lat, longitude: lon }] as const] : [];
  }));
  const minutes = place?.durationMin ?? activityMinutes({ activity_type: place?.activityType ? formActivityType(place.activityType) : "SIGHTSEEING", starts_at: null, ends_at: null });
  const slot = place && chosen !== "unscheduled"
    ? nextSlot({ day: chosen, timezone: trip.timezone, activities: plan.activities, placeOf: (key) => (key ? places.get(key) : undefined), place: coordsOf(place), minutes })
    : undefined;
  const dayCount = (value: string) => plan.activities.filter((a) => activityDay(a, trip.timezone) === value).length;
  const useSlot = timing === "slot" && !!slot;
  return (
    <Sheet visible={!!place} title="Thêm vào lịch trình" dismissible={!busy} onClose={() => { setPicked(undefined); setTiming("slot"); onClose(); }}>
      {place && <>
        <View style={styles.addHead}>
          <Text style={styles.addIcon}>{place.icon ?? "📍"}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={typography.headline} numberOfLines={2}>{place.name}</Text>
            <Text style={typography.footnote}>{[place.categoryLabel, durationLabel(minutes)].filter(Boolean).join(" · ")}</Text>
          </View>
        </View>
        <Text style={styles.label}>Ngày</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {days.map((value, index) => (
            <Pressable cssInterop={false} key={value} accessibilityRole="radio" accessibilityLabel={`Ngày ${index + 1}, ${calendarLabel(value)}, ${dayCount(value)} hoạt động`} accessibilityState={{ checked: chosen === value }}
              onPress={() => setPicked(value)} style={({ pressed }) => [styles.dayChip, chosen === value && styles.chipActive, pressed && { opacity: 0.7 }]}>
              <Text style={[styles.chipText, chosen === value && styles.chipTextActive]}>Ngày {index + 1}</Text>
              <Text style={[styles.dayMeta, chosen === value && styles.chipTextActive]}>{value.slice(8)}/{value.slice(5, 7)} · {dayCount(value)} hđ</Text>
            </Pressable>
          ))}
          <Pressable cssInterop={false} accessibilityRole="radio" accessibilityLabel="Chưa xếp ngày" accessibilityState={{ checked: chosen === "unscheduled" }}
            onPress={() => setPicked("unscheduled")} style={({ pressed }) => [styles.dayChip, chosen === "unscheduled" && styles.chipActive, pressed && { opacity: 0.7 }]}>
            <Text style={[styles.chipText, chosen === "unscheduled" && styles.chipTextActive]}>Chưa xếp</Text>
            <Text style={[styles.dayMeta, chosen === "unscheduled" && styles.chipTextActive]}>quyết sau</Text>
          </Pressable>
        </ScrollView>
        {chosen !== "unscheduled" && <>
          <Text style={styles.label}>Giờ</Text>
          {slot ? (
            <Pressable cssInterop={false} accessibilityRole="radio" accessibilityLabel={`Khung giờ gợi ý ${slot.label}`} accessibilityState={{ checked: timing === "slot" }} onPress={() => setTiming("slot")}
              style={[styles.timeOption, timing === "slot" && styles.timeOptionOn]}>
              <Text style={styles.timeValue}>{slot.label}</Text>
              <Text style={typography.footnote}>Gợi ý sau hoạt động có giờ cuối cùng của ngày, đã tính đường đi.</Text>
            </Pressable>
          ) : <Text style={typography.footnote}>Ngày này đã kín đến tối; hoạt động sẽ ở mục “Chưa định giờ”.</Text>}
          <Pressable cssInterop={false} accessibilityRole="radio" accessibilityLabel="Chưa định giờ" accessibilityState={{ checked: !useSlot }} onPress={() => setTiming("open")}
            style={[styles.timeOption, !useSlot && styles.timeOptionOn]}>
            <Text style={styles.timeValue}>Chưa định giờ</Text>
            <Text style={typography.footnote}>Vào nhóm “Linh hoạt trong ngày”; dùng “Tự xếp” trong Lịch trình sau.</Text>
          </Pressable>
        </>}
        {error && <Feedback message={error} />}
        <Button label={chosen === "unscheduled" ? "Thêm vào Chưa xếp lịch" : `Thêm vào Ngày ${days.indexOf(chosen) + 1}${useSlot ? ` · ${slot!.label.slice(0, 5)}` : ""}`}
          loading={busy} onPress={() => { void onConfirm(chosen, useSlot ? slot : undefined); }} />
        <Button label="Tùy chỉnh chi tiết" variant="text" disabled={busy} onPress={() => onCustomize(chosen)} />
      </>}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  mapShell: { borderRadius: 24, ...shadows.card },
  topOverlay: { position: "absolute", top: 10, left: 10, right: 10, alignItems: "center", zIndex: 500 },
  modeBar: { flexDirection: "row", padding: 4, gap: 2, borderRadius: radii.pill, alignSelf: "stretch" },
  mode: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, borderRadius: radii.pill },
  modeActive: { backgroundColor: colors.ink },
  modeText: { color: colors.ink, fontSize: 13, fontFamily: fonts.bold },
  modeTextActive: { color: colors.surface },
  bottomOverlay: { position: "absolute", bottom: 12, left: 10, right: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", zIndex: 500 },
  floating: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: colors.surface, boxShadow: "0 4px 12px rgba(23,63,99,0.22)" },
  floatingSmall: { paddingHorizontal: 10 },
  floatingText: { color: colors.ink, fontSize: 13, fontFamily: fonts.bold },
  loadingPill: { position: "absolute", top: 62, alignSelf: "center", paddingHorizontal: 12, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: "rgba(31,42,68,0.78)", zIndex: 501 },
  loadingText: { color: colors.surface, fontSize: 12, fontFamily: fonts.bold },
  headRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  controls: { gap: 10 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 54, paddingLeft: 16, paddingRight: 5, borderRadius: radii.pill, backgroundColor: colors.surface, ...shadows.glass },
  searchInput: { ...typography.body, flex: 1, minWidth: 0, minHeight: 44, paddingVertical: 10 },
  clear: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.fill },
  clearText: { color: colors.muted, fontSize: 12, fontFamily: fonts.bold },
  chipRow: { flexDirection: "row", gap: 6, paddingVertical: 2 },
  modeRow: { flexDirection: "row", gap: 6 },
  chip: { minHeight: 38, justifyContent: "center", paddingHorizontal: 12, borderRadius: radii.pill, backgroundColor: colors.surface },
  modeChip: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, borderRadius: radii.pill, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.ink },
  chipText: { color: colors.ink, fontSize: 13, fontFamily: fonts.bold },
  chipTextActive: { color: colors.surface },
  summary: { gap: 4, padding: 14, borderRadius: radii.card, backgroundColor: colors.surface, ...shadows.glass },
  summaryValue: { ...typography.section, fontSize: 20 },
  creditRow: { flexDirection: "row", flexWrap: "wrap", columnGap: 10, marginTop: 2 },
  credit: { color: colors.muted, fontSize: 11 },
  creditLink: { color: colors.teal, textDecorationLine: "underline" },
  footerCredit: { color: colors.muted, fontSize: 11, lineHeight: 15, textAlign: "center" },
  addHead: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radii.control, backgroundColor: colors.fill },
  addIcon: { fontSize: 26 },
  label: { ...typography.eyebrow, textTransform: "uppercase" },
  dayChip: { minWidth: 84, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.control, backgroundColor: colors.fill, gap: 1 },
  dayMeta: { color: colors.muted, fontSize: 11, fontFamily: fonts.body },
  timeOption: { padding: 12, gap: 2, borderRadius: radii.control, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface },
  timeOptionOn: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  timeValue: { fontFamily: fonts.heading, fontSize: 16, color: colors.ink },
});
