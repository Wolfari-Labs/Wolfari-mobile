import { randomUUID } from "@/shared/operations/operation-id";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState, BackHandler, StyleSheet, Text, View } from "react-native";

import { useApi } from "@/shared/api/use-api";
import { colors, fonts, radii, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { DesignIcon } from "@/shared/ui/design-icon";
import { Feedback } from "@/shared/ui/feedback";
import { ResourceFeedback, Segments } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { createOrderSession } from "../order-session";
import type { Activity, Trip } from "../types";
import { sortedActivities, tripDays } from "../utils";
import { conflictingOrderTimes } from "../model/order-times";
import {
  placeInDay,
  sameSchedule,
  scheduleDay,
  scheduleInput,
  withDraft,
  withoutTime,
  UNSCHEDULED,
  type ScheduleDraft,
} from "../model/schedule-draft";
import { ActivityOrderList } from "./activity-order-list";
import { ActivityScheduleSheet } from "./activity-schedule-sheet";

export function ItineraryOrderEditor({
  trip,
  initialDay,
  onClose,
  onSaved,
}: {
  trip: Trip;
  initialDay: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const api = useApi();
  const tripId = trip.id;
  const [session] = useState(() =>
    createOrderSession({
      load: (signal) => api.trips.plan(tripId, signal),
      save: (ids, version, key) => api.trips.reorder(tripId, ids, version, key),
      newKey: randomUUID,
    }),
  );
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const [day, setDay] = useState(initialDay);
  const [discard, setDiscard] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, ScheduleDraft>>({});
  const [scheduleTarget, setScheduleTarget] = useState<Activity>();
  const [timeBusy, setTimeBusy] = useState(false);
  const [timeError, setTimeError] = useState<string>();
  const dragging = useRef(false);
  const draftCount = Object.keys(drafts).length;
  const dirty = session.dirty() || draftCount > 0;
  const busy = state.busy || timeBusy;
  useEffect(() => {
    void session.reload();
    const poll = () => {
      if (
        !dragging.current &&
        (AppState.currentState === "active" || AppState.currentState === null)
      )
        void session.reload();
    };
    const timer = setInterval(poll, 15_000);
    const listener = AppState.addEventListener("change", (status) => {
      if (status === "active") poll();
    });
    // Requests are read-only during polling; stale results are ignored by the session.
    return () => {
      clearInterval(timer);
      listener.remove();
      session.cancelRead();
    };
  }, [session]);
  const close = () => {
    if (busy || dragging.current) return;
    if (dirty || state.uncertain) setDiscard(true);
    else onClose();
  };
  const latestClose = useRef(close);
  useEffect(() => {
    latestClose.current = close;
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      latestClose.current();
      return true;
    });
    return () => subscription.remove();
  }, []);

  const days = tripDays(trip);
  const shownOf = (activity: Activity, map = drafts) => withDraft(activity, map[activity.id]);
  const ordered = state.ids.flatMap((id) => {
    const activity = state.plan?.activities.find((item) => item.id === id);
    return activity ? [activity] : [];
  });
  const activities = ordered
    .map((activity) => shownOf(activity))
    .filter((activity) => scheduleDay(activity, trip.timezone) === day);
  // Staged days and times count as the schedule the group will see after saving.
  const clearedTimeIds = new Set(
    conflictingOrderTimes(
      sortedActivities(state.plan?.activities ?? []).map((item) => {
        const shown = shownOf(item);
        const itemDay = scheduleDay(shown, trip.timezone);
        return { id: item.id, day: itemDay === UNSCHEDULED ? null : itemDay, starts_at: shown.starts_at };
      }),
      state.ids,
    ),
  );
  const locked =
    busy ||
    state.loading ||
    state.conflict ||
    state.uncertain ||
    !state.plan?.permissions.can_edit;

  /** Stages a schedule; returns a message when it cannot be applied right now. */
  function applySchedule(activity: Activity, draft: ScheduleDraft): string | undefined {
    const original = state.plan?.activities.find((item) => item.id === activity.id);
    if (!original) return "Hoạt động không còn trong kế hoạch. Hãy tải bản mới.";
    if (locked) return "Chưa đổi được lịch lúc này: kế hoạch đang tải hoặc vừa thay đổi. Hãy tải bản mới rồi thử lại.";
    const next = { ...drafts };
    if (sameSchedule(original, draft)) delete next[original.id];
    else next[original.id] = draft;
    setDrafts(next);
    setTimeError(undefined);
    const before = scheduleDay(shownOf(original), trip.timezone);
    const target = scheduleDay(shownOf(original, next), trip.timezone);
    // Re-slot when the day changes or a time is set; a same-day, untimed edit keeps its place.
    if (before !== target || draft.kind === "timed") {
      const dayItems = ordered
        .map((item) => shownOf(item, next))
        .filter((item) => scheduleDay(item, trip.timezone) === target);
      const ids = dayItems.map((item) => item.id);
      const placed = placeInDay(dayItems, original.id);
      if (placed.join() !== ids.join()) session.reorder(ids, placed);
    }
    if (before !== target) setDay(target);
    return undefined;
  }

  /**
   * Schedules first, then order: the server drops times that run backwards using the
   * stored values, so saving the order before the new times would wipe neighbours.
   */
  async function saveWithSchedules() {
    const plan = state.plan;
    if (!plan) return;
    setTimeBusy(true);
    let version = plan.plan_version;
    let step = "lịch mới";
    try {
      for (const [id, draft] of Object.entries(drafts)) {
        const activity = plan.activities.find((item) => item.id === id);
        if (!activity) continue;
        // A staged time that ends up out of order keeps only its (possibly new) day.
        const target = clearedTimeIds.has(id) ? withoutTime(draft, trip.timezone) : draft;
        version = (await api.trips.saveActivity(tripId, id, scheduleInput(activity, target, version), randomUUID())).plan_version;
      }
      step = "thứ tự";
      if (session.dirty())
        version = (await api.trips.reorder(tripId, state.ids, version, randomUUID())).plan_version;
      step = "giờ bị lệch";
      if (clearedTimeIds.size) {
        // The order write clears these itself; this only catches anything still timed.
        const latest = await api.trips.plan(tripId);
        version = latest.plan_version;
        for (const id of clearedTimeIds) {
          const activity = latest.activities.find((item) => item.id === id);
          if (!activity?.starts_at) continue;
          version = (await api.trips.saveActivity(tripId, id, scheduleInput(activity, { kind: "day", date: scheduleDay(activity, trip.timezone) }, version), randomUUID())).plan_version;
        }
      }
      onSaved("Đã lưu thứ tự và lịch mới cho cả nhóm.");
    } catch (cause) {
      const status = (cause as { status?: number })?.status;
      setDrafts({});
      setTimeError(
        status === 409
          ? "Kế hoạch vừa được người khác cập nhật nên chưa lưu tiếp. Đã tải bản mới nhất; hãy kiểm tra rồi sắp xếp lại."
          : `Chưa lưu xong phần ${step}. Đã tải bản mới nhất của nhóm; hãy kiểm tra rồi thử lại.`,
      );
      void session.reload(true);
    } finally {
      setTimeBusy(false);
    }
  }

  async function save() {
    if (dragging.current || busy) return;
    setTimeError(undefined);
    if (draftCount) {
      await saveWithSchedules();
      return;
    }
    if (await session.save())
      onSaved("Đã lưu thứ tự cho cả nhóm. Các giờ bị lệch thứ tự đã được bỏ, vẫn giữ nguyên ngày.");
  }

  const dayLabel =
    day === "unscheduled" ? "mục Chưa xếp lịch" : `ngày ${day.slice(8)}/${day.slice(5, 7)}`;
  return (
    <Screen
      title={trip.name}
      onBack={close}
      scrollEnabled={!isDragging}
      footer={
        discard ? (
          <>
            <Text style={[typography.headline, { textAlign: "center" }]}>Đóng bản sắp xếp?</Text>
            <Text style={[typography.footnote, { textAlign: "center" }]}>
              {state.uncertain
                ? "Yêu cầu lưu có thể đã tới máy chủ. Khi mở lại, app sẽ tải trạng thái mới nhất; hãy kiểm tra trước khi sửa tiếp."
                : "Những thay đổi chưa lưu sẽ bị bỏ. Kế hoạch của nhóm không thay đổi."}
            </Text>
            <View style={styles.actions}>
              <Button label="Tiếp tục sắp xếp" variant="soft" compact style={styles.action} onPress={() => setDiscard(false)} />
              <Button label="Đóng bản nháp" variant="destructive" compact style={styles.action} onPress={onClose} />
            </View>
          </>
        ) : (
          <View style={styles.actions}>
            <Button label="Đóng" variant="soft" disabled={busy || isDragging} style={styles.cancel} onPress={close} />
            <Button
              label={state.uncertain ? "Thử lưu lại" : "Lưu thứ tự cho nhóm"}
              loading={busy}
              disabled={
                isDragging ||
                state.loading ||
                state.conflict ||
                !state.plan?.permissions.can_edit ||
                !dirty
              }
              style={styles.action}
              onPress={() => {
                void save();
              }}
            />
          </View>
        )
      }
    >
      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <DesignIcon name="edit" size={18} tintColor={colors.teal} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={typography.headline}>Đang sắp xếp {dayLabel}</Text>
          <Text style={typography.footnote}>
            Giữ ☰ để kéo hoặc dùng ▲ ▼. Chạm vào giờ để đổi ngày, giờ.
          </Text>
        </View>
        <View style={[styles.status, dirty && styles.statusDirty]}>
          <Text style={[styles.statusText, dirty && styles.statusDirtyText]}>
            {state.plan ? (dirty ? "Chưa lưu" : "Đã đồng bộ") : "Đang tải"}
          </Text>
        </View>
      </View>
      <Segments
        scroll
        items={[
          ...days.map((value, index) => ({
            value,
            label: `Ngày ${index + 1} · ${value.slice(8)}/${value.slice(5, 7)}`,
          })),
          { value: "unscheduled", label: "Chưa xếp lịch" },
        ]}
        value={day}
        onChange={(value) => {
          if (!dragging.current) setDay(value);
        }}
      />
      <ResourceFeedback
        loading={state.loading}
        hasData={!!state.plan}
        error={!state.plan ? state.error : undefined}
        onRetry={() => {
          void session.reload(true);
        }}
      />
      {state.plan && (
        <>
          {!state.plan.permissions.can_edit && (
            <Feedback message="Bạn chỉ có quyền xem. Người tổ chức quản lý quyền chỉnh sửa của nhóm." />
          )}
          {activities.length ? (
            <ActivityOrderList
              activities={activities}
              timezone={trip.timezone}
              clearedTimeIds={clearedTimeIds}
              changedTimeIds={new Set(Object.keys(drafts))}
              disabled={locked}
              onEditTime={(activity) => setScheduleTarget(activity)}
              onDragging={(value) => {
                dragging.current = value;
                setIsDragging(value);
                if (value) session.cancelRead();
              }}
              onChange={(ids) =>
                session.reorder(
                  activities.map((item) => item.id),
                  ids,
                )
              }
            />
          ) : (
            <Text style={typography.footnote}>Chưa có hoạt động trong {dayLabel}.</Text>
          )}
          {clearedTimeIds.size > 0 && (
            <Text accessibilityLiveRegion="polite" style={typography.footnote}>
              Khi lưu sẽ bỏ giờ bắt đầu và kết thúc của {clearedTimeIds.size}
              {" "}hoạt động bị lệch thứ tự (vẫn giữ ngày). Chạm vào giờ để đặt lại ngay.
            </Text>
          )}
          {timeError && <Feedback message={timeError} />}
          {state.error && <Feedback message={state.error} />}
          {(state.conflict || (state.error && !state.uncertain)) && (
            <Button
              label="Bỏ bản nháp, tải bản mới"
              variant="soft"
              compact
              disabled={busy || state.loading || isDragging}
              onPress={() => {
                setDrafts({});
                void session.reload(true);
              }}
            />
          )}
        </>
      )}
      {scheduleTarget && (
        <ActivityScheduleSheet
          key={scheduleTarget.id}
          activity={scheduleTarget}
          trip={trip}
          onApply={(draft) => applySchedule(scheduleTarget, draft)}
          onClose={() => setScheduleTarget(undefined)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1 },
  cancel: { minWidth: 96 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radii.card,
    backgroundColor: colors.tealSoft,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  status: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: colors.surface },
  statusDirty: { backgroundColor: colors.lilac },
  statusText: { color: colors.teal, fontSize: 12, fontFamily: fonts.bold },
  statusDirtyText: { color: colors.violet },
});
