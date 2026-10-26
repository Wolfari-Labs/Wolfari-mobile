import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { useIsFocused } from "expo-router";
import {
  AccessibilityInfo,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";

import { colors, typography } from "@/shared/theme/tokens";
import type { Activity } from "../types";
import { moveItem } from "../order-session";
import { timeLabel } from "../utils";
import { ActivityDragHandle } from "./activity-drag-handle";
import { dragPosition, dragScrollOffset, orderFrames, ORDER_LIST_PADDING, ORDER_ROW_GAP, type OrderFrame } from "../model/order-drag";

type Props = {
  activities: Activity[];
  timezone: string;
  disabled: boolean;
  onChange: (ids: string[]) => void;
  onDragging: (dragging: boolean) => void;
};

function OrderRow({ id, active, target, translation, onLayout, children }: PropsWithChildren<{
  id: string;
  active: boolean;
  target: boolean;
  translation: SharedValue<number>;
  onLayout: (event: LayoutChangeEvent) => void;
}>) {
  // Keep an animated style attached to each row and explicitly reset inactive rows.
  // Removing a Reanimated style does not undo its last native transform.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: active ? translation.get() : 0 }],
  }));
  return (
    <Animated.View
      testID={`order-row-${id}`}
      onLayout={onLayout}
      style={[styles.row, target && styles.target, active && styles.dragging, animatedStyle]}
    >
      {children}
    </Animated.View>
  );
}

