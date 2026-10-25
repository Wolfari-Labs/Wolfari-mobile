import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { useCommand } from "@/shared/hooks/use-command";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import {
  EmptyState,
  IconButton,
  ResourceFeedback,
  Segments,
  ui,
} from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { Sheet } from "@/shared/ui/sheet";
import { ActivityRow } from "../components/activity-row";
import { TripNavigation } from "../components/trip-navigation";
import { ItineraryOrderEditor } from "../components/itinerary-order-editor";
import { useTrip } from "../hooks/use-trip";
import type { Activity } from "../types";
import {
  dateKey,
  dateLabel,
  sortedActivities,
  timeLabel,
  tripDays,
} from "../utils";

export default function ItineraryScreen() {
  const resource = useTrip(),
    command = useCommand();
  const { data, api, id } = resource;
  const [day, setDay] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [orderSaved, setOrderSaved] = useState(false);
  const trip = data?.trip,
    plan = data?.plan;
  const days = trip ? tripDays(trip) : [];
  const activeDay = day ?? days[0];
  const activities =
    plan && trip
      ? sortedActivities(
          plan.activities.filter((a) =>
            activeDay === "unscheduled"
              ? !a.starts_at
              : a.starts_at &&
                dateKey(a.starts_at, trip.timezone) === activeDay,
          ),
        )
      : [];
  const selected = plan?.activities.find((a) => a.id === selectedId);
  async function complete(activity: Activity) {
    if (!plan) return;
    const result = await command.run(
      {
        action: "completion",
        id: activity.id,
        version: plan.plan_version,
        status: activity.status,
      },
      (key) => api.trips.complete(id, activity, plan.plan_version, key),
    );
    if (result) {
      await resource.reload();
      setSelectedId(undefined);
    }
  }
  async function remove(activity: Activity) {
    if (!plan) return;
    const result = await command.run(
      { action: "delete", id: activity.id, version: plan.plan_version },
      (key) =>
        api.trips.removeActivity(id, activity.id, plan.plan_version, key),
    );
    if (result) {
      setSelectedId(undefined);
      setConfirmDelete(false);
      await resource.reload();
    }
  }
  return (
    <Screen
      title={trip?.name ?? "Lịch trình"}
      tab="trips"
      refreshing={resource.loading && !!data}
      onRefresh={() => {
        void resource.reload();
      }}
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
          <TripNavigation id={id} active="itinerary" />
          <Button label="Thử lập bản nháp riêng" variant="soft" compact onPress={() => router.push({ pathname: "/trip/[id]/plan-draft", params: { id } })} />
          <Segments
            scroll
            items={[
              ...days.map((value, index) => ({
                value,
                label: `Ngày ${index + 1} · ${value.slice(8)}/${value.slice(5, 7)}`,
              })),
              { value: "unscheduled", label: "Chưa xếp lịch" },
            ]}
            value={activeDay ?? "unscheduled"}
            onChange={setDay}
          />
          <View style={[ui.row, { justifyContent: "space-between" }]}>
            <Text style={typography.footnote}>
              {activities.length} hoạt động · Giờ {trip.timezone}
            </Text>
            {plan.permissions.can_edit && (
              <IconButton
                icon="plus"
                label="Thêm hoạt động"
                onPress={() =>
                  router.push({
                    pathname: "/trip/[id]/activity",
                    params: { id, day: activeDay },
                  })
                }
              />
            )}
          </View>
          {plan.permissions.can_edit && activities.length > 1 && (
            <Button
              label="Sắp xếp lịch trình"
              variant="soft"
              compact
              disabled={command.busy}
              onPress={() => {
                setOrderSaved(false);
                setReordering(true);
              }}
            />
          )}
          {orderSaved && (
            <Feedback
              success
              message="Đã lưu thứ tự cho cả nhóm. Giờ của các hoạt động được giữ nguyên."
            />
          )}
          {reordering && (
            <ItineraryOrderEditor
              tripId={id}
              day={activeDay ?? "unscheduled"}
              timezone={trip.timezone}
              onClose={() => setReordering(false)}
              onSaved={() => {
                setReordering(false);
                setOrderSaved(true);
                void resource.reload();
              }}
            />
          )}
          {activities.map((activity) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              timezone={trip.timezone}
              onPress={() => {
                command.clearError();
                setConfirmDelete(false);
                setSelectedId(activity.id);
              }}
            />
          ))}
          {!activities.length && (
            <EmptyState
              title="Chừa chỗ cho điều thú vị"
              message={
                activeDay === "unscheduled"
                  ? "Các hoạt động chưa chọn giờ sẽ xuất hiện ở đây."
                  : "Ngày này chưa có hoạt động. Cùng nhóm thêm một trải nghiệm nhé."
              }
              icon="calendar"
            />
          )}
          {!plan.permissions.can_edit && (
            <Text style={typography.footnote}>
              Bạn có thể xem kế hoạch. Người tổ chức quản lý quyền chỉnh sửa của
              nhóm.
            </Text>
          )}
          <Sheet
            dismissible={!command.busy}
            visible={!!selected}
            title={
              confirmDelete
                ? "Xóa hoạt động?"
                : (selected?.title ?? "Hoạt động")
            }
            onClose={() => {
              if (!command.busy) setSelectedId(undefined);
            }}
          >
            {selected && (
              <>
                <Text style={typography.footnote}>
                  {selected.starts_at
                    ? dateLabel(selected.starts_at, trip.timezone)
                    : "Chưa xếp lịch"}
                </Text>
                <View style={ui.card}>
                  <Text style={typography.headline}>
                    {timeLabel(selected.starts_at, trip.timezone)}
                    {selected.ends_at
                      ? ` – ${timeLabel(selected.ends_at, trip.timezone)}`
                      : ""}
                  </Text>
                  <Text style={typography.body}>
                    {selected.description ||
                      "Chưa có ghi chú cho hoạt động này."}
                  </Text>
                </View>
                {command.error && (
                  <>
                    <Feedback message={command.error} />
                    <Button
                      label="Tải kế hoạch mới nhất"
                      variant="soft"
                      compact
                      onPress={() => {
                        void resource.reload();
                      }}
                    />
                  </>
                )}
                {confirmDelete ? (
                  <>
                    <Text style={typography.body}>
                      Hoạt động sẽ được gỡ khỏi lịch trình của cả nhóm.
                    </Text>
                    <Button
                      label="Xác nhận xóa hoạt động"
                      variant="destructive"
                      loading={command.busy}
                      onPress={() => {
                        void remove(selected);
                      }}
                    />
                    <Button
                      label="Giữ lại"
                      variant="soft"
                      disabled={command.busy}
                      onPress={() => setConfirmDelete(false)}
                    />
                  </>
                ) : (
                  <>
                    {plan.permissions.can_complete && (
                      <Button
                        label={
                          selected.status === "COMPLETED"
                            ? "Đánh dấu chưa hoàn thành"
                            : "Đánh dấu hoàn thành"
                        }
                        loading={command.busy}
                        onPress={() => {
                          void complete(selected);
                        }}
                      />
                    )}
                    {plan.permissions.can_edit && (
                      <>
                        <Button
                          label="Chỉnh sửa hoạt động"
                          variant="soft"
                          disabled={command.busy}
                          onPress={() => {
                            setSelectedId(undefined);
                            router.push({
                              pathname: "/trip/[id]/activity",
                              params: { id, activityId: selected.id },
                            });
                          }}
                        />
                        <Button
                          label="Xóa hoạt động"
                          variant="destructive"
                          disabled={command.busy}
                          onPress={() => setConfirmDelete(true)}
                        />
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </Sheet>
        </>
      )}
    </Screen>
  );
}
