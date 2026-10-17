import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, radii } from "@/shared/theme/tokens";
import { designAssets } from "./design-assets";
import { DesignIcon } from "./design-icon";

type Props = {
  onPressNotification?: () => void;
  onPressAdd?: () => void;
  hasUnreadNotifications?: boolean;
};

export function AppHeader({
  onPressNotification = () => router.push("/invitation"),
  onPressAdd = () => router.push("/create-trip"),
  hasUnreadNotifications = false,
}: Props) {
  return (
    <View style={styles.header}>
      <Image
        source={designAssets.logo}
        style={styles.logo}
        contentFit="contain"
        accessibilityLabel="Wolfari"
      />
      <View style={styles.spacer} />
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở lời mời chuyến đi"
          onPress={onPressNotification}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.pressed,
          ]}
        >
          <DesignIcon name="bell" size={20} />
          {hasUnreadNotifications && <View style={styles.unreadDot} />}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tạo chuyến đi mới"
          onPress={onPressAdd}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.pressed,
          ]}
        >
          <DesignIcon name="plus" size={20} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  logo: {
    width: 114,
    height: 38,
  },
  spacer: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    backgroundColor: colors.fill,
    transform: [{ scale: 0.96 }],
  },
  unreadDot: {
    position: "absolute",
    top: 10,
    right: 11,
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.orange,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
});