export function ActivityOrderList({
  activities,
  timezone,
  disabled,
  onChange,
  onDragging,
}: Props) {
  const { height, width, fontScale } = useWindowDimensions();
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const scroll = useRef<ScrollView>(null);
  const viewport = useRef<View>(null);
  const frames = useRef(new Map<string, OrderFrame>());
  const offset = useRef(0);
  const contentHeight = useRef(0);
  const bounds = useRef({ top: 0, height: 0 });
  const drag = useRef<{
    id: string;
    from: number;
    to: number;
    startOffset: number;
    dy: number;
    pageY: number;
    items: Activity[];
    frames: Map<string, OrderFrame>;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [activeId, setActiveId] = useState<string>();
  const [targetId, setTargetId] = useState<string>();
  const [measuredIds, setMeasuredIds] = useState<string[]>([]);
  const translation = useSharedValue(0);
  const locked = disabled || !foreground || !focused;
  const callbacks = useRef({ onChange, onDragging });
  useEffect(() => {
    callbacks.current = { onChange, onDragging };
  }, [onChange, onDragging]);

  const finish = useCallback(
    (commit: boolean) => {
      const current = drag.current;
      if (!current) return;
      drag.current = null;
      clearInterval(timer.current);
      setActiveId(undefined);
      setTargetId(undefined);
      translation.set(0);
      callbacks.current.onDragging(false);
      if (commit && current.to !== current.from) {
        const next = moveItem(current.items, current.from, current.to);
        callbacks.current.onChange(next.map((item) => item.id));
        AccessibilityInfo.announceForAccessibility(
          `Đã chuyển ${current.items[current.from].title} tới vị trí ${current.to + 1}. Chưa lưu cho nhóm.`,
        );
      }
    },
    [translation],
  );
  useEffect(() => {
    if (locked) finish(false);
  }, [locked, finish]);
  const itemKey = activities.map(item => item.id).join(",");
  useEffect(() => { finish(false); }, [height, width, fontScale, itemKey, finish]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      if (state !== "active") finish(false);
      setForeground(state === "active");
    });
    return () => subscription.remove();
  }, [finish]);
  useEffect(
    () => () => {
      clearInterval(timer.current);
      callbacks.current.onDragging(false);
    },
    [],
  );

  function update() {
    const current = drag.current;
    if (!current) return;
    const delta = current.dy + offset.current - current.startOffset;
    const position = dragPosition(current.items.map(item => item.id), current.frames, current.id, delta);
    if (!position) return;
    const nearest = position.index;
    if (current.to !== nearest) {
      current.to = nearest;
      setTargetId(current.items[nearest].id);
    }
    translation.set(position.translation);
  }
  function begin(id: string, pageY: number) {
    if (locked || drag.current || AppState.currentState !== "active") return false;
    const from = activities.findIndex((item) => item.id === id);
    const orderedFrames = orderFrames(activities.map(item => item.id), frames.current);
    if (from < 0 || !orderedFrames) return false;
    // A keyed row can move without another size/layout event on web. Rebuild
    // positions from the current order and measured heights before EVERY drag.
    bounds.current = { top: 0, height: 0 };
    viewport.current?.measureInWindow((_x, y, _width, h) => {
      bounds.current = { top: y, height: h };
    });
    drag.current = {
      id,
      from,
      to: from,
      startOffset: offset.current,
      dy: 0,
      pageY,
      items: [...activities],
      frames: orderedFrames,
    };
    setActiveId(id);
    setTargetId(id);
    callbacks.current.onDragging(true);
    timer.current = setInterval(() => {
      const current = drag.current;
      if (!current || !bounds.current.height || Math.abs(current.dy) < 3) return;
      const local = current.pageY - bounds.current.top;
      const next = dragScrollOffset(offset.current, local, bounds.current.height, contentHeight.current);
      if (next !== offset.current) {
        offset.current = next;
        scroll.current?.scrollTo({ y: next, animated: false });
        update();
      }
    }, 32);
    return true;
  }
  return (
    <>
    <Text accessibilityLiveRegion="polite" style={[typography.footnote, { minHeight: 36 * fontScale }]}>
      {activeId ? `Thả vào vị trí ${activities.findIndex(item => item.id === targetId) + 1} / ${activities.length} · Chưa lưu` : "Nhấn giữ ☰ rồi kéo · Vuốt phần tên để cuộn"}
    </Text>
    <View
      ref={viewport}
      testID="activity-order-list"
      style={{ maxHeight: Math.max(150, height * 0.37), flexShrink: 1 }}
    >
      <ScrollView
        ref={scroll}
        scrollEnabled={!activeId}
        bounces={false}
        overScrollMode="never"
        scrollEventThrottle={16}
        onScroll={(event) => {
          offset.current = event.nativeEvent.contentOffset.y;
        }}
        onContentSizeChange={(_width, h) => {
          contentHeight.current = h;
        }}
        contentContainerStyle={styles.list}
      >
        {activities.map((activity, index) => (
          <OrderRow
            key={activity.id}
            id={activity.id}
            active={activeId === activity.id}
            target={targetId === activity.id && activeId !== activity.id}
            translation={translation}
            onLayout={(event) => {
              const previous = frames.current.get(activity.id);
              if (drag.current && previous && previous.height !== event.nativeEvent.layout.height) finish(false);
              frames.current.set(activity.id, event.nativeEvent.layout);
              setMeasuredIds((ids) =>
                ids.includes(activity.id) ? ids : [...ids, activity.id],
              );
            }}
          >
            <View style={styles.copy}>
              <Text style={styles.time}>
                {index + 1} · {timeLabel(activity.starts_at, timezone)}
              </Text>
              <Text style={typography.headline}>{activity.title}</Text>
            </View>
            <View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Đưa ${activity.title} lên`}
                disabled={locked || !!activeId || index === 0}
                accessibilityState={{
                  disabled: locked || !!activeId || index === 0,
                }}
                style={styles.arrow}
                onPress={() =>
                  onChange(
                    moveItem(activities, index, index - 1).map(
                      (item) => item.id,
                    ),
                  )
                }
              >
                <Text
                  style={{
                    color: index === 0 || locked ? colors.line : colors.teal,
                  }}
                >
                  ▲
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Đưa ${activity.title} xuống`}
                disabled={
                  locked || !!activeId || index === activities.length - 1
                }
                accessibilityState={{
                  disabled:
                    locked || !!activeId || index === activities.length - 1,
                }}
                style={styles.arrow}
                onPress={() =>
                  onChange(
                    moveItem(activities, index, index + 1).map(
                      (item) => item.id,
                    ),
                  )
                }
              >
                <Text
                  style={{
                    color:
                      index === activities.length - 1 || locked
                        ? colors.line
                        : colors.teal,
                  }}
                >
                  ▼
                </Text>
              </Pressable>
            </View>
            <ActivityDragHandle
              label={activity.title}
              active={activeId === activity.id}
              disabled={
                locked || (!!activeId && activeId !== activity.id) ||
                activities.some((item) => !measuredIds.includes(item.id))
              }
              onBegin={(pageY) => begin(activity.id, pageY)}
              onMove={(dy, pageY) => {
                if (drag.current) {
                  drag.current.dy = dy;
                  drag.current.pageY = pageY;
                  update();
                }
              }}
              onEnd={finish}
            />
          </OrderRow>
        ))}
      </ScrollView>
    </View>
    </>
  );
}
const styles = StyleSheet.create({
  list: { gap: ORDER_ROW_GAP, padding: ORDER_LIST_PADDING },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "transparent",
  },
  copy: { flex: 1, minWidth: 0, paddingVertical: 14, gap: 4 },
  time: { color: colors.teal, fontSize: 12, fontWeight: "600" },
  arrow: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  target: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  dragging: {
    zIndex: 10,
    elevation: 8,
    borderColor: colors.teal,
    boxShadow: "0 8px 20px rgba(0,50,70,0.18)",
  },
});
