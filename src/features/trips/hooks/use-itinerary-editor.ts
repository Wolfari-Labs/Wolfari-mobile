import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState, BackHandler } from "react-native";

import { useApi } from "@/shared/api/use-api";
import { randomUUID } from "@/shared/operations/operation-id";
import { createOrderSession } from "../order-session";
import type { Activity, Plan, Trip } from "../types";
import { sortedActivities } from "../utils";
import { conflictingOrderTimes } from "../model/order-times";
import { pathKm, planDay, shortestOrder } from "../model/auto-schedule";
import type { LatLng } from "../model/place";
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

/**
 * Edit mode of the itinerary screen: a local, versioned draft of the whole plan order
 * plus staged day/time changes. Nothing reaches the group until `save`.
 */
export function useItineraryEditor({
  tripId,
  trip,
  plan,
  active,
  day,
  onDay,
  onExit,
}: {
  /** Route id: known before the trip loads, so the session never targets an empty id. */
  tripId: string;
  trip?: Trip;
  plan?: Plan;
  active: boolean;
  day: string;
  onDay: (day: string) => void;
  /** Leaves edit mode; `saved` carries the confirmation to show on the timeline. */
  onExit: (saved?: string) => void | Promise<void>;
}) {
  const api = useApi();
  // The route id and API client are fixed for the lifetime of this screen.
  const [session] = useState(() =>
    createOrderSession({
      load: (signal) => api.trips.plan(tripId, signal),
      save: (ids, version, key) => api.trips.reorder(tripId, ids, version, key),
      newKey: randomUUID,
    }),
  );
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
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

  /**
   * Enter edit mode from the plan already on screen (no loading flash); the
   * background read right after confirms it. Polling only runs while editing.
   */
  function start() {
    setDrafts({});
    setDiscard(false);
    setTimeError(undefined);
    setScheduleTarget(undefined);
    if (plan) session.reset(plan);
  }
  useEffect(() => {
    if (!active) return;
    void session.reload();
    const poll = () => {
      if (!dragging.current && (AppState.currentState === "active" || AppState.currentState === null))
        void session.reload();
    };
    const timer = setInterval(poll, 15_000);
    const listener = AppState.addEventListener("change", (status) => {
      if (status === "active") poll();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
      session.cancelRead();
    };
  }, [active, session]);

  function close() {
    if (busy || dragging.current) return;
    if (dirty || state.uncertain) setDiscard(true);
    else void onExit();
  }
  const latestClose = useRef(close);
  useEffect(() => {
    latestClose.current = close;
  });
  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      latestClose.current();
      return true;
    });
    return () => subscription.remove();
  }, [active]);

  const timezone = trip?.timezone ?? "UTC";
  const shownOf = (activity: Activity, map = drafts) => withDraft(activity, map[activity.id]);
  const ordered = state.ids.flatMap((id) => {
    const activity = state.plan?.activities.find((item) => item.id === id);
    return activity ? [activity] : [];
  });
  const activities = ordered
    .map((activity) => shownOf(activity))
    .filter((activity) => scheduleDay(activity, timezone) === day);
  // Staged days and times count as the schedule the group will see after saving.
  const clearedTimeIds = new Set(
    conflictingOrderTimes(
      sortedActivities(state.plan?.activities ?? []).map((item) => {
        const shown = shownOf(item);
        const itemDay = scheduleDay(shown, timezone);
        return { id: item.id, day: itemDay === UNSCHEDULED ? null : itemDay, starts_at: shown.starts_at };
      }),
      state.ids,
    ),
  );
  const locked = busy || state.loading || state.conflict || state.uncertain || !state.plan?.permissions.can_edit;

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
    const before = scheduleDay(shownOf(original), timezone);
    const target = scheduleDay(shownOf(original, next), timezone);
    // Re-slot when the day changes or a time is set; a same-day, untimed edit keeps its place.
    if (before !== target || draft.kind === "timed") {
      const dayItems = ordered
        .map((item) => shownOf(item, next))
        .filter((item) => scheduleDay(item, timezone) === target);
      const ids = dayItems.map((item) => item.id);
      const placed = placeInDay(dayItems, original.id);
      if (placed.join() !== ids.join()) session.reorder(ids, placed);
    }
    if (before !== target) onDay(target);
    return undefined;
  }

  /**
   * Fills the active day with time slots in its current order (or first in the shortest
   * route order). Only staged as drafts: nothing reaches the group until Save.
   * Returns a sentence for the confirmation toast, or an error sentence.
   */
  function autoArrange(kind: "times" | "route"): { ok: boolean; message: string } {
    if (!state.plan || !trip) return { ok: false, message: "Kế hoạch đang tải, thử lại sau giây lát." };
    if (locked) return { ok: false, message: "Chưa xếp được lúc này: kế hoạch đang tải hoặc vừa thay đổi." };
    if (day === UNSCHEDULED) return { ok: false, message: "Chọn một ngày trước khi tự xếp giờ." };
    const places = new Map<string, LatLng>();
    for (const item of state.plan.selected_locations) {
      const latitude = Number(item.latitude), longitude = Number(item.longitude);
      if (item.latitude !== null && item.longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude)) places.set(item.id, { latitude, longitude });
    }
    const placeOf = (id: string | null) => (id ? places.get(id) : undefined);
    let dayItems = activities;
    if (dayItems.length < 1) return { ok: false, message: "Ngày này chưa có hoạt động." };
    let saved = 0;
    if (kind === "route") {
      const next = shortestOrder(dayItems, placeOf);
      saved = pathKm(dayItems, placeOf) - pathKm(next, placeOf);
      if (next.some((item, index) => item.id !== dayItems[index].id)) session.reorder(dayItems.map((item) => item.id), next.map((item) => item.id));
      dayItems = next;
    }
    const result = planDay({ day, timezone, activities: dayItems, placeOf });
    const next = { ...drafts };
    for (const slot of result.slots) {
      const original = state.plan.activities.find((item) => item.id === slot.id);
      if (!original) continue;
      const draft: ScheduleDraft = { kind: "timed", starts_at: slot.starts_at, ends_at: slot.ends_at };
      if (sameSchedule(original, draft)) delete next[slot.id];
      else next[slot.id] = draft;
    }
    for (const id of result.overflow) {
      const original = state.plan.activities.find((item) => item.id === id);
      if (!original) continue;
      const draft: ScheduleDraft = { kind: "day", date: day };
      if (sameSchedule(original, draft)) delete next[id];
      else next[id] = draft;
    }
    setDrafts(next);
    setTimeError(undefined);
    const parts = [
      kind === "route" ? (saved >= 0.3 ? `Lộ trình ngắn hơn khoảng ${saved.toFixed(1).replace(".", ",")} km.` : "Thứ tự hiện tại đã gần như ngắn nhất.") : "",
      `Đã xếp giờ ${result.slots.length} hoạt động.`,
      result.lunch ? `Chừa nghỉ trưa ${result.lunch.starts}–${result.lunch.ends}.` : "",
      result.overflow.length ? `${result.overflow.length} hoạt động quá 22:00 nên để chưa định giờ.` : "",
      "Kiểm tra rồi bấm Lưu.",
    ];
    return { ok: true, message: parts.filter(Boolean).join(" ") };
  }

  /**
   * Schedules first, then order: the server drops times that run backwards using the
   * stored values, so saving the order before the new times would wipe neighbours.
   */
  async function saveWithSchedules() {
    const current = state.plan;
    if (!current) return;
    setTimeBusy(true);
    let version = current.plan_version;
    let step = "lịch mới";
    try {
      for (const [id, draft] of Object.entries(drafts)) {
        const activity = current.activities.find((item) => item.id === id);
        if (!activity) continue;
        // A staged time that ends up out of order keeps only its (possibly new) day.
        const target = clearedTimeIds.has(id) ? withoutTime(draft, timezone) : draft;
        version = (await api.trips.saveActivity(tripId, id, scheduleInput(activity, target, version), randomUUID())).plan_version;
      }
      step = "thứ tự";
      if (session.dirty()) version = (await api.trips.reorder(tripId, state.ids, version, randomUUID())).plan_version;
      step = "giờ bị lệch";
      if (clearedTimeIds.size) {
        // The order write clears these itself; this only catches anything still timed.
        const latest = await api.trips.plan(tripId);
        version = latest.plan_version;
        for (const id of clearedTimeIds) {
          const activity = latest.activities.find((item) => item.id === id);
          if (!activity?.starts_at) continue;
          version = (
            await api.trips.saveActivity(
              tripId,
              id,
              scheduleInput(activity, { kind: "day", date: scheduleDay(activity, timezone) }, version),
              randomUUID(),
            )
          ).plan_version;
        }
      }
      setDrafts({});
      await onExit("Đã lưu thứ tự và lịch mới cho cả nhóm.");
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
    if (await session.save()) {
      setTimeBusy(true);
      try {
        await onExit("Đã lưu thứ tự cho cả nhóm. Các giờ bị lệch thứ tự đã được bỏ, vẫn giữ nguyên ngày.");
      } finally {
        setTimeBusy(false);
      }
    }
  }

  return {
    start,
    autoArrange,
    state,
    activities,
    clearedTimeIds,
    changedTimeIds: new Set(Object.keys(drafts)),
    dirty,
    busy,
    locked,
    isDragging,
    discard,
    timeError,
    scheduleTarget,
    setScheduleTarget,
    applySchedule,
    close,
    save,
    keepEditing: () => setDiscard(false),
    discardDraft: () => {
      setDiscard(false);
      setDrafts({});
      void onExit();
    },
    reloadLatest: () => {
      setDrafts({});
      void session.reload(true);
    },
    onDragging: (value: boolean) => {
      dragging.current = value;
      setIsDragging(value);
      if (value) session.cancelRead();
    },
    reorderDay: (ids: string[]) =>
      session.reorder(
        activities.map((item) => item.id),
        ids,
      ),
  };
}
