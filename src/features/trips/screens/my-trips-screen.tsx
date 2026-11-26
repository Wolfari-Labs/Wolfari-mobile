import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useApi } from "@/shared/api/use-api";
import { errorMessage } from "@/shared/api/errors";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, gradients, radii, shadows, typography } from "@/shared/theme/tokens";
import { AppHeader } from "@/shared/ui/app-header";
import { Button } from "@/shared/ui/button";
import { ClayChip } from "@/shared/ui/clay-form";
import { ClayIcon } from "@/shared/ui/setting-card";
import { Feedback } from "@/shared/ui/feedback";
import { EmptyState, ResourceFeedback } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { DesignIcon } from "@/shared/ui/design-icon";
import { Sheet } from "@/shared/ui/sheet";
import { queryTrips, type TripFilter, type TripSort } from "../model/trip-list-query";
import { TripCard } from "../components/trip-card";
import { lifecycleLabels } from "../utils";

const filterLabels = { ALL: "Tất cả chuyến đi", ...lifecycleLabels } satisfies Record<TripFilter, string>;
const sortLabels = { default: "Mặc định", asc: "Ngày khởi hành tăng dần", desc: "Ngày khởi hành giảm dần" } satisfies Record<TripSort, string>;

export default function MyTripsScreen() {
  const api = useApi();
  const [filter, setFilter] = useState<TripFilter>("UPCOMING");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TripSort>("default");
  const [picker, setPicker] = useState<"filter" | "sort" | null>(null);
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
  const searching = query.trim().length > 0;
  const nextCursor = resource.data?.next_cursor;
  const latestLoadMore = useRef(loadMore);
  useEffect(() => {
    latestLoadMore.current = loadMore;
  });
  // A search covers every trip: keep fetching the remaining pages (debounced while typing).
  useEffect(() => {
    if (!searching || !nextCursor || resource.loading || moreError) return;
    const timer = setTimeout(() => void latestLoadMore.current(), 400);
    return () => clearTimeout(timer);
  }, [searching, nextCursor, resource.loading, moreError]);
  const items = resource.data?.items ?? [];
  const group = filter === "UPCOMING" ? items.filter(t => t.lifecycle === "UPCOMING" || t.lifecycle === "ONGOING") : items;
  const visible = queryTrips(group, filter === "UPCOMING" ? "ALL" : filter, query, sort);
  const featured = (filter === "UPCOMING" || filter === "ALL") && !query.trim() && sort === "default"
    ? visible.find(trip => trip.lifecycle === "ONGOING") ?? visible.find(trip => trip.lifecycle === "UPCOMING")
    : undefined;
  const rows = featured ? visible.filter(trip => trip.id !== featured.id) : visible;
  return (
    <Screen
      header={<AppHeader />}
      floating={<Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="+ Tạo một hành trình mới" onPress={() => router.push("/create-trip")} style={styles.fab}><LinearGradient colors={gradients.primary} style={[StyleSheet.absoluteFill, {borderRadius: 30}]} /><ClayIcon name="fabPlus" size={26} /></Pressable>}
      tab="trips"
      refreshing={resource.loading && !!resource.data}
      onRefresh={() => {
        void resource.reload();
      }}
    >
      <View style={styles.search}>
        <DesignIcon name="search" size={18} tintColor={colors.muted} />
        <TextInput accessibilityLabel="Tìm chuyến đi" value={query} onChangeText={v => { setQuery(v); if (v && !query) setFilter("ALL"); }} maxLength={200}
          placeholder="Tìm chuyến đi, điểm đến…" placeholderTextColor={colors.muted} style={styles.input} returnKeyType="search" />
        <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Lọc và sắp xếp chuyến đi" onPress={() => setPicker("filter")} style={styles.searchOption}><DesignIcon name="filter" size={18} tintColor={colors.blue} /></Pressable>
      </View>
      <ResourceFeedback {...resource} hasData={!!resource.data} onRetry={() => { void resource.reload(); }} />
      {featured && <TripCard trip={featured} layout="spotlight" />}
      <View style={styles.collection}>
        <View style={styles.chips} accessibilityRole="tablist">
          {(["UPCOMING","COMPLETED","ARCHIVED"] as const).map((value,index) => {
            const count = items.filter(t => t.lifecycle === value || (value === "UPCOMING" && t.lifecycle === "ONGOING")).length;
            return <ClayChip role="tab" key={value} selected={filter === value} label={["Sắp tới","Đã qua","Lưu trữ"][index] + (count ? ` · ${count}${nextCursor ? "+" : ""}` : "")} onPress={() => setFilter(value)} />;
          })}
        </View>
        {filter === "ALL" || filter === "ONGOING" || searching ? <Text style={typography.footnote}>{filterLabels[filter]} · {visible.length} kết quả{nextCursor ? "+" : ""}</Text> : null}
        {rows.map(trip => <TripCard key={trip.id} trip={trip} layout="row" />)}
        {resource.data && !visible.length && (
          <EmptyState title="Trang hành trình còn trống" scene={items.length ? "notFound" : "greet"}
            message={searching && nextCursor ? "Đang tìm trong các chuyến đi còn lại…" : items.length ? "Không có chuyến phù hợp. Thử đổi từ khóa hoặc bộ lọc." : "Chọn Tạo mới để lên kế hoạch cho chuyến đi đầu tiên."} />
        )}
        {moreError && <Feedback message={moreError} />}
        {nextCursor && (!searching || moreError) && <Button label="Xem thêm chuyến đi" loading={more} variant="soft" onPress={() => { void loadMore(); }} />}
      </View>
      <Sheet visible={picker !== null} title={picker === "sort" ? "Sắp xếp chuyến đi" : "Lọc theo trạng thái"} onClose={() => setPicker(null)}>
        {picker === "filter" && <Button variant="soft" label="Sắp xếp chuyến đi" onPress={() => setPicker("sort")} />}
        {picker === "filter" && (Object.keys(filterLabels) as TripFilter[]).map(value => (
          <PickerRow key={value} label={filterLabels[value]} selected={filter === value}
            count={value === "ALL" ? items.length : items.filter(trip => trip.lifecycle === value || (value === "UPCOMING" && trip.lifecycle === "ONGOING")).length}
            onPress={() => { setFilter(value); setMoreError(undefined); setPicker(null); }} />
        ))}
        {picker === "sort" && (Object.keys(sortLabels) as TripSort[]).map(value => (
          <PickerRow key={value} label={sortLabels[value]} selected={sort === value}
            onPress={() => { setSort(value); setPicker(null); }} />
        ))}
      </Sheet>
    </Screen>
  );
}

function PickerRow({ label, selected, count, onPress }: { label: string; selected: boolean; count?: number; onPress: () => void }) {
  return <Pressable cssInterop={false} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected }}
    onPress={onPress} style={({ pressed }) => [styles.option, selected && styles.selected, pressed && styles.pressed]}>
    <Text style={styles.optionText}>{label}</Text>
    {count !== undefined && <Text style={typography.footnote}>{count}</Text>}
    <View style={styles.check}>{selected && <DesignIcon name="check" size={18} tintColor={colors.tealPressed} />}</View>
  </Pressable>;
}

const styles = StyleSheet.create({
  fab: { width: 60, height: 60, justifyContent: "center", alignItems: "center", borderRadius: 30, ...shadows.floating },
  search: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 18, paddingRight: 6, backgroundColor: colors.surface, borderRadius: radii.pill, ...shadows.glass },
  searchOption: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  input: { ...typography.body, flex: 1, minWidth: 0, minHeight: 48 },
  collection: { gap: 14 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pressed: { opacity: 0.65 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  selected: { backgroundColor: colors.tealSoft },
  optionText: { ...typography.headline, flex: 1 },
  check: { width: 20, alignItems: "center" },
});
