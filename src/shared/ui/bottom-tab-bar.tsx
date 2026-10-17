import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, radii, typography } from "@/shared/theme/tokens";
import type { DesignIconName } from "./design-assets";
import { DesignIcon } from "./design-icon";
import { GlassSurface } from "./glass-surface";

export type TabKey = "explore" | "trips" | "account";
const tabs: {
  key: TabKey;
  label: string;
  icon: DesignIconName;
  route: "/(tabs)" | "/(tabs)/trips" | "/(tabs)/profile";
}[] = [
  { key: "explore", label: "Khám phá", icon: "compass", route: "/(tabs)" },
  { key: "trips", label: "Chuyến đi", icon: "trip", route: "/(tabs)/trips" },
  {
    key: "account",
    label: "Tài khoản",
    icon: "user",
    route: "/(tabs)/profile",
  },
];

export function BottomTabBar({
  activeTab,
  onHeightChange,
}: {
  activeTab: TabKey;
  onHeightChange?: (height: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useAccessibilityPreferences();

  return (
    <View
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}
      pointerEvents="box-none"
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
    >
      <View style={styles.shadow}>
        <GlassSurface style={styles.dock}>
          {tabs.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: active }}
                onPress={() => router.navigate(tab.route)}
                style={({ pressed }) => [
                  styles.tab,
                  active && styles.tabActive,
                  pressed && styles.pressed,
                ]}
              >
                <TabIcon
                  name={tab.icon}
                  active={active}
                  reduceMotion={reduceMotion}
                />
                <Text
                  style={[
                    typography.footnote,
                    styles.label,
                    active && styles.activeLabel,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </GlassSurface>
      </View>
    </View>
  );
}

function TabIcon({
  name,
  active,
  reduceMotion,
}: {
  name: DesignIconName;
  active: boolean;
  reduceMotion: boolean;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    scale.setValue(1);
    if (!active || reduceMotion) return;
    const animation = Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.12,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 14,
        stiffness: 250,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [active, reduceMotion, scale]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <DesignIcon
        name={name}
        size={24}
        tintColor={active ? colors.teal : colors.muted}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  shadow: {
    width: "100%",
    maxWidth: 380,
    borderRadius: radii.pill,
    boxShadow: "0 8px 32px rgba(31,70,100,0.16)",
  },
  dock: {
    minHeight: 66,
    borderRadius: radii.pill,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "stretch",
    padding: 5,
  },
  tab: {
    flex: 1,
    minHeight: 54,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  tabActive: { backgroundColor: "rgba(0,140,172,0.12)" },
  pressed: { opacity: 0.6 },
  label: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "500",
    color: colors.muted,
    textAlign: "center",
  },
  activeLabel: { color: colors.teal, fontWeight: "600" },
});
