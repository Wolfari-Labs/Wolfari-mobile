import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, typography } from "@/shared/theme/tokens";
import { DesignIcon } from "@/shared/ui/design-icon";
import type { Activity } from "../types";
import { timeLabel } from "../utils";

export function ActivityRow({
  activity,
  timezone,
  onPress,
}: {
  activity: Activity;
  timezone: string;
  onPress: () => void;
}) {
  const complete = activity.status === "COMPLETED";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${activity.title}, ${timeLabel(activity.starts_at, timezone)}${complete ? ", đã hoàn thành" : ""}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <Text style={[typography.footnote, styles.time]}>
        {timeLabel(activity.starts_at, timezone)}
      </Text>
      <View style={[styles.icon, complete && { backgroundColor: colors.teal }]}>
        <DesignIcon
          name={
            complete
              ? "check"
              : activity.activity_type === "MEAL"
                ? "wallet"
                : "pin"
          }
          size={24}
          tintColor={complete ? "white" : colors.teal}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            typography.headline,
            complete && {
              textDecorationLine: "line-through",
              color: colors.muted,
            },
          ]}
        >
          {activity.title}
        </Text>
        <Text numberOfLines={2} style={[typography.footnote, { marginTop: 5 }]}>
          {activity.description ||
            (complete ? "Đã hoàn thành" : "Một trải nghiệm đang chờ")}
        </Text>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 88,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 18,
  },
  time: {
    width: 44,
    color: colors.teal,
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.tealSoft,
  },
});
