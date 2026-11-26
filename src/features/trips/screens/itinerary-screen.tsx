import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useCommand } from "@/shared/hooks/use-command";
import { colors, fonts, radii, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { DesignIcon } from "@/shared/ui/design-icon";
import { Feedback } from "@/shared/ui/feedback";
import { EmptyState, IconButton, ResourceFeedback, Segments, ui } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { Sheet } from "@/shared/ui/sheet";
import { Snackbar, toast } from "@/shared/ui/toast";
import { ActivityOrderList, type DragStatus } from "../components/activity-order-list";
import { ActivityRow } from "../components/activity-row";
import { ActivityScheduleSheet } from "../components/activity-schedule-sheet";
import { DayWeather } from "../components/day-weather";
import { TripNavigation } from "../components/trip-navigation";
import { useItineraryEditor } from "../hooks/use-itinerary-editor";
import { useTrip } from "../hooks/use-trip";
import type { Activity, Plan, Trip } from "../types";
import { activityDay, calendarLabel, dateLabel, sortedActivities, timeLabel, tripDays } from "../utils";

/** Open on the first day that has plans, so a fresh trip never looks empty. */
function firstBusyDay(trip: Trip, plan: Plan, days: string[]) {
  const used = new Set(plan.activities.map((a) => activityDay(a, trip.timezone) ?? "unscheduled"));
  return days.find((day) => used.has(day)) ?? (used.has("unscheduled") ? "unscheduled" : days[0]);
}

export default function ItineraryScreen() {
  const [editing, setEditing] = useState(false);
  // While editing, the editor's own versioned session owns the plan.
  const resource = useTrip(editing),
    command = useCommand();
  const { data, api, id } = resource;
  const { day: linkedDay } = useLocalSearchParams<{ day?: string }>();
  const [day, setDay] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [orderSaved, setOrderSaved] = useState<string>();
  const [dragStatus, setDragStatus] = useState<DragStatus>();
  // Auto-arrange asked for from view mode; applied once the editor session holds the plan.
  const pendingAuto = useRef<"times" | "route">(undefined);
  const trip = data?.trip,
    plan = data?.plan;
  const days = trip ? tripDays(trip) : [];
  const activeDay = day ?? (linkedDay && (days.includes(linkedDay) || linkedDay === "unscheduled") ? linkedDay : undefined) ?? (trip && plan ? firstBusyDay(trip, plan, days) : undefined) ?? "unscheduled";
  const editor = useItineraryEditor({
    tripId: id,
    trip,
    plan,
    active: editing,
    day: activeDay,
    onDay: setDay,
    onExit: async (saved) => {
      if (saved) {
        await resource.reload();
        setOrderSaved(saved);
      }
      setDragStatus(undefined);
      setEditing(false);
    },
  });
  const activities =
    plan && trip
      ? sortedActivities(
          plan.activities.filter((a) =>
            activeDay === "unscheduled" ? !activityDay(a, trip.timezone) : activityDay(a, trip.timezone) === activeDay,
          ),
        )
      : [];
  const selected = editing ? undefined : plan?.activities.find((a) => a.id === selectedId);
  const canArrange = !!plan?.permissions.can_edit && plan.activities.length > 0;
  function arrange(kind: "times" | "route") {
    const result = editor.autoArrange(kind);
    if (result.ok) toast.info(result.message, { title: kind === "route" ? "Đã tối ưu lộ trình" : "Đã xếp khung giờ" });
    else toast.error(result.message);
  }
  useEffect(() => {
    const kind = pendingAuto.current;
    if (!editing || !kind || !editor.state.plan || editor.locked) return;
    pendingAuto.current = undefined;
    arrange(kind);
  });
  function startEditing(auto?: "times" | "route") {
    if (auto) pendingAuto.current = auto;
    if (command.busy || !canArrange || editing) return;
    setSelectedId(undefined);
    setOrderSaved(undefined);
    editor.start();
    setEditing(true);
  }
  async function complete(activity: Activity) {
    if (!plan) return;
    const result = await command.run(
      { action: "completion", id: activity.id, version: plan.plan_version, status: activity.status },
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
      (key) => api.trips.removeActivity(id, activity.id, plan.plan_version, key),
    );
    if (result) {
      setSelectedId(undefined);
      setConfirmDelete(false);
      await resource.reload();
    }
  }
  const dayLabel = activeDay === "unscheduled" ? "mục Chưa xếp lịch" : `ngày ${activeDay.slice(8)}/${activeDay.slice(5, 7)}`;
  const draft = editor.state;
  const editFooter = editor.discard ? (
    <>
      <Text style={[typography.headline, { textAlign: "center" }]}>Bỏ các thay đổi?</Text>
      <Text style={[typography.footnote, { textAlign: "center" }]}>
        {draft.uncertain
          ? "Yêu cầu lưu có thể đã tới máy chủ. Khi mở lại, app sẽ tải trạng thái mới nhất; hãy kiểm tra trước khi sửa tiếp."
          : "Thứ tự và giờ chưa lưu sẽ bị bỏ. Kế hoạch của nhóm không thay đổi."}
      </Text>
      <View style={styles.actions}>
        <Button label="Tiếp tục sắp xếp" variant="soft" compact style={styles.action} onPress={editor.keepEditing} />
        <Button label="Bỏ thay đổi" variant="destructive" compact style={styles.action} onPress={editor.discardDraft} />
      </View>
    </>
  ) : (
    <View style={styles.actions}>
      <Button label="Hủy" variant="soft" disabled={editor.busy || editor.isDragging} style={styles.cancel} onPress={editor.close} />
      <Button
        label={draft.uncertain ? "Thử lưu lại" : "Lưu thứ tự cho nhóm"}
        loading={editor.busy}
        disabled={editor.isDragging || draft.loading || draft.conflict || !draft.plan?.permissions.can_edit || !editor.dirty}
        style={styles.action}
        onPress={() => {
          void editor.save();
        }}
      />
    </View>
  );
  return (
    <Screen
      title={trip?.name ?? "Lịch trình"}
      tab={editing ? undefined : "trips"}
      onBack={editing ? editor.close : undefined}
      footer={editing ? editFooter : undefined}
      scrollEnabled={!editor.isDragging}
      refreshing={!editing && resource.loading && !!data}
      onRefresh={
        editing
          ? undefined
          : () => {
              void resource.reload();
            }
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
          {editing ? (
            <View style={styles.editBar}>
              <View style={styles.editIcon}>
                <DesignIcon name="edit" size={18} tintColor={colors.teal} />
              </View>
              <Text style={[typography.headline, { flex: 1 }]} numberOfLines={2}>
                Đang sắp xếp {dayLabel}
              </Text>
              <View style={[styles.status, editor.dirty && styles.statusDirty]}>
                <Text style={[styles.statusText, editor.dirty && styles.statusDirtyText]}>
                  {draft.plan ? (editor.dirty ? "Chưa lưu" : "Đã đồng bộ") : "Đang tải"}
                </Text>
              </View>
            </View>
          ) : (
            <TripNavigation id={id} active="itinerary" />
          )}
          <Segments
            scroll
            items={[
              ...days.map((value, index) => ({
                value,
                label: `Ngày ${index + 1} · ${value.slice(8)}/${value.slice(5, 7)}`,
              })),
              { value: "unscheduled", label: "Chưa xếp lịch" },
            ]}
            value={activeDay}
            onChange={(value) => {
              if (!editor.isDragging) setDay(value);
            }}
          />
          {!editing && activeDay !== "unscheduled" && <DayWeather api={api} trip={trip} plan={plan} day={activeDay} />}
          <View style={[ui.row, styles.toolbar]}>
            {editing ? (
              <View style={{ flex: 1, gap: 8 }}>
                <Text accessibilityLiveRegion="polite" style={typography.footnote}>
                  {dragStatus
                    ? `Thả vào vị trí ${dragStatus.position} / ${dragStatus.total} · Chưa lưu`
                    : "Giữ thẻ để kéo · Chạm giờ để đổi lịch"}
                </Text>
                {activeDay !== "unscheduled" && editor.activities.length > 0 && (
                  <View style={styles.helpers}>
                    <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Tự xếp giờ cho ngày này" disabled={editor.locked || editor.isDragging}
                      onPress={() => arrange("times")} style={({ pressed }) => [styles.helper, pressed && { opacity: 0.7 }]}>
                      <Text style={styles.helperText}>✨ Tự xếp giờ</Text>
                    </Pressable>
                    {editor.activities.length > 2 && <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Sắp theo lộ trình ngắn nhất" disabled={editor.locked || editor.isDragging}
                      onPress={() => arrange("route")} style={({ pressed }) => [styles.helper, pressed && { opacity: 0.7 }]}>
                      <Text style={styles.helperText}>🧭 Lộ trình ngắn nhất</Text>
                    </Pressable>}
                  </View>
                )}
              </View>
            ) : (
              <>
                <Text style={[typography.footnote, { flex: 1 }]} accessibilityLabel={`${activities.length} hoạt động, giờ theo ${trip.timezone}`}>
                  {activities.length} hoạt động
                </Text>
                {canArrange && activeDay !== "unscheduled" && activities.length > 0 && (
                  <Pressable
                    cssInterop={false}
                    accessibilityRole="button"
                    accessibilityLabel="Tự xếp giờ"
                    accessibilityHint="Mở chế độ sắp xếp với khung giờ gợi ý; chỉ lưu khi bạn bấm Lưu"
                    disabled={command.busy}
                    onPress={() => startEditing("times")}
                    style={({ pressed }) => [styles.arrange, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.arrangeText}>✨ Tự xếp</Text>
                  </Pressable>
                )}
                {canArrange && (
                  <Pressable
                    cssInterop={false}
                    accessibilityRole="button"
                    accessibilityLabel="Sắp xếp lịch trình"
                    disabled={command.busy}
                    onPress={() => startEditing()}
                    style={({ pressed }) => [styles.arrange, pressed && { opacity: 0.7 }]}
                  >
                    <DesignIcon name="edit" size={16} tintColor={colors.teal} />
                    <Text style={styles.arrangeText}>Sắp xếp</Text>
                  </Pressable>
                )}
                {plan.permissions.can_edit && (
                  <IconButton
                    icon="plus"
                    label="Thêm hoạt động"
                    onPress={() => router.push({ pathname: "/trip/[id]/activity", params: { id, day: activeDay } })}
                  />
                )}
              </>
            )}
          </View>
          {!editing && orderSaved && orderSaved.includes("Chưa lưu được") && <Feedback message={orderSaved} />}
          <Snackbar message={!editing && orderSaved && !orderSaved.includes("Chưa lưu được") ? orderSaved : undefined} />
          {editing ? (
            <>
              {draft.plan && !draft.plan.permissions.can_edit && (
                <Feedback inline message="Bạn chỉ có quyền xem. Người tổ chức quản lý quyền chỉnh sửa của nhóm." />
              )}
              {editor.activities.length ? (
                <ActivityOrderList
                  activities={editor.activities}
                  timezone={trip.timezone}
                  clearedTimeIds={editor.clearedTimeIds}
                  changedTimeIds={editor.changedTimeIds}
                  disabled={editor.locked}
                  onEditTime={(activity) => editor.setScheduleTarget(activity)}
                  onDragging={editor.onDragging}
                  onStatus={setDragStatus}
                  onChange={editor.reorderDay}
                />
              ) : (
                <EmptyState
                  title="Ngày này đang trống"
                  scene="greet"
                  message={`Chạm vào giờ của một hoạt động ở ngày khác để chuyển nó sang ${dayLabel}.`}
                  icon="calendar"
                />
              )}
              {editor.clearedTimeIds.size > 0 && (
                <Text accessibilityLiveRegion="polite" style={typography.footnote}>
                  Giờ gạch ngang sẽ bị bỏ khi lưu vì không còn đúng thứ tự ({editor.clearedTimeIds.size} hoạt động, vẫn giữ
                  ngày). Chạm vào giờ để đặt lại.
                </Text>
              )}
              {editor.timeError && <Feedback inline message={editor.timeError} />}
              {draft.error && <Feedback inline message={draft.error} />}
              {(draft.conflict || (draft.error && !draft.uncertain)) && (
                <Button
                  label="Bỏ bản nháp, tải bản mới"
                  variant="soft"
                  compact
                  disabled={editor.busy || draft.loading || editor.isDragging}
                  onPress={editor.reloadLatest}
                />
              )}
            </>
          ) : (
            <View>
              {activities.filter((activity) => activeDay === "unscheduled" || activity.starts_at).map((activity) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  timezone={trip.timezone}
                  onLongPress={canArrange && !command.busy ? () => startEditing() : undefined}
                  onPress={() => {
                    command.clearError();
                    setConfirmDelete(false);
                    setSelectedId(activity.id);
                  }}
                />
              ))}
              {activeDay !== "unscheduled" && activities.some((activity) => !activity.starts_at) && (
                <View style={styles.flexible}>
                  <View style={styles.flexibleHead}>
                    <Text style={[typography.headline, { flex: 1 }]}>Linh hoạt trong ngày</Text>
                    <Text style={typography.footnote}>chưa định giờ</Text>
                  </View>
                  {activities.filter((activity) => !activity.starts_at).map((activity) => (
                    <ActivityRow
                      key={activity.id}
                      activity={activity}
                      timezone={trip.timezone}
                      onLongPress={canArrange && !command.busy ? () => startEditing() : undefined}
                      onPress={() => {
                        command.clearError();
                        setConfirmDelete(false);
                        setSelectedId(activity.id);
                      }}
                    />
                  ))}
                  {canArrange && <Text style={typography.footnote}>Bấm “✨ Tự xếp” để gợi ý giờ theo thứ tự, thời gian di chuyển và nghỉ trưa.</Text>}
                </View>
              )}
              {!activities.length && (
                <EmptyState
                  title="Chừa chỗ cho điều thú vị"
                  scene="tripDone"
                  message={
                    activeDay === "unscheduled"
                      ? "Các hoạt động chưa chọn giờ sẽ xuất hiện ở đây."
                      : "Ngày này chưa có hoạt động. Cùng nhóm thêm một trải nghiệm nhé."
                  }
                  icon="calendar"
                />
              )}
            </View>
          )}
          {!editing && activities.length > 0 && <Text style={[typography.footnote, { textAlign: "center" }]}>Giờ theo múi giờ chuyến đi ({trip.timezone}).</Text>}
          {!plan.permissions.can_edit && !editing && (
            <Text style={typography.footnote}>
              Bạn có thể xem kế hoạch. Người tổ chức quản lý quyền chỉnh sửa của nhóm.
            </Text>
          )}
          {editing && editor.scheduleTarget && (
            <ActivityScheduleSheet
              key={editor.scheduleTarget.id}
              activity={editor.scheduleTarget}
              trip={trip}
              onApply={(value) => editor.applySchedule(editor.scheduleTarget!, value)}
              onClose={() => editor.setScheduleTarget(undefined)}
            />
          )}
          <Sheet
            dismissible={!command.busy}
            visible={!!selected}
            title={confirmDelete ? "Xóa hoạt động?" : (selected?.title ?? "Hoạt động")}
            onClose={() => {
              if (!command.busy) setSelectedId(undefined);
            }}
          >
            {selected && (
              <>
                <Text style={typography.footnote}>
                  {selected.starts_at
                    ? dateLabel(selected.starts_at, trip.timezone)
                    : selected.scheduled_date
                      ? `${calendarLabel(selected.scheduled_date)} · Trong ngày, chưa định giờ`
                      : "Chưa xếp lịch"}
                </Text>
                <View style={ui.card}>
                  <Text style={typography.headline}>
                    {selected.starts_at
                      ? timeLabel(selected.starts_at, trip.timezone)
                      : selected.scheduled_date
                        ? "Chưa định giờ"
                        : "Chưa xếp"}
                    {selected.ends_at ? ` – ${timeLabel(selected.ends_at, trip.timezone)}` : ""}
                  </Text>
                  <Text style={typography.body}>{selected.description || "Chưa có ghi chú cho hoạt động này."}</Text>
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
                    <Text style={typography.body}>Hoạt động sẽ được gỡ khỏi lịch trình của cả nhóm.</Text>
                    <Button
                      label="Xác nhận xóa hoạt động"
                      variant="destructive"
                      loading={command.busy}
                      onPress={() => {
                        void remove(selected);
                      }}
                    />
                    <Button label="Giữ lại" variant="soft" disabled={command.busy} onPress={() => setConfirmDelete(false)} />
                  </>
                ) : (
                  <>
                    {plan.permissions.can_complete && (
                      <Button
                        label={selected.status === "COMPLETED" ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"}
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
                            router.push({ pathname: "/trip/[id]/activity", params: { id, activityId: selected.id } });
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

const styles = StyleSheet.create({
  toolbar: { justifyContent: "space-between", gap: 10, minHeight: 48 },
  arrange: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  arrangeText: { color: colors.teal, fontFamily: fonts.bold, fontSize: 14 },
  helpers: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  helper: { minHeight: 40, justifyContent: "center", paddingHorizontal: 14, borderRadius: radii.pill, backgroundColor: colors.surface },
  helperText: { color: colors.teal, fontFamily: fonts.bold, fontSize: 13 },
  flexible: { marginTop: 10, padding: 12, gap: 2, borderRadius: radii.card, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.line, backgroundColor: "rgba(255,255,255,0.45)" },
  flexibleHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 },
  editBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.tealSoft,
  },
  editIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  status: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: colors.surface },
  statusDirty: { backgroundColor: colors.lilac },
  statusText: { color: colors.teal, fontSize: 12, fontFamily: fonts.bold },
  statusDirtyText: { color: colors.violet },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1 },
  cancel: { minWidth: 96 },
});
