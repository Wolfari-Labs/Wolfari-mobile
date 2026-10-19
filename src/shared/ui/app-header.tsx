import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, radii, shadows } from "@/shared/theme/tokens";
import { designAssets, type DesignIconName } from "./design-assets";
import { DesignIcon } from "./design-icon";
import { GlassSurface } from "./glass-surface";

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
        <HeaderButton
          icon="bell"
          label="Mở lời mời chuyến đi"
          onPress={onPressNotification}
        >
          {hasUnreadNotifications && <View style={styles.unreadDot} />}
        </HeaderButton>
        <HeaderButton
          icon="plus"
          label="Tạo chuyến đi mới"
          onPress={onPressAdd}
        />
      </View>
    </View>
  );
}

function HeaderButton({
  icon,
  label,
  onPress,
  children,
}: {
  icon: DesignIconName;
  label: string;
  onPress: () => void;
  children?: React.ReactNode;
}) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [scale] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue: 0.92,
      damping: 16,
      stiffness: 350,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue: 1,
      damping: 12,
      stiffness: 240,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.iconButtonWrapper}
      >
        <GlassSurface variant="subtle" style={styles.iconButton}>
          <DesignIcon name={icon} size={20} tintColor={colors.ink} />
          {children}
        </GlassSurface>
      </Pressable>
    </Animated.View>
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
  iconButtonWrapper: {
    borderRadius: radii.pill,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.floating,
  },
  unreadDot: {
    position: "absolute",
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.orange,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
});
