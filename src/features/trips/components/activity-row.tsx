import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radii, shadows, typography } from "@/shared/theme/tokens";
import { DesignIcon } from "@/shared/ui/design-icon";
import type { Activity } from "../types";
import { activityTimeLabel } from "../utils";

/** Icon and text shared by the timeline card and its reorder (edit-mode) twin. */
export function ActivityCardBody({ activity, time }: { activity: Activity; time: ReactNode }) {
  const complete = activity.status === "COMPLETED";
  return (
    <View style={styles.body}>
      {time}
      <View style={[styles.icon, complete && { backgroundColor: colors.pinGreen }]}>
        <DesignIcon
          name={complete ? "check" : activity.activity_type === "MEAL" ? "wallet" : "pin"}
          size={20}
          tintColor={complete ? "white" : colors.ink}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[
            typography.headline,
            complete && { textDecorationLine: "line-through", color: colors.muted },
          ]}
        >
          {activity.title}
        </Text>
        <Text numberOfLines={2} style={[typography.footnote, { marginTop: 5 }]}>
          {activity.description || (complete ? "Đã hoàn thành" : "Một trải nghiệm đang chờ")}
        </Text>
      </View>
    </View>
  );
}

export function ActivityTime({ label, tone = "default" }: { label: string; tone?: "default" | "changed" | "cleared" }) {
  return (
    <Text
      style={[
        typography.footnote,
        styles.time,
        tone === "changed" && styles.timeChanged,
        tone === "cleared" && styles.timeCleared,
      ]}
    >
      {label}
    </Text>
  );
}

export function ActivityRow({
  activity,
  timezone,
  onPress,
  onLongPress,
  style,
}: {
  activity: Activity;
  timezone: string;
  onPress: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const complete = activity.status === "COMPLETED";
  return (
    <Pressable
      cssInterop={false}
      accessibilityRole="button"
      accessibilityLabel={`${activity.title}, ${activityTimeLabel(activity, timezone)}${complete ? ", đã hoàn thành" : ""}`}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityHint={onLongPress ? "Chạm để xem. Nhấn giữ để sắp xếp lịch trình." : undefined}
      style={({ pressed }) => [activityCard, styles.spaced, style, pressed && { opacity: 0.7 }]}
    >
      <ActivityCardBody activity={activity} time={<ActivityTime label={activityTimeLabel(activity, timezone)} />} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 88,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    ...shadows.glass,
  },
  spaced: { marginVertical: 6 },
  body: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  time: {
    minWidth: 54,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radii.pill,
    overflow: "hidden",
    textAlign: "center",
    backgroundColor: colors.lilac,
    color: colors.violet,
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  timeChanged: { backgroundColor: colors.mint, color: colors.pinGreen },
  timeCleared: { backgroundColor: colors.butter, color: colors.amber, textDecorationLine: "line-through" },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});

export const activityCard = styles.card;
