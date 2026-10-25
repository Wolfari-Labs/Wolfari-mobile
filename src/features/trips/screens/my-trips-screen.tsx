import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useApi } from "@/shared/api/use-api";
import { errorMessage } from "@/shared/api/errors";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, typography } from "@/shared/theme/tokens";
import { AppHeader } from "@/shared/ui/app-header";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { EmptyState, ResourceFeedback, Segments } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { FormField } from "@/shared/ui/form-field";
import { queryTrips, type TripFilter, type TripSort } from "../model/trip-list-query";
import { TripCard } from "../components/trip-card";
import type { Lifecycle } from "../types";
import { lifecycleLabels } from "../utils";

export default function MyTripsScreen() {
  const api = useApi();
  const [filter, setFilter] = useState<TripFilter>("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TripSort>("default");
  const generation = useRef(0);
  const resource = useResource(
    useCallback(
      (signal: AbortSignal) => {
        generation.current++;
        return api.trips.list(undefined, undefined, signal);
      },
      [api],
    ),
  );
  const [more, setMore] = useState(false);
  const [moreError, setMoreError] = useState<string>();
  const locked = useRef(false);
  async function loadMore() {
    if (!resource.data?.next_cursor || locked.current || resource.loading) return;
    locked.current = true;
    setMore(true);
    setMoreError(undefined);
    const requestedGeneration = generation.current;
    try {
      const page = await api.trips.list(undefined, resource.data.next_cursor);
      if (generation.current === requestedGeneration)
        resource.setData((old) =>
          old
            ? {
                items: [
                  ...old.items,
                  ...page.items.filter(
                    (item) =>
                      !old.items.some((existing) => existing.id === item.id),
                  ),
                ],
                next_cursor: page.next_cursor,
              }
            : page,
        );
    } catch (cause) {
      if (generation.current === requestedGeneration)
        setMoreError(errorMessage(cause));
    } finally {
      locked.current = false;
      setMore(false);
    }
  }
  const items = resource.data?.items ?? [];
  const visible = queryTrips(items, filter, query, sort);
  return (
    <Screen
      header={<AppHeader />}
      tab="trips"
      refreshing={resource.loading && !!resource.data}
      onRefresh={() => {
        void resource.reload();
      }}
    >
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={typography.largeTitle}>
          Chuyến đi <Text style={{ color: colors.teal }}>của tôi</Text>
        </Text>
        <Text style={[typography.body, { color: colors.muted, marginTop: 6 }]}>
          Hẹn những ngày thật đẹp.
        </Text>
      </View>
      <Segments
        scroll
        items={[{ value: "ALL" as TripFilter, label: "Tất cả · " + items.length }, ...(Object.keys(lifecycleLabels) as Lifecycle[]).map((value) => ({
          value,
          label: lifecycleLabels[value] + " · " + items.filter(trip => trip.lifecycle === value).length,
        }))]}
        value={filter}
        onChange={(value) => {
          setMoreError(undefined);
          setFilter(value);
        }}
      />
      <FormField label="Tìm chuyến đi đã tải" icon="search" value={query} onChangeText={setQuery} maxLength={200} placeholder="Tìm tên, không cần gõ dấu…" />
      <Segments value={sort} onChange={setSort} items={[{ value: "default", label: "Mặc định" }, { value: "asc", label: "Ngày tăng" }, { value: "desc", label: "Ngày giảm" }]} />
      <Text style={typography.footnote}>{visible.length} kết quả / {items.length} chuyến đã tải. Bộ lọc, số đếm và sắp xếp áp dụng cho các trang đã tải{resource.data?.next_cursor ? "; bấm Xem thêm để tìm trong các chuyến còn lại." : "."}</Text>
      <ResourceFeedback
        {...resource}
        hasData={!!resource.data}
        onRetry={() => {
          void resource.reload();
        }}
      />
      {visible.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
      {resource.data && !visible.length && (
        <EmptyState
          title="Trang hành trình còn trống"
          message="Không có chuyến phù hợp trong các trang đã tải. Thử đổi từ khóa, bộ lọc hoặc tải thêm."
        />
      )}
      {moreError && <Feedback message={moreError} />}
      {resource.data?.next_cursor && (
        <Button
          label="Xem thêm chuyến đi"
          loading={more}
          variant="soft"
          onPress={() => {
            void loadMore();
          }}
        />
      )}
      <Button
        label="+ Tạo một hành trình mới"
        variant="soft"
        onPress={() => router.push("/create-trip")}
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  heading: { marginBottom: 4, paddingTop: 8 },
});
