import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, shadows, typography } from "@/shared/theme/tokens";
import { DesignIcon } from "@/shared/ui/design-icon";
import type { Activity } from "../types";
import { activityTimeLabel } from "../utils";

export function ActivityRow({
  activity,
  timezone,
  onPress,
  onLongPress,
}: {
  activity: Activity;
  timezone: string;
  onPress: () => void;
  onLongPress?: () => void;
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
      accessibilityHint={onLongPress ? "Chạm để xem. Nhấn giữ để mở sắp xếp lịch trình." : undefined}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <Text style={[typography.footnote, styles.time]}>
        {activityTimeLabel(activity, timezone)}
      </Text>
      <View style={[styles.icon, complete && { backgroundColor: colors.pinGreen }]}>
        <DesignIcon
          name={
            complete
              ? "check"
              : activity.activity_type === "MEAL"
                ? "wallet"
                : "pin"
          }
          size={20}
          tintColor={complete ? "white" : colors.ink}
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
    padding: 12,
    marginVertical: 6,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    ...shadows.glass,
  },
  time: {
    minWidth: 54,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.lilac,
    color: colors.violet,
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",

  },
});
