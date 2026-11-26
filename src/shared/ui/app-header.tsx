import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Reanimated, { cancelAnimation, Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { useSession } from "@/features/auth/session/session-provider";
import { useApi } from "@/shared/api/use-api";
import { ProfileAvatar } from "@/features/auth/components/profile-avatar";
import { colors, fonts, radii, springs, typography } from "@/shared/theme/tokens";
import { type DesignIconName } from "./design-assets";
import { DesignIcon } from "./design-icon";
import { GlassSurface } from "./glass-surface";
import { BrandBadge } from "./brand/brand-badge";

type Props = {
  title?: string;
  showGreeting?: boolean;
  showAvatar?: boolean;
  onPressNotification?: () => void;
  onPressAdd?: () => void;
  hasUnreadNotifications?: boolean;
  /** Show the Wolfari logo badge in the corner instead of the profile avatar (Khám phá). */
  brand?: boolean;
};

export function AppHeader({
  title = 'Đi đâu tiếp nhỉ?',
  showGreeting = true,
  showAvatar = true,
  onPressNotification = () => router.push("/notifications"),
  onPressAdd,
  hasUnreadNotifications,
  brand = false,
}: Props) {
  const { profile, status } = useSession();
  const api = useApi();
  const [unread, setUnread] = useState(false);
  // Refresh the unread dot whenever a screen with the header regains focus.
  useFocusEffect(useCallback(() => {
    if (status !== "authenticated") return;
    const controller = new AbortController();
    api.notifications.list({ unread: true, limit: 1, signal: controller.signal })
      .then(page => setUnread(page.items.some(item => item.status !== "CANCELLED")))
      .catch(() => { /* badge is best-effort */ });
    return () => controller.abort();
  }, [api, status]));
  const showDot = hasUnreadNotifications ?? unread;
  const name = profile?.full_name.trim().split(/\s+/).at(-1) ?? "bạn";
  return (
    <View style={styles.header}>
      {brand ? <BrandBadge /> : showAvatar && <Pressable accessibilityRole="button" accessibilityLabel="Mở tài khoản" onPress={() => router.navigate("/(tabs)/profile")} style={styles.avatar}>
        <ProfileAvatar profile={profile} size={42} />
      </Pressable>}
      <View style={styles.greeting}>
        {showGreeting && <Text style={[typography.footnote, brand && styles.brandGreeting]}>Chào {name},</Text>}
        <Text accessibilityRole="header" style={[styles.title, brand && styles.brandTitle]}>{title}</Text>
      </View>
      <View style={styles.actions}>
        <HeaderButton
          icon="bell"
          label={showDot ? "Mở thông báo, có thông báo chưa đọc" : "Mở thông báo"}
          onPress={onPressNotification}
        >
          {showDot && <UnreadDot />}
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

/** The unread dot stamps in and sends out one soft ring, so a new notice is noticed once, not nagged about. */
function UnreadDot() {
  const { reduceMotion } = useAccessibilityPreferences();
  const pop = useSharedValue(reduceMotion ? 1 : 0);
  const ring = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) { pop.set(1); ring.set(1); return; }
    pop.set(withSpring(1, springs.stamp));
    ring.set(withDelay(120, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })));
    return () => { cancelAnimation(pop); cancelAnimation(ring); };
  }, [reduceMotion, pop, ring]);
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.get(), [0, 0.2, 1], [0, 0.55, 0]),
    transform: [{ scale: interpolate(ring.get(), [0, 1], [1, 3.2]) }],
  }));
  return <>
    <Reanimated.View pointerEvents="none" style={[styles.unreadRing, ringStyle]} />
    <Reanimated.View pointerEvents="none" style={[styles.unreadDot, dotStyle]} />
  </>;
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
  brandGreeting: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 18, color: "#6A7891" },
  brandTitle: { fontSize: 24, lineHeight: 30 },
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
  unreadRing: {
    position: "absolute",
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.orange,
  },
});
