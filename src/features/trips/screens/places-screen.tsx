import { openURL } from "expo-linking";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

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
import { TripMap, type MapPoint } from "../components/trip-map";
import { TripNavigation } from "../components/trip-navigation";
import { useTrip } from "../hooks/use-trip";
import type { TravelMeta, TravelPlace } from "../types";

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
      if (!request.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  const places =
    mode === "saved"
      ? (data?.plan.selected_locations ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address ?? "",
          latitude: p.latitude === null ? NaN : Number(p.latitude),
          longitude: p.longitude === null ? NaN : Number(p.longitude),
        }))
      : (result?.data ?? []).map((p) => ({ ...p, ...p.coordinates }));
  const points: MapPoint[] = places.filter(
    (p) =>
      Number.isFinite(p.latitude) &&
      Number.isFinite(p.longitude) &&
      Math.abs(p.latitude) <= 90 &&
      Math.abs(p.longitude) <= 180,
  );
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
                label: `Đã lưu · ${data.plan.selected_locations.length}`,
              },
              { value: "search", label: "Kết quả tìm kiếm" },
            ]}
            value={mode}
            onChange={setMode}
          />
          {error && <Feedback message={error} />}
          {mode === "search" && result?.meta && (
            <>
              <Text style={typography.footnote}>
                Nguồn: {result.meta.provider} · Cập nhật{" "}
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
          <TripMap points={points} onSelect={setSelected} />
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
              {!!place.address && (
                <Text style={typography.footnote}>{place.address}</Text>
              )}
              {points.some((p) => p.id === place.id) && (
                <Button
                  label="Mở bản đồ"
                  variant="soft"
                  compact
                  onPress={() => {
                    void viewMap(place.latitude, place.longitude);
                  }}
                />
              )}
              {data.plan.permissions.can_edit && (
                <Button
                  label="Thêm hoạt động tại đây"
                  compact
                  onPress={() =>
                    router.push({
                      pathname: "/trip/[id]/activity",
                      params: {
                        id,
                        title: place.name,
                        note: place.address,
                        ...(mode === "saved" ? { locationId: place.id } : {}),
                      },
                    })
                  }
                />
              )}
            </View>
          ))}
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
