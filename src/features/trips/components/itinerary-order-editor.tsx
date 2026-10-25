import { randomUUID } from "expo-crypto";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState, Text } from "react-native";

import { useApi } from "@/shared/api/use-api";
import { typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { ResourceFeedback } from "@/shared/ui/journal";
import { Sheet } from "@/shared/ui/sheet";
import { createOrderSession } from "../order-session";
import { dateKey } from "../utils";
import { ActivityOrderList } from "./activity-order-list";

export function ItineraryOrderEditor({
  tripId,
  day,
  timezone,
  onClose,
  onSaved,
}: {
  tripId: string;
  day: string;
  timezone: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useApi();
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
  const [discard, setDiscard] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
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
  const activities = state.ids.flatMap((id) => {
    const activity = state.plan?.activities.find((item) => item.id === id);
    if (!activity) return [];
    return (
      day === "unscheduled"
        ? !activity.starts_at
        : !!activity.starts_at && dateKey(activity.starts_at, timezone) === day
    )
      ? [activity]
      : [];
  });
  const locked =
    state.busy ||
    state.loading ||
    state.conflict ||
    state.uncertain ||
    !state.plan?.permissions.can_edit;
  const close = () => {
    if (!state.busy && !dragging.current) {
      if (session.dirty() || state.uncertain) setDiscard(true);
      else onClose();
    }
  };
  return (
    <Sheet
      visible
      title={discard ? "Đóng bản sắp xếp?" : "Sắp xếp lịch trình"}
      dismissible={!state.busy && !isDragging}
      allowSwipeDismissal={!isDragging && !session.dirty() && !state.uncertain}
      onClose={close}
      scrollable={false}
    >
      {discard ? (
        <>
          <Text style={typography.body}>
            {state.uncertain
              ? "Yêu cầu lưu có thể đã tới máy chủ. Khi mở lại, app sẽ tải trạng thái mới nhất; hãy kiểm tra trước khi sửa tiếp."
              : "Những thay đổi chưa lưu sẽ bị bỏ. Kế hoạch của nhóm không thay đổi."}
          </Text>
          <Button label="Tiếp tục sắp xếp" onPress={() => setDiscard(false)} />
          <Button
            label="Đóng bản nháp"
            variant="destructive"
            onPress={onClose}
          />
        </>
      ) : (
        <>
          <Text style={typography.footnote}>
            Nhấn giữ tay nắm ☰ rồi kéo, hoặc dùng ▲ ▼. Chỉ đổi thứ tự trong{" "}
            {day === "unscheduled"
              ? "mục Chưa xếp lịch"
              : `ngày ${day.slice(8)}/${day.slice(5, 7)}`}
            , không đổi giờ. Bấm lưu để áp dụng cho cả nhóm.
          </Text>
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
              <Text style={typography.footnote}>
                Phiên bản {state.plan.plan_version} ·{" "}
                {session.dirty() ? "Có thay đổi chưa lưu" : "Đã đồng bộ"}
              </Text>
              {!state.plan.permissions.can_edit && (
                <Feedback message="Bạn chỉ có quyền xem. Người tổ chức quản lý quyền chỉnh sửa của nhóm." />
              )}
              <ActivityOrderList
                activities={activities}
                timezone={timezone}
                disabled={locked}
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
              {state.error && <Feedback message={state.error} />}
              {(state.conflict || (state.error && !state.uncertain)) && (
                <Button
                  label="Bỏ bản nháp, tải bản mới"
                  variant="soft"
                  compact
                  disabled={state.busy || state.loading || isDragging}
                  onPress={() => {
                    void session.reload(true);
                  }}
                />
              )}
              <Button
                label={state.uncertain ? "Thử lưu lại" : "Lưu thứ tự cho nhóm"}
                loading={state.busy}
                disabled={
                  isDragging ||
                  state.loading ||
                  state.conflict ||
                  !state.plan.permissions.can_edit ||
                  !session.dirty()
                }
                onPress={() => {
                  if (dragging.current) return;
                  void session.save().then((saved) => {
                    if (saved) onSaved();
                  });
                }}
              />
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
