import { openURL } from "expo-linking";
import { router } from "expo-router";
import { randomUUID } from "@/shared/operations/operation-id";
import { useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { useLocalDraft } from "@/shared/storage/use-local-draft";

import { useCommand } from "@/shared/hooks/use-command";
import { errorMessage } from "@/shared/api/errors";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import {
  EmptyState,
  Heading,
  Notice,
  ResourceFeedback,
  Segments,
  ui,
} from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { Sheet } from "@/shared/ui/sheet";
import { TripMap, type MapPoint } from "../components/trip-map";
import { TripNavigation } from "../components/trip-navigation";
import { useTrip } from "../hooks/use-trip";
import type { TravelMeta, TravelPlace } from "../types";
import { emptyPlaceDraft, isPlaceDraft, validCoordinates, type LocalPlace } from "../model/place-draft";
import { activityDay, tripDays } from "../utils";

const providerLabel = (provider?: string) => provider?.toUpperCase() === "GEOAPIFY" ? "Geoapify" : "Dịch vụ địa điểm";
const travelWarnings: Record<string, string> = {
  OPENING_HOURS_NOT_AVAILABLE:
    "Chưa có giờ mở cửa. Hãy kiểm tra trước khi ghé thăm.",
  STALE_CACHE: "Thông tin gần nhất được lưu tạm và có thể đã thay đổi.",
  PROVIDER_NOT_CONFIGURED:
    "Tìm kiếm địa điểm chưa được kích hoạt. Bạn vẫn có thể tự thêm hoạt động vào lịch trình.",
};

export default function PlacesScreen() {
  const resource = useTrip();
  const { data, api, id } = resource;
  const command = useCommand();
  const [deleting, setDeleting] = useState<LocalPlace>();
  const sharedWrites = data?.plan.capabilities?.locations_write === true;
  const canWrite = !!data?.plan.permissions.can_edit && !resource.loading && !resource.error && !command.busy;
  const draft = useLocalDraft(id, "places", isPlaceDraft);
  const local = draft.value ?? emptyPlaceDraft;
  const [placeFilter, setPlaceFilter] = useState("all");
  const [dayFilter, setDayFilter] = useState("all");
  const [mapType, setMapType] = useState<"standard" | "satellite">("standard");
  const [manual, setManual] = useState(false);
  const [placeName, setPlaceName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [manualError, setManualError] = useState<string>();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{
    data: TravelPlace[];
    meta: TravelMeta;
  }>();
  const [mode, setMode] = useState<"saved" | "search">("saved");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function search() {
    if (!query.trim() || query.trim().length > 200) {
      setError("Nhập tên địa điểm từ 1 đến 200 ký tự.");
      return;
    }
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError(undefined);
    setMode("search");
    setResult(undefined);
    try {
      const response = await api.trips.searchPlaces(id, query, request.signal);
      if (!request.signal.aborted) setResult(response);
    } catch (cause) {
      if (!request.signal.aborted) setError(errorMessage(cause) + " Bạn vẫn có thể tự nhập địa điểm.");
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  const allPlaces: LocalPlace[] =
    mode === "saved"
      ? [...(data?.plan.selected_locations ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address ?? "",
          latitude: p.latitude === null ? null : Number(p.latitude),
          longitude: p.longitude === null ? null : Number(p.longitude),
          source: "Kế hoạch chung",
          attribution: p.metadata?.attribution ?? [],
        })), ...local.places]
      : (result?.data ?? []).map((p) => ({ id: "search:" + p.id, name: p.name, address: p.address, ...p.coordinates, source: (result?.meta.is_mock ? "Dữ liệu mô phỏng · " : "") + providerLabel(result?.meta.provider) + " · " + (result?.meta.fetched_at ? new Date(result.meta.fetched_at).toLocaleString("vi-VN") : "") + (result?.meta.stale ? " · Có thể đã cũ" : ""), attribution: result?.meta.attribution ?? [] }));
  const scheduled = (placeId: string) => (data?.plan.activities ?? []).filter(a => a.selected_location_id === placeId && !!(a.starts_at || a.scheduled_date));
  const places = allPlaces.filter(place => {
    const activities = scheduled(place.id);
    if (local.hidden.includes(place.id) && !activities.length) return false;
    if (placeFilter === "picked" && !local.selected.includes(place.id)) return false;
    if (placeFilter === "scheduled" && !activities.length) return false;
    if (placeFilter === "unscheduled" && activities.length) return false;
    return dayFilter === "all" || activities.some(a => activityDay(a, data!.trip.timezone) === dayFilter);
  });
  const points: MapPoint[] = places.flatMap(p => validCoordinates(p.latitude, p.longitude) ? [{ id: p.id, name: p.name, latitude: p.latitude!, longitude: p.longitude! }] : []);
  async function togglePlace(place: LocalPlace) {
    if (!draft.ready || draft.busy || !data?.plan.permissions.can_edit) return;
    const exists = local.selected.includes(place.id);
    await draft.save({
      ...local,
      selected: exists ? local.selected.filter(value => value !== place.id) : [...local.selected, place.id],
      places: !data.plan.selected_locations.some(p => p.id === place.id) && !local.places.some(p => p.id === place.id) ? [...local.places, place] : local.places,
    });
  }
  const sharedLocation = (place: LocalPlace) => data?.plan.selected_locations.find(p => p.id === place.id ||
    (p.name === place.name && (p.address ?? "") === place.address &&
      (p.latitude === null ? place.latitude === null : place.latitude !== null && Math.abs(Number(p.latitude) - place.latitude) < 0.000001) &&
      (p.longitude === null ? place.longitude === null : place.longitude !== null && Math.abs(Number(p.longitude) - place.longitude) < 0.000001)));
  async function saveShared(place: LocalPlace) {
    if (!canWrite || !data || !sharedWrites) return;
    const existing = sharedLocation(place);
    if (existing) return existing;
    const input = { name: place.name.trim(), address: place.address.trim() || null,
      latitude: place.latitude === null ? null : place.latitude.toFixed(6), longitude: place.longitude === null ? null : place.longitude.toFixed(6),
      attribution: place.attribution.filter(a => a.url.startsWith("https://")), expected_plan_version: data.plan.plan_version };
    const saved = await command.run(input, key => api.trips.saveLocation(id, input, key));
    if (saved) await resource.reload();
    return saved;
  }
  async function addActivity(place: LocalPlace) {
    if (!canWrite) return;
    const saved = sharedLocation(place) ?? (sharedWrites ? await saveShared(place) : undefined);
    if (sharedWrites && !saved) return;
    router.push({ pathname: "/trip/[id]/activity", params: { id, title: place.name, note: place.address, ...(saved ? { locationId: saved.id } : {}) } });
  }
  async function addManual() {
    if (!draft.ready || draft.busy || !data?.plan.permissions.can_edit) return;
    if (!placeName.trim()) { setManualError("Nhập tên địa điểm."); return; }
    const lat = latitude.trim() ? Number(latitude) : null, lon = longitude.trim() ? Number(longitude) : null;
    if ((latitude.trim() || longitude.trim()) && !validCoordinates(lat, lon)) { setManualError("Nhập đủ vĩ độ (-90 đến 90) và kinh độ (-180 đến 180), hoặc để trống cả hai."); return; }
    const place: LocalPlace = { id: "local:" + randomUUID(), name: placeName.trim(), address: address.trim(), latitude: lat, longitude: lon, source: "Tự nhập trên thiết bị", attribution: [] };
    if (sharedWrites ? !!await saveShared(place) : await draft.save({ ...local, selected: [...local.selected, place.id], places: [...local.places, place] })) {
      setManual(false); setPlaceName(""); setAddress(""); setLatitude(""); setLongitude(""); setMode("saved"); setPlaceFilter(sharedWrites ? "all" : "picked"); setDayFilter("all");
    }
  }
  async function viewMap(latitude: number, longitude: number) {
    try {
      await openURL(
        `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
      );
    } catch {
      setError("Chưa thể mở bản đồ trên thiết bị này.");
    }
  }
  return (
    <Screen
      title={data?.trip.name ?? "Bản đồ & địa điểm"}
      tab="trips"
      onRefresh={() => {
        void resource.reload();
      }}
      refreshing={resource.loading && !!data}
    >
      <ResourceFeedback
        {...resource}
        hasData={!!data}
        onRetry={() => {
          void resource.reload();
        }}
      />
      {data && (
        <>
          <TripNavigation id={id} active="places" />
          <Text style={typography.footnote}>{sharedWrites ? "Địa điểm được chia sẻ với cả nhóm." : "Địa điểm riêng · Chỉ lưu trên thiết bị"}</Text>
          {command.error && <><Feedback message={command.error} /><Button label="Tải lại địa điểm của nhóm" variant="soft" onPress={() => { void resource.reload(); }} /></>}
          {draft.error && <Feedback message={draft.error} />}
          {draft.error && <Button label="Xóa dữ liệu địa điểm không đọc được" variant="soft" onPress={() => { void draft.clear(); }} />}
          {data.plan.permissions.can_edit && <Button label={sharedWrites ? "Thêm địa điểm cho nhóm" : "Thêm địa điểm thủ công (nháp)"} variant="soft" disabled={!draft.ready || draft.busy || !canWrite} onPress={() => { setManualError(undefined); setManual(true); }} />}
          <FormField
            label="Khám phá địa điểm"
            icon="search"
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm địa điểm, quán ăn…"
            maxLength={200}
            returnKeyType="search"
            onSubmitEditing={() => {
              void search();
            }}
          />
          <Button
            label="Tìm địa điểm"
            compact
            loading={busy}
            onPress={() => {
              void search();
            }}
          />
          <Segments
            items={[
              {
                value: "saved",
                label: "Nhóm & địa điểm nháp",
              },
              { value: "search", label: "Kết quả tìm kiếm" },
            ]}
            value={mode}
            onChange={setMode}
          />
          <Segments scroll value={placeFilter} onChange={setPlaceFilter} items={[{ value: "all", label: "Tất cả" }, { value: "picked", label: "Đã chọn trên máy" }, { value: "scheduled", label: "Đã xếp lịch" }, { value: "unscheduled", label: "Chưa xếp lịch" }]} />
          <Segments scroll value={dayFilter} onChange={setDayFilter} items={[{ value: "all", label: "Mọi ngày" }, ...tripDays(data.trip).map((value, i) => ({ value, label: "Ngày " + (i + 1) }))]} />
          {Platform.OS !== "web" && <Segments value={mapType} onChange={setMapType} items={[{ value: "standard", label: "Bản đồ đường" }, { value: "satellite", label: "Vệ tinh" }]} />}
          {!!local.hidden.length && <Button label="Hiện lại các địa điểm đã ẩn trên máy" variant="soft" disabled={!draft.ready || draft.busy} onPress={() => { void draft.save({ ...local, hidden: [] }); }} />}
          {error && <Feedback message={error} />}
          {mode === "search" && result?.meta && (
            <>
              <Text style={typography.footnote}>
                Nguồn: {providerLabel(result.meta.provider)} · Cập nhật{" "}
                {new Date(result.meta.fetched_at).toLocaleString("vi-VN")}
              </Text>
              {result.meta.is_mock && (
                <Notice>
                  Kết quả từ nguồn dữ liệu mô phỏng của môi trường thử nghiệm.
                </Notice>
              )}
              {result.meta.stale && (
                <Notice>
                  Dữ liệu lưu tạm có thể đã cũ. Bạn nên kiểm tra trước khi khởi
                  hành.
                </Notice>
              )}
              {result.meta.status !== "ERROR" &&
                result.meta.warnings?.map((warning) =>
                  travelWarnings[warning] ? (
                    <Text key={warning} style={typography.footnote}>
                      {travelWarnings[warning]}
                    </Text>
                  ) : null,
                )}
            </>
          )}
          <TripMap points={points} onSelect={setSelected} mapType={mapType} />
          <Heading
            title={
              mode === "saved" ? "Điểm dừng của nhóm" : "Một nơi để khám phá"
            }
          />
          {places.map((place) => (
            <View
              key={place.id}
              style={[
                ui.card,
                selected === place.id && {
                  borderWidth: 1,
                  borderColor: "#008CAC",
                },
              ]}
            >
              <Text style={typography.headline}>{place.name}</Text>
              <Text style={typography.footnote}>{place.source} · {scheduled(place.id).length ? "Đã xếp lịch chung" : "Chưa xếp lịch chung"}</Text>
              {place.attribution.map(source => /^https?:\/\//i.test(source.url) ? <Button key={source.url} label={source.text} variant="soft" compact onPress={() => { void openURL(source.url).catch(() => setError("Chưa thể mở nguồn địa điểm.")); }} /> : <Text key={source.text} style={typography.footnote}>{source.text}</Text>)}
              {data.plan.permissions.can_edit && <>
                {sharedWrites && !sharedLocation(place) && <Button label="Lưu địa điểm cho nhóm" compact disabled={!canWrite} loading={command.busy} onPress={() => { void saveShared(place).then(saved => { if (saved) { setMode("saved"); setPlaceFilter("all"); } }); }} />}
                {sharedWrites && data.plan.selected_locations.some(p => p.id === place.id) && !data.plan.activities.some(a => a.selected_location_id === place.id) && <Button label="Xóa địa điểm khỏi nhóm" compact variant="destructive" disabled={!canWrite} onPress={() => setDeleting(place)} />}

                <Button label={local.selected.includes(place.id) ? "Bỏ chọn trên thiết bị" : "Chọn trên thiết bị"} compact variant="soft" disabled={!draft.ready || draft.busy} onPress={() => { void togglePlace(place); }} />
                {!scheduled(place.id).length && <Button label="Ẩn địa điểm trên thiết bị" compact variant="soft" disabled={!draft.ready || draft.busy} onPress={() => { void draft.save({ ...local, hidden: [...new Set([...local.hidden, place.id])] }); }} />}
              </>}
              {!!place.address && (
                <Text style={typography.footnote}>{place.address}</Text>
              )}
              {points.some((p) => p.id === place.id) && (
                <Button
                  label="Mở bản đồ"
                  variant="soft"
                  compact
                  onPress={() => {
                    void viewMap(place.latitude!, place.longitude!);
                  }}
                />
              )}
              {data.plan.permissions.can_edit && (
                <Button
                  label="Thêm hoạt động tại đây"
                  compact
                  disabled={!canWrite}
                  onPress={() => { void addActivity(place); }}
                />
              )}
            </View>
          ))}
          <Button label="Lên bản nháp từ địa điểm đã chọn" variant="soft" onPress={() => router.push({ pathname: "/trip/[id]/plan-draft", params: { id } })} />
          <Sheet visible={!!deleting} title="Xóa địa điểm khỏi nhóm?" dismissible={!command.busy} onClose={() => setDeleting(undefined)}>
            <Text style={typography.body}>{deleting?.name} sẽ bị xóa khỏi danh sách chung. Địa điểm đang gắn với hoạt động phải được gỡ khỏi hoạt động trước.</Text>
            {command.error && <Feedback message={command.error} />}
            <Button label="Xác nhận xóa địa điểm" variant="destructive" loading={command.busy} disabled={!canWrite} onPress={() => { void (async () => {
              if (!deleting || !canWrite) return;
              const result = await command.run({ remove: deleting.id, version: data.plan.plan_version }, key => api.trips.removeLocation(id, deleting.id, data.plan.plan_version, key));
              if (result) { setDeleting(undefined); await resource.reload(); }
            })(); }} />
          </Sheet>
          <Sheet visible={manual} title={sharedWrites ? "Địa điểm của nhóm" : "Địa điểm riêng trên thiết bị"} dismissible={!draft.busy && !command.busy} onClose={() => setManual(false)}>
            <Notice>{sharedWrites ? "Địa điểm được lưu vào kế hoạch chung của nhóm." : "Không tạo địa điểm chung."} Tọa độ không bắt buộc; cần đủ hai tọa độ để hiện trên bản đồ.</Notice>
            {command.error && <Feedback message={command.error} />}
            <FormField label="Tên địa điểm" icon="pin" value={placeName} onChangeText={setPlaceName} maxLength={200} editable={!draft.busy && !command.busy} />
            <FormField label="Địa chỉ" icon="map" value={address} onChangeText={setAddress} maxLength={500} editable={!draft.busy && !command.busy} />
            <FormField label="Vĩ độ" icon="pin" value={latitude} onChangeText={setLatitude} placeholder="16.0544" maxLength={20} editable={!draft.busy && !command.busy} />
            <FormField label="Kinh độ" icon="pin" value={longitude} onChangeText={setLongitude} placeholder="108.2022" maxLength={20} editable={!draft.busy && !command.busy} />
            {manualError && <Feedback message={manualError} />}{draft.error && <Feedback message={draft.error} />}
            <Button label={sharedWrites ? "Lưu địa điểm cho nhóm" : "Lưu địa điểm trên thiết bị"} disabled={!draft.ready || !canWrite} loading={draft.busy || command.busy} onPress={() => { void addManual(); }} />
          </Sheet>
          {!places.length && !busy && (
            <EmptyState
              title={
                mode === "saved"
                  ? "Chưa có điểm dừng"
                  : result?.meta.status === "ERROR"
                    ? "Tìm địa điểm tạm chưa sẵn sàng"
                    : "Thử một ý tưởng khác nhé"
              }
              message={
                mode === "saved"
                  ? "Tìm nơi bạn muốn đến để bắt đầu lên lịch."
                  : result?.meta.status === "ERROR"
                    ? result.meta.warnings.includes("PROVIDER_NOT_CONFIGURED")
                      ? travelWarnings.PROVIDER_NOT_CONFIGURED
                      : "Nguồn địa điểm đang gián đoạn. Thử lại sau hoặc tự thêm hoạt động của bạn."
                    : "Tìm theo tên địa điểm và thành phố để có kết quả phù hợp hơn."
              }
              icon="pin"
              action={
                result?.meta.status === "ERROR" &&
                mode === "search" &&
                data.plan.permissions.can_edit ? (
                  <Button
                    label="Thêm hoạt động thủ công"
                    compact
                    onPress={() =>
                      router.push({
                        pathname: "/trip/[id]/activity",
                        params: { id },
                      })
                    }
                  />
                ) : undefined
              }
            />
          )}
          {mode === "search" &&
            result?.meta.attribution?.map((source) =>
              /^https?:\/\//i.test(source.url) ? (
                <Button
                  key={source.url}
                  label={source.text}
                  variant="soft"
                  compact
                  onPress={() => {
                    void openURL(source.url).catch(() =>
                      setError("Chưa thể mở nguồn địa điểm."),
                    );
                  }}
                />
              ) : (
                <Text key={source.text} style={typography.footnote}>
                  {source.text}
                </Text>
              ),
            )}
        </>
      )}
    </Screen>
  );
}
