import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { useApi } from "@/shared/api/use-api";
import { errorMessage } from "@/shared/api/errors";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, radii, shadows, typography } from "@/shared/theme/tokens";
import { AppHeader } from "@/shared/ui/app-header";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { EmptyState, IconButton, ResourceFeedback, Segments } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { DesignIcon } from "@/shared/ui/design-icon";
import { Sheet } from "@/shared/ui/sheet";
import { queryTrips, type TripFilter, type TripSort } from "../model/trip-list-query";
import { TripCard } from "../components/trip-card";
import type { Lifecycle } from "../types";
import { lifecycleLabels } from "../utils";

export default function MyTripsScreen() {
  const api = useApi();
  const [filter, setFilter] = useState<TripFilter>("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TripSort>("default");
  const [sortOpen, setSortOpen] = useState(false);
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
  const featured = filter === "ALL" && !query.trim() && sort === "default"
    ? visible.find(trip => trip.lifecycle === "ONGOING") ?? visible.find(trip => trip.lifecycle === "UPCOMING")
    : undefined;
  const rows = featured ? visible.filter(trip => trip.id !== featured.id) : visible;
  return (
    <Screen
      header={<AppHeader />}
      tab="trips"
      refreshing={resource.loading && !!resource.data}
      onRefresh={() => {
        void resource.reload();
      }}
    >
      <View style={styles.search}>
        <DesignIcon name="search" size={20} tintColor={colors.muted} />
        <TextInput accessibilityLabel="Tìm chuyến đi đã tải" value={query} onChangeText={setQuery} maxLength={200}
          placeholder="Tìm chuyến đi, điểm đến…" placeholderTextColor={colors.muted} style={styles.input} returnKeyType="search" />
        <IconButton icon="filter" label="Sắp xếp chuyến đi" onPress={() => setSortOpen(true)} />
      </View>
      {featured && <TripCard trip={featured} ticket />}
      <View style={{ gap: 12 }}>
        <Text accessibilityRole="header" style={typography.headline}>Chuyến đi của tôi</Text>
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
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={[typography.footnote, { flex: 1 }]}>{visible.length} / {items.length} hành trình đã tải</Text>
        <Text style={typography.footnote}>{sort === "default" ? "Mặc định" : sort === "asc" ? "Ngày tăng" : "Ngày giảm"}</Text>
      </View>
      <ResourceFeedback
        {...resource}
        hasData={!!resource.data}
        onRetry={() => {
          void resource.reload();
        }}
      />
      {rows.map(trip => <TripCard key={trip.id} trip={trip} compact />)}
      {resource.data && !visible.length && (
        <EmptyState
          title="Trang hành trình còn trống"
          message="Không có chuyến phù hợp trong các trang đã tải. Thử đổi từ khóa, bộ lọc hoặc tải thêm."
        />
      )}
      {moreError && <Feedback message={moreError} />}
      <Text style={typography.footnote}>Bộ lọc, số đếm và sắp xếp áp dụng cho các trang đã tải{resource.data?.next_cursor ? "; bấm Xem thêm để tìm trong các chuyến còn lại." : "."}</Text>
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
      <Sheet visible={sortOpen} title="Sắp xếp chuyến đi" onClose={() => setSortOpen(false)}>
        <Text style={typography.footnote}>Sắp xếp theo ngày bắt đầu trong các chuyến đã tải.</Text>
        <Segments value={sort} onChange={(value) => { setSort(value); setSortOpen(false); }} items={[{ value: "default", label: "Mặc định" }, { value: "asc", label: "Ngày tăng" }, { value: "desc", label: "Ngày giảm" }]} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, minHeight: 56, borderRadius: radii.pill, paddingLeft: 18, paddingRight: 6, ...shadows.glass },
  input: { ...typography.body, flex: 1, minWidth: 0, minHeight: 48, paddingVertical: 12 },
});
