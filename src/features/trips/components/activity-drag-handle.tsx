import { useEffect, useMemo, useRef, type PropsWithChildren } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { colors } from "@/shared/theme/tokens";
import { ORDER_HOLD_MS } from "../model/order-drag";

type DragCallbacks = {
  disabled: boolean;
  onBegin: (pageY: number) => boolean;
  onMove: (dy: number, pageY: number) => void;
  onEnd: (commit: boolean) => void;
};

/**
 * One-finger vertical drag. `holdMs` 0 starts as soon as the pointer moves (the grip);
 * a hold delay lets the card itself be lifted without stealing taps or page scrolls.
 */
function useOrderDragGesture({ disabled, onBegin, onMove, onEnd, holdMs }: DragCallbacks & { holdMs: number }) {
  const latest = useRef({ disabled, onBegin, onMove, onEnd });
  const started = useRef(false);
  useEffect(() => {
    latest.current = { disabled, onBegin, onMove, onEnd };
  }, [disabled, onBegin, onMove, onEnd]);
  // RNGH registers these callbacks during render, but only invokes them for events.
  /* eslint-disable react-hooks/refs */
  return useMemo(() => {
    const base = Gesture.Pan()
      .enabled(!disabled)
      .maxPointers(1)
      .shouldCancelWhenOutside(false)
      .runOnJS(true);
    return (holdMs > 0 ? base.activateAfterLongPress(holdMs) : base.minDistance(2))
      .onStart((event) => {
        if (!latest.current.disabled) {
          started.current = latest.current.onBegin(event.absoluteY - event.translationY);
        }
      })
      .onTouchesDown((event) => {
        // maxPointers only guards activation; cancel an already-active multi-touch drag too.
        if (event.numberOfTouches > 1 && started.current) {
          started.current = false;
          latest.current.onEnd(false);
        }
      })
      .onUpdate((event) => {
        if (started.current && !latest.current.disabled) {
          latest.current.onMove(event.translationY, event.absoluteY);
        }
      })
      .onFinalize((_event, success) => {
        if (!started.current) return;
        started.current = false;
        latest.current.onEnd(success && !latest.current.disabled);
      });
  }, [disabled, holdMs]);
  /* eslint-enable react-hooks/refs */
}

/** Press-and-hold anywhere on the card to lift it (the familiar mobile reorder gesture). */
export function ActivityHoldArea({ children, ...callbacks }: PropsWithChildren<DragCallbacks>) {
  const gesture = useOrderDragGesture({ ...callbacks, holdMs: ORDER_HOLD_MS });
  return (
    <GestureDetector gesture={gesture} touchAction="pan-y" userSelect="none">
      <View collapsable={false} style={styles.holdArea}>
        {children}
      </View>
    </GestureDetector>
  );
}

export function ActivityDragHandle({
  label,
  active,
  canMoveUp,
  canMoveDown,
  onStep,
  ...callbacks
}: DragCallbacks & {
  label: string;
  active: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Keyboard and screen-reader alternative to dragging. */
  onStep: (direction: -1 | 1) => void;
}) {
  const gesture = useOrderDragGesture({ ...callbacks, holdMs: 0 });
  const { disabled } = callbacks;
  const step = (direction: -1 | 1) => {
    if (disabled || (direction < 0 ? !canMoveUp : !canMoveDown)) return;
    onStep(direction);
  };
  const keyboard =
    Platform.OS === "web"
      ? {
          tabIndex: 0 as const,
          onKeyDown: (event: { key: string; preventDefault: () => void }) => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
            event.preventDefault();
            step(event.key === "ArrowUp" ? -1 : 1);
          },
        }
      : {};
  return (
    <GestureDetector gesture={gesture} touchAction="none" userSelect="none">
      <View
        collapsable={false}
        accessible
        accessibilityLabel={`Kéo để di chuyển ${label}`}
        accessibilityState={{ disabled, selected: active }}
        aria-disabled={disabled}
        aria-selected={active}
        accessibilityHint="Kéo lên hoặc xuống để đổi thứ tự. Bàn phím: phím mũi tên lên, xuống."
        accessibilityActions={[
          ...(canMoveUp ? [{ name: "moveUp", label: "Đưa lên" }] : []),
          ...(canMoveDown ? [{ name: "moveDown", label: "Đưa xuống" }] : []),
        ]}
        onAccessibilityAction={(event) => step(event.nativeEvent.actionName === "moveUp" ? -1 : 1)}
        {...(keyboard as object)}
        style={[styles.handle, active && styles.active, disabled && styles.disabled]}
      >
        <View style={styles.grip}>
          {[0, 1, 2].map((row) => (
            <View key={row} style={styles.gripRow}>
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          ))}
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  holdArea: { flex: 1, minWidth: 0 },
  handle: {
    width: 44,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    // Mouse users see a grab cursor (web only).
    ...Platform.select({ web: { cursor: "grab" }, default: {} }),
  } as object,
  grip: { gap: 4 },
  gripRow: { flexDirection: "row", gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.muted, opacity: 0.55 },
  active: { backgroundColor: colors.tealSoft, ...Platform.select({ web: { cursor: "grabbing" }, default: {} }) } as object,
  disabled: { opacity: 0.35 },
});
