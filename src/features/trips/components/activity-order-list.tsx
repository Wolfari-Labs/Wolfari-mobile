import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PropsWithChildren } from "react";
import { useIsFocused } from "expo-router";
import {
  AccessibilityInfo,
  AppState,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { colors } from "@/shared/theme/tokens";
import { useKeyboardScroll } from "@/shared/ui/keyboard-scroll";
import type { Activity } from "../types";
import { moveItem } from "../order-session";
import { activityTimeLabel } from "../utils";
import { ActivityCardBody, ActivityTime, activityCard } from "./activity-row";
import { ActivityDragHandle, ActivityHoldArea } from "./activity-drag-handle";
import {
  dragPosition,
  dragScrollOffset,
  orderFrames,
  settleOffset,
  shiftFor,
  ORDER_LIST_PADDING,
  ORDER_ROW_GAP,
  type OrderFrame,
} from "../model/order-drag";

export type DragStatus = { position: number; total: number } | undefined;

type Props = {
  activities: Activity[];
  timezone: string;
  clearedTimeIds: ReadonlySet<string>;
  changedTimeIds?: ReadonlySet<string>;
  onEditTime?: (activity: Activity) => void;
  disabled: boolean;
  onChange: (ids: string[]) => void;
  onDragging: (dragging: boolean) => void;
  /** Live drop position while dragging, for the screen's status line. */
  onStatus?: (status: DragStatus) => void;
};

const SHIFT_MS = 170;
const SETTLE_MS = 150;

function OrderRow({
  id,
  index,
  activeIndex,
  targetIndex,
  shiftSize,
  translation,
  lifted,
  onLayout,
  children,
}: PropsWithChildren<{
  id: string;
  index: number;
  activeIndex: SharedValue<number>;
  targetIndex: SharedValue<number>;
  shiftSize: SharedValue<number>;
  translation: SharedValue<number>;
  lifted: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
}>) {
  const reduceMotion = useReducedMotion();
  // Every row keeps one animated style and is explicitly reset when no drag is active.
  // Removing a Reanimated style does not undo its last native transform.
  const animatedStyle = useAnimatedStyle(() => {
    const from = activeIndex.get();
    if (from < 0) return { transform: [{ translateY: 0 }, { scale: 1 }] };
    if (index === from) {
      return { transform: [{ translateY: translation.get() }, { scale: withTiming(1.02, { duration: reduceMotion ? 0 : 120 }) }] };
    }
    const shift = shiftFor(index, from, targetIndex.get(), shiftSize.get());
    return { transform: [{ translateY: withTiming(shift, { duration: reduceMotion ? 0 : SHIFT_MS }) }, { scale: 1 }] };
  });
  return (
    <Animated.View
      testID={`order-row-${id}`}
      onLayout={onLayout}
      style={[activityCard, styles.row, lifted && styles.lifted, animatedStyle]}
    >
      {children}
    </Animated.View>
  );
}

export function ActivityOrderList({
  activities,
  timezone,
  clearedTimeIds,
  changedTimeIds,
  onEditTime,
  disabled,
  onChange,
  onDragging,
  onStatus,
}: Props) {
  const { height, width, fontScale } = useWindowDimensions();
  const focused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const page = useKeyboardScroll();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const frames = useRef(new Map<string, OrderFrame>());
  const viewportTop = useRef(0);
  const drag = useRef<{
    id: string;
    from: number;
    to: number;
    startOffset: number;
    dy: number;
    pageY: number;
    items: Activity[];
    frames: Map<string, OrderFrame>;
    settling?: boolean;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingReset = useRef(false);
  const [activeId, setActiveId] = useState<string>();
  const [measuredIds, setMeasuredIds] = useState<string[]>([]);
  const activeIndex = useSharedValue(-1);
  const targetIndex = useSharedValue(-1);
  const shiftSize = useSharedValue(0);
  const translation = useSharedValue(0);
  const locked = disabled || !foreground || !focused;
  const callbacks = useRef({ onChange, onDragging, onStatus });
  useEffect(() => {
    callbacks.current = { onChange, onDragging, onStatus };
  }, [onChange, onDragging, onStatus]);

  const resetMotion = useCallback(() => {
    pendingReset.current = false;
    activeIndex.set(-1);
    targetIndex.set(-1);
    translation.set(0);
  }, [activeIndex, targetIndex, translation]);

  /** Ends a drag. A commit glides the card into its slot first, then applies the order. */
  const finish = useCallback(
    (commit: boolean) => {
      const current = drag.current;
      if (!current || current.settling) return;
      clearInterval(timer.current);
      const moved = commit && current.to !== current.from;
      const done = () => {
        drag.current = null;
        setActiveId(undefined);
        callbacks.current.onStatus?.(undefined);
        callbacks.current.onDragging(false);
        if (moved) {
          // Keep the shifted layout until the reordered rows render, so nothing flickers.
          pendingReset.current = true;
          callbacks.current.onChange(moveItem(current.items, current.from, current.to).map((item) => item.id));
          AccessibilityInfo.announceForAccessibility(
            `Đã chuyển ${current.items[current.from].title} tới vị trí ${current.to + 1}. Chưa lưu cho nhóm.`,
          );
          setTimeout(() => {
            if (pendingReset.current) resetMotion();
          }, 120);
        } else resetMotion();
      };
      if (!commit) {
        done();
        return;
      }
      current.settling = true;
      const ids = current.items.map((item) => item.id);
      const target = moved ? settleOffset(ids, current.frames, current.from, current.to) : 0;
      const duration = reduceMotion ? 0 : SETTLE_MS;
      translation.set(withTiming(target, { duration }));
      if (!duration) done();
      else settle.current = setTimeout(done, duration);
    },
    [reduceMotion, resetMotion, translation],
  );
  const itemKey = activities.map((item) => item.id).join(",");
  useLayoutEffect(() => {
    if (pendingReset.current) resetMotion();
  }, [itemKey, resetMotion]);
  const cancel = useCallback(() => {
    const current = drag.current;
    if (!current) return;
    clearTimeout(settle.current);
    current.settling = false;
    finish(false);
  }, [finish]);
  useEffect(() => {
    if (locked) cancel();
  }, [locked, cancel]);
  useEffect(() => {
    cancel();
  }, [height, width, fontScale, itemKey, cancel]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") cancel();
      setForeground(state === "active");
    });
    return () => subscription.remove();
  }, [cancel]);
  useEffect(
    () => () => {
      clearInterval(timer.current);
      clearTimeout(settle.current);
      callbacks.current.onDragging(false);
    },
    [],
  );

  const offset = () => page?.metrics.current.offset ?? 0;
  function update() {
    const current = drag.current;
    if (!current || current.settling) return;
    const delta = current.dy + offset() - current.startOffset;
    const position = dragPosition(current.items.map((item) => item.id), current.frames, current.id, delta);
    if (!position) return;
    if (current.to !== position.index) {
      current.to = position.index;
      targetIndex.set(position.index);
      callbacks.current.onStatus?.({ position: position.index + 1, total: current.items.length });
    }
    translation.set(position.translation);
  }
  function begin(id: string, pageY: number) {
    if (locked || drag.current || AppState.currentState !== "active") return false;
    const from = activities.findIndex((item) => item.id === id);
    // A keyed row can move without another layout event on web. Rebuild
    // positions from the current order and measured heights before EVERY drag.
    const orderedFrames = orderFrames(activities.map((item) => item.id), frames.current);
    if (from < 0 || !orderedFrames) return false;
    const scroll = page?.scrollRef.current as { measureInWindow?: (cb: (x: number, y: number) => void) => void } | null;
    scroll?.measureInWindow?.((_x, y) => {
      viewportTop.current = y;
    });
    drag.current = {
      id,
      from,
      to: from,
      startOffset: offset(),
      dy: 0,
      pageY,
      items: [...activities],
      frames: orderedFrames,
    };
    shiftSize.set((orderedFrames.get(id)?.height ?? 0) + ORDER_ROW_GAP);
    targetIndex.set(from);
    translation.set(0);
    activeIndex.set(from);
    setActiveId(id);
    callbacks.current.onStatus?.({ position: from + 1, total: activities.length });
    callbacks.current.onDragging(true);
    timer.current = setInterval(() => {
      const current = drag.current;
      const metrics = page?.metrics.current;
      if (!current || current.settling || !metrics?.viewportHeight || Math.abs(current.dy) < 3) return;
      const local = current.pageY - viewportTop.current;
      const next = dragScrollOffset(metrics.offset, local, metrics.viewportHeight, metrics.contentHeight, metrics.bottomInset);
      if (next !== metrics.offset) {
        metrics.offset = next;
        page?.scrollRef.current?.scrollTo({ y: next, animated: false });
        update();
      }
    }, 32);
    return true;
  }
  function step(index: number, direction: -1 | 1) {
    if (locked || drag.current) return;
    onChange(moveItem(activities, index, index + direction).map((item) => item.id));
    AccessibilityInfo.announceForAccessibility(
      `Đã chuyển ${activities[index].title} tới vị trí ${index + direction + 1}. Chưa lưu cho nhóm.`,
    );
  }

  const ready = activities.every((item) => measuredIds.includes(item.id));
  return (
    <View testID="activity-order-list" style={styles.list}>
      {activities.map((activity, index) => {
        const lifted = activeId === activity.id;
        const otherActive = !!activeId && !lifted;
        const cleared = clearedTimeIds.has(activity.id);
        const changed = changedTimeIds?.has(activity.id);
        const timeLabel = activityTimeLabel(activity, timezone);
        const dragProps = {
          disabled: locked || otherActive || !ready,
          onBegin: (pageY: number) => begin(activity.id, pageY),
          onMove: (dy: number, pageY: number) => {
            if (drag.current && !drag.current.settling) {
              drag.current.dy = dy;
              drag.current.pageY = pageY;
              update();
            }
          },
          onEnd: finish,
        };
        const time = <ActivityTime label={timeLabel} tone={cleared ? "cleared" : changed ? "changed" : "default"} />;
        return (
          <OrderRow
            key={activity.id}
            id={activity.id}
            index={index}
            activeIndex={activeIndex}
            targetIndex={targetIndex}
            shiftSize={shiftSize}
            translation={translation}
            lifted={lifted}
            onLayout={(event) => {
              const previous = frames.current.get(activity.id);
              if (drag.current && previous && previous.height !== event.nativeEvent.layout.height) cancel();
              frames.current.set(activity.id, event.nativeEvent.layout);
              setMeasuredIds((ids) => (ids.includes(activity.id) ? ids : [...ids, activity.id]));
            }}
          >
            <ActivityHoldArea {...dragProps}>
              <ActivityCardBody
                activity={activity}
                time={
                  onEditTime ? (
                    <Pressable
                      cssInterop={false}
                      accessibilityRole="button"
                      accessibilityLabel={`Đổi lịch ${activity.title}, ${timeLabel}${cleared ? ", giờ sẽ bị bỏ khi lưu" : ""}`}
                      disabled={locked || !!activeId}
                      accessibilityState={{ disabled: locked || !!activeId }}
                      hitSlop={6}
                      onPress={() => onEditTime(activity)}
                      style={({ pressed }) => [styles.timeButton, pressed && { opacity: 0.6 }]}
                    >
                      {time}
                      <View style={styles.editDot} />
                    </Pressable>
                  ) : (
                    time
                  )
                }
              />
            </ActivityHoldArea>
            <ActivityDragHandle
              label={activity.title}
              active={lifted}
              canMoveUp={index > 0}
              canMoveDown={index < activities.length - 1}
              onStep={(direction) => step(index, direction)}
              {...dragProps}
            />
          </OrderRow>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: ORDER_ROW_GAP, padding: ORDER_LIST_PADDING, marginVertical: 6 },
  row: { paddingRight: 4, gap: 4 },
  lifted: {
    zIndex: 10,
    elevation: 10,
    boxShadow: "0 14px 28px rgba(23,63,99,0.22)",
  },
  timeButton: { position: "relative" },
  editDot: {
    position: "absolute",
    right: -2,
    top: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.teal,
  },
});
