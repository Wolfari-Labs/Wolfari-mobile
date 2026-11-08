import { router } from "expo-router";
import { Text, View } from "react-native";

import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import {
  EmptyState,
  IconButton,
  ResourceFeedback,
  SectionLink,
  ui,
} from "@/shared/ui/journal";
import { StatGrid, StatTile } from "@/shared/ui/pastel";
import { Screen } from "@/shared/ui/screen";
import { layered } from "@/shared/ui/page-intro";
import { ActivityRow } from "../components/activity-row";
import { TripCard } from "../components/trip-card";
import { openTrip, TripNavigation } from "../components/trip-navigation";
import { useTrip } from "../hooks/use-trip";
import { activityDay, dateKey, sortedActivities, tripDates } from "../utils";

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
              activityDay(a, trip.timezone) === firstDay,
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
          <TripCard trip={trip} interactive={false} />
          <Text selectable style={typography.footnote}>{tripDates(trip)}</Text>
          <TripNavigation id={id} active="overview" />
          {trip.description && (
            <Text style={[typography.body, { color: colors.muted }]}>
              {trip.description}
            </Text>
          )}
          <StatGrid>
            <StatTile icon="calendar" tone="blue" value={`${plan.activities.length} hoạt động`} label="Lịch trình chuyến đi" accessibilityLabel="Xem lịch trình" onPress={() => openTrip(id, "itinerary")} />
            <StatTile icon="wallet" tone="mint" value="Quỹ nhóm" label="Xem đóng góp và số dư" onPress={() => router.push({ pathname: "/trip/[id]/fund", params: { id } })} />
            <StatTile icon="bag" tone="butter" value={`${done}/${plan.packing_items.length} món`} label="Hành lý đã sẵn sàng" accessibilityLabel="Xem đồ" onPress={() => router.push({ pathname: "/trip/[id]/packing", params: { id } })} />
            <StatTile icon="shirt" tone="peach" value={`${plan.dress_codes.length} gợi ý`} label="Dress code của nhóm" onPress={() => router.push({ pathname: "/trip/[id]/dress-code", params: { id } })} />
          </StatGrid>
          <View style={layered.panel}>
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
              variant="text"
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
          </View>
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
