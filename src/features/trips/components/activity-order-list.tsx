import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { colors, typography } from "@/shared/theme/tokens";
import type { Activity } from "../types";
import { moveItem } from "../order-session";
import { timeLabel } from "../utils";

type Props = {
  activities: Activity[];
  timezone: string;
  disabled: boolean;
  onChange: (ids: string[]) => void;
  onDragging: (dragging: boolean) => void;
};
type Frame = { y: number; height: number };
const ROW_GAP = 10;
const LIST_PADDING = 3;

export function ActivityOrderList({
  activities,
  timezone,
  disabled,
  onChange,
  onDragging,
}: Props) {
  const { height } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const viewport = useRef<View>(null);
  const frames = useRef(new Map<string, Frame>());
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
    frames: Map<string, Frame>;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [activeId, setActiveId] = useState<string>();
  const [targetId, setTargetId] = useState<string>();
  const [measuredIds, setMeasuredIds] = useState<string[]>([]);
  const [translation] = useState(() => new Animated.Value(0));
  const callbacks = useRef({ onChange, onDragging });
  useEffect(() => {
    callbacks.current = { onChange, onDragging };
  }, [onChange, onDragging]);

  const finish = useCallback(
    (commit: boolean) => {
      const current = drag.current;
      drag.current = null;
      clearInterval(timer.current);
      setActiveId(undefined);
      setTargetId(undefined);
      translation.setValue(0);
      callbacks.current.onDragging(false);
      if (commit && current && current.to !== current.from) {
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
    if (disabled && drag.current) finish(false);
  }, [disabled, finish]);
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
    const frame = current.frames.get(current.id);
    if (!frame) return;
    const delta = current.dy + offset.current - current.startOffset;
    const center = frame.y + frame.height / 2 + delta;
    let nearest = current.from,
      distance = Infinity;
    current.items.forEach((item, index) => {
      const row = current.frames.get(item.id);
      if (row && Math.abs(center - row.y - row.height / 2) < distance) {
        nearest = index;
        distance = Math.abs(center - row.y - row.height / 2);
      }
    });
    if (current.to !== nearest) {
      current.to = nearest;
      setTargetId(current.items[nearest].id);
    }
    translation.setValue(delta);
  }
  function begin(id: string, pageY: number) {
    if (disabled || drag.current) return;
    const from = activities.findIndex((item) => item.id === id);
    if (from < 0 || activities.some((item) => !frames.current.has(item.id)))
      return;
    // A keyed row can move without another size/layout event on web. Rebuild
    // positions from the current order and measured heights before EVERY drag.
    let y = LIST_PADDING;
    const orderedFrames = new Map<string, Frame>();
    for (const item of activities) {
      const height = frames.current.get(item.id)!.height;
      orderedFrames.set(item.id, { y, height });
      y += height + ROW_GAP;
    }
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
      if (!current || !bounds.current.height) return;
      const local = current.pageY - bounds.current.top;
      const speed =
        local < 52 ? -9 : local > bounds.current.height - 52 ? 9 : 0;
      const next = Math.max(
        0,
        Math.min(
          contentHeight.current - bounds.current.height,
          offset.current + speed,
        ),
      );
      if (speed && next !== offset.current) {
        offset.current = next;
        scroll.current?.scrollTo({ y: next, animated: false });
        update();
      }
    }, 32);
  }
  return (
    <View
      ref={viewport}
      testID="activity-order-list"
      style={{ maxHeight: Math.max(150, height * 0.37), flexShrink: 1 }}
    >
      <ScrollView
        ref={scroll}
        scrollEnabled={!activeId}
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
          <Animated.View
            key={activity.id}
            onLayout={(event) => {
              frames.current.set(activity.id, event.nativeEvent.layout);
              setMeasuredIds((ids) =>
                ids.includes(activity.id) ? ids : [...ids, activity.id],
              );
            }}
            style={[
              styles.row,
              targetId === activity.id &&
                activeId !== activity.id &&
                styles.target,
              activeId === activity.id && [
                styles.dragging,
                { transform: [{ translateY: translation }] },
              ],
            ]}
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
                disabled={disabled || !!activeId || index === 0}
                accessibilityState={{
                  disabled: disabled || !!activeId || index === 0,
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
                    color: index === 0 || disabled ? colors.line : colors.teal,
                  }}
                >
                  ▲
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Đưa ${activity.title} xuống`}
                disabled={
                  disabled || !!activeId || index === activities.length - 1
                }
                accessibilityState={{
                  disabled:
                    disabled || !!activeId || index === activities.length - 1,
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
                      index === activities.length - 1 || disabled
                        ? colors.line
                        : colors.teal,
                  }}
                >
                  ▼
                </Text>
              </Pressable>
            </View>
            <DragHandle
              label={activity.title}
              disabled={
                disabled ||
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
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

function DragHandle({
  label,
  disabled,
  onBegin,
  onMove,
  onEnd,
}: {
  label: string;
  disabled: boolean;
  onBegin: (pageY: number) => void;
  onMove: (dy: number, pageY: number) => void;
  onEnd: (commit: boolean) => void;
}) {
  const latest = useRef({ disabled, onBegin, onMove, onEnd });
  useEffect(() => {
    latest.current = { disabled, onBegin, onMove, onEnd };
  }, [disabled, onBegin, onMove, onEnd]);
  // PanResponder stores these callbacks; refs are read only on gesture events.
  const responder = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- PanResponder stores callbacks; it does not invoke them during render.
      PanResponder.create({
        onStartShouldSetPanResponder: () => !latest.current.disabled,
        onMoveShouldSetPanResponder: () => !latest.current.disabled,
        onPanResponderGrant: (event) => {
          event.preventDefault();
          latest.current.onBegin(event.nativeEvent.pageY);
        },
        onPanResponderMove: (event, gesture) => {
          if (gesture.numberActiveTouches > 1) latest.current.onEnd(false);
          else latest.current.onMove(gesture.dy, event.nativeEvent.pageY);
        },
        onPanResponderRelease: () => latest.current.onEnd(true),
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => latest.current.onEnd(false),
      }),
    [],
  );
  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityLabel={`Kéo để di chuyển ${label}`}
      accessibilityState={{ disabled }}
      accessibilityHint="Dùng các nút lên và xuống nếu không kéo thả."
      style={[styles.handle, disabled && { opacity: 0.4 }]}
    >
      <Text style={styles.grip}>☰</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  list: { gap: ROW_GAP, padding: LIST_PADDING },
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
  handle: {
    width: 44,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  grip: { color: colors.muted, fontSize: 22, userSelect: "none" },
  target: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  dragging: {
    zIndex: 10,
    elevation: 8,
    borderColor: colors.teal,
    boxShadow: "0 8px 20px rgba(0,50,70,0.18)",
  },
});
