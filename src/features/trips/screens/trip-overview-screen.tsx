import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
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
import { money as budgetNumber, moneyLabel } from "../model/local-parity";
import { activityDay, dateKey, sortedActivities } from "../utils";

function packingTile(done: number, total: number) {
  if (!total) return { value: "Chưa có đồ", label: "Thêm đồ cần mang theo" };
  if (done === total) return { value: "Đã đủ đồ", label: `${total} món đã sẵn sàng`, progress: 1 };
  return { value: `${done}/${total} món`, label: "Đồ đã chuẩn bị", progress: done / total };
}

export default function TripOverviewScreen() {
  const resource = useTrip();
  const { data, id } = resource;
  const { cover } = useLocalSearchParams<{ cover?: string }>();
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
          {trip.budget_amount && budgetNumber(trip.budget_amount) ? <Text style={typography.footnote}>Ngân sách dự kiến: {moneyLabel(budgetNumber(trip.budget_amount)!)}</Text> : null}
          {cover === "failed" && !trip.cover_image_available && <Feedback tone="warning" message="Chuyến đi đã tạo nhưng ảnh bìa chưa tải lên được. Vào Cài đặt → Chỉnh sửa thông tin để thử lại." />}
          <TripNavigation id={id} active="overview" />
          {trip.description && (
            <Text style={[typography.body, { color: colors.muted }]}>
              {trip.description}
            </Text>
          )}
          <StatGrid>
            <StatTile icon="calendar" tone="blue" value={plan.activities.length ? `${plan.activities.length} hoạt động` : "Chưa có"} label={plan.activities.length ? "Lịch trình chuyến đi" : "Thêm hoạt động đầu tiên"} accessibilityLabel="Xem lịch trình" onPress={() => openTrip(id, "itinerary")} />
            <StatTile icon="wallet" tone="mint" value="Quỹ nhóm" label="Xem đóng góp và số dư" onPress={() => router.push({ pathname: "/trip/[id]/fund", params: { id } })} />
            <StatTile icon="bag" tone="butter" {...packingTile(done, plan.packing_items.length)} accessibilityLabel="Xem đồ" onPress={() => router.push({ pathname: "/trip/[id]/packing", params: { id } })} />
            <StatTile icon="shirt" tone="peach" value={plan.dress_codes.length ? `${plan.dress_codes.length} gợi ý` : "Chưa có"} label={plan.dress_codes.length ? "Dress code của nhóm" : "Thêm gợi ý trang phục"} onPress={() => router.push({ pathname: "/trip/[id]/dress-code", params: { id } })} />
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
              scene="greet"
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
