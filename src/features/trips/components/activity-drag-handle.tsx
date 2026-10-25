import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { colors } from "@/shared/theme/tokens";
import { ORDER_HOLD_MS } from "../model/order-drag";

type Props = {
  label: string;
  disabled: boolean;
  active: boolean;
  onBegin: (pageY: number) => boolean;
  onMove: (dy: number, pageY: number) => void;
  onEnd: (commit: boolean) => void;
};

export function ActivityDragHandle({
  label,
  disabled,
  active,
  onBegin,
  onMove,
  onEnd,
}: Props) {
  const latest = useRef({ disabled, onBegin, onMove, onEnd });
  const started = useRef(false);
  useEffect(() => {
    latest.current = { disabled, onBegin, onMove, onEnd };
  }, [disabled, onBegin, onMove, onEnd]);
  // RNGH registers these callbacks during render, but only invokes them for events.
  /* eslint-disable react-hooks/refs */
  const gesture = useMemo(
    () => Gesture.Pan()
      .enabled(!disabled)
      .activateAfterLongPress(ORDER_HOLD_MS)
      .maxPointers(1)
      .shouldCancelWhenOutside(false)
      .runOnJS(true)
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
      }),
    [disabled],
  );
  /* eslint-enable react-hooks/refs */
  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        accessible
        accessibilityLabel={`Kéo để di chuyển ${label}`}
        accessibilityState={{ disabled, selected: active }}
        accessibilityHint="Nhấn giữ tay nắm rồi kéo lên hoặc xuống. Có thể dùng các nút lên và xuống thay thế."
        style={[styles.handle, active && styles.active, disabled && styles.disabled]}
      >
        <Text style={styles.grip}>☰</Text>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  handle: {
    width: 48,
    minHeight: 48,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  grip: { color: colors.teal, fontSize: 24, userSelect: "none" },
  active: { backgroundColor: colors.tealSoft },
  disabled: { opacity: 0.4 },
});
