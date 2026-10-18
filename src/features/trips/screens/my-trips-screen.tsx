import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { TripCard } from "../components/trip-card";
import type { Lifecycle } from "../types";
import { lifecycleLabels } from "../utils";

export default function MyTripsScreen() {
  const api = useApi();
  const [filter, setFilter] = useState<Lifecycle>("UPCOMING");
  const resource = useResource(
    useCallback(
      (signal: AbortSignal) => api.trips.list(filter, undefined, signal),
      [api, filter],
    ),
  );
  const [more, setMore] = useState(false);
  const [moreError, setMoreError] = useState<string>();
  const currentFilter = useRef(filter);
  useEffect(() => {
    currentFilter.current = filter;
  }, [filter]);
  const locked = useRef(false);
  async function loadMore() {
    if (!resource.data?.next_cursor || locked.current) return;
    locked.current = true;
    setMore(true);
    setMoreError(undefined);
    const requestedFilter = filter;
    try {
      const page = await api.trips.list(filter, resource.data.next_cursor);
      if (currentFilter.current === requestedFilter)
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
      if (currentFilter.current === requestedFilter)
        setMoreError(errorMessage(cause));
    } finally {
      locked.current = false;
      setMore(false);
    }
  }
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
        items={(Object.keys(lifecycleLabels) as Lifecycle[]).map((value) => ({
          value,
          label: lifecycleLabels[value],
        }))}
        value={filter}
        onChange={(value) => {
          setMoreError(undefined);
          setFilter(value);
        }}
      />
      <ResourceFeedback
        {...resource}
        hasData={!!resource.data}
        onRetry={() => {
          void resource.reload();
        }}
      />
      {resource.data?.items.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
      {resource.data && !resource.data.items.length && (
        <EmptyState
          title="Trang hành trình còn trống"
          message={`Bạn chưa có chuyến đi ở mục “${lifecycleLabels[filter]}”. Tạo một chuyến đi mới để bắt đầu nhé.`}
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
