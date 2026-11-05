import { router } from "expo-router";
import { useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { useSession } from "@/features/auth/session/session-provider";
import { ProfileAvatar } from "@/features/auth/components/profile-avatar";
import { colors, radii, typography } from "@/shared/theme/tokens";
import { type DesignIconName } from "./design-assets";
import { DesignIcon } from "./design-icon";
import { GlassSurface } from "./glass-surface";

type Props = {
  onPressNotification?: () => void;
  onPressAdd?: () => void;
  hasUnreadNotifications?: boolean;
};

export function AppHeader({
  onPressNotification = () => router.push("/invitation"),
  onPressAdd,
  hasUnreadNotifications = false,
}: Props) {
  const { profile } = useSession();
  const name = profile?.full_name.trim().split(/\s+/).at(-1) ?? "bạn";
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Mở tài khoản" onPress={() => router.navigate("/(tabs)/profile")} style={styles.avatar}>
        <ProfileAvatar profile={profile} size={42} />
      </Pressable>
      <View style={styles.greeting}>
        <Text style={typography.footnote}>Chào {name},</Text>
        <Text accessibilityRole="header" style={styles.title}>Đi đâu tiếp nhỉ?</Text>
      </View>
      <View style={styles.actions}>
        <HeaderButton
          icon="bell"
          label="Mở lời mời chuyến đi"
          onPress={onPressNotification}
        >
          {hasUnreadNotifications && <View style={styles.unreadDot} />}
        </HeaderButton>
        {onPressAdd && <HeaderButton
          icon="plus"
          label="Tạo chuyến đi mới"
          onPress={onPressAdd}
        />}
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
    minHeight: 52,
    gap: 12,
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  greeting: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...typography.title, fontSize: 22, lineHeight: 28 },
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
    boxShadow: "0 0 0 1px #173F63",
  },
});
