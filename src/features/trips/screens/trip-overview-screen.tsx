import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import {
  EmptyState,
  IconButton,
  Progress,
  ResourceFeedback,
  SectionLink,
  ui,
} from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { ActivityRow } from "../components/activity-row";
import { TripCard } from "../components/trip-card";
import { openTrip, TripNavigation } from "../components/trip-navigation";
import { useTrip } from "../hooks/use-trip";
import { dateKey, sortedActivities } from "../utils";

export default function TripOverviewScreen() {
  const resource = useTrip();
  const { data, id } = resource;
  const plan = data?.plan,
    trip = data?.trip;
  const firstDay = trip ? dateKey(trip.start_at, trip.timezone) : "";
  const activities =
    plan && trip
      ? sortedActivities(
          plan.activities.filter(
            (a) =>
              a.starts_at && dateKey(a.starts_at, trip.timezone) === firstDay,
          ),
        )
      : [];
  const done =
    plan?.packing_items.filter((item) => item.status === "COMPLETED").length ??
    0;
  return (
    <Screen
      title={trip?.name ?? "Chuyến đi của tôi"}
      tab="trips"
      refreshing={resource.loading && !!data}
      onRefresh={() => {
        void resource.reload();
      }}
      headerRight={
        <IconButton
          icon="gear"
          label="Cài đặt chuyến đi"
          onPress={() =>
            router.push({ pathname: "/trip/[id]/settings", params: { id } })
          }
        />
      }
    >
      <ResourceFeedback
        {...resource}
        hasData={!!data}
        onRetry={() => {
          void resource.reload();
        }}
      />
      {trip && plan && (
        <>
          <TripNavigation id={id} active="overview" />
          <TripCard trip={trip} />
          {trip.description && (
            <Text style={[typography.body, { color: colors.muted }]}>
              {trip.description}
            </Text>
          )}
          <View style={[ui.row, { alignItems: "stretch", flexWrap: "wrap" }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xem lịch trình"
              onPress={() => openTrip(id, "itinerary")}
              style={({ pressed }) => [
                ui.card,
                { flex: 1, minWidth: 128, padding: 16 },
                pressed && ui.pressed,
              ]}
            >
              <Text style={typography.footnote}>Trải nghiệm</Text>
              <Text style={typography.largeTitle}>
                {plan.activities.length}
              </Text>
              <Text style={typography.footnote}>
                {plan.activities.filter((a) => a.status === "COMPLETED").length}{" "}
                đã hoàn thành
              </Text>
              <Text style={[typography.footnote, { color: colors.teal }]}>
                Xem lịch trình ›
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xem đồ"
              onPress={() =>
                router.push({ pathname: "/trip/[id]/packing", params: { id } })
              }
              style={({ pressed }) => [
                ui.card,
                { flex: 1, minWidth: 128, padding: 16 },
                pressed && ui.pressed,
              ]}
            >
              <Text style={typography.footnote}>Hành lý</Text>
              <Text style={typography.title}>
                {done} / {plan.packing_items.length}
              </Text>
              <Progress done={done} total={plan.packing_items.length} />
              <Text style={[typography.footnote, { color: colors.teal }]}>
                Xem đồ cần mang ›
              </Text>
            </Pressable>
          </View>
          <View
            style={[ui.row, { justifyContent: "space-between", marginTop: 8 }]}
          >
            <Text
              accessibilityRole="header"
              style={[typography.section, ui.flex]}
            >
              Lịch trình ngày đầu
            </Text>
            <Button
              label="Xem tất cả"
              compact
              variant="soft"
              onPress={() => openTrip(id, "itinerary")}
            />
          </View>
          {activities.slice(0, 3).map((activity) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              timezone={trip.timezone}
              onPress={() => openTrip(id, "itinerary")}
            />
          ))}
          {!activities.length && (
            <EmptyState
              title="Ngày đầu tiên, nhiều mong đợi"
              message="Thêm những điểm dừng và trải nghiệm để cả nhóm cùng chuẩn bị."
              action={
                plan.permissions.can_edit ? (
                  <Button
                    label="Thêm hoạt động"
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
          <SectionLink
            title="Bạn đồng hành"
            subtitle="Thành viên và lời mời của nhóm"
            icon="users"
            onPress={() =>
              router.push({ pathname: "/trip/[id]/members", params: { id } })
            }
          />
        </>
      )}
    </Screen>
  );
}
