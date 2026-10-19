import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, radii, shadows, typography } from "@/shared/theme/tokens";
import type { DesignIconName } from "./design-assets";
import { DesignIcon } from "./design-icon";
import { GlassContainer, GlassSurface } from "./glass-surface";

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
  const [dockWidth, setDockWidth] = useState(0);

  const activeIndex = tabs.findIndex((t) => t.key === activeTab);
  const [indicatorAnim] = useState(() => new Animated.Value(Math.max(0, activeIndex)));

  useEffect(() => {
    if (reduceMotion) {
      indicatorAnim.setValue(Math.max(0, activeIndex));
      return;
    }
    Animated.spring(indicatorAnim, {
      toValue: Math.max(0, activeIndex),
      damping: 18,
      stiffness: 240,
      mass: 0.75,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, reduceMotion, indicatorAnim]);

  const tabWidth = dockWidth > 0 ? (dockWidth - 10) / tabs.length : 0;

  const content = (
    <View
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}
      pointerEvents="box-none"
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
    >
      <View style={styles.shadow}>
        <GlassSurface
          variant="dock"
          style={styles.dock}
          onLayout={(e) => setDockWidth(e.nativeEvent.layout.width)}
        >
          {/* Smooth sliding indicator pill */}
          {tabWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.indicatorPill,
                {
                  width: tabWidth,
                  transform: [
                    {
                      translateX: indicatorAnim.interpolate({
                        inputRange: [0, 1, 2],
                        outputRange: [0, tabWidth, tabWidth * 2],
                      }),
                    },
                  ],
                },
              ]}
            >
              <LinearGradient
                colors={[
                  "rgba(0, 140, 172, 0.16)",
                  "rgba(0, 140, 172, 0.08)",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.indicatorPillHighlight} />
            </Animated.View>
          )}

          {tabs.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <TabItem
                key={tab.key}
                tab={tab}
                active={active}
                reduceMotion={reduceMotion}
                onPress={() => router.navigate(tab.route)}
              />
            );
          })}
        </GlassSurface>
      </View>
    </View>
  );

  if (Platform.OS === "ios") {
    return <GlassContainer spacing={10}>{content}</GlassContainer>;
  }

  return content;
}

function TabItem({
  tab,
  active,
  reduceMotion,
  onPress,
}: {
  tab: (typeof tabs)[number];
  active: boolean;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  const [scale] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue: 0.92,
      damping: 16,
      stiffness: 320,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue: 1,
      damping: 14,
      stiffness: 260,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tab}
    >
      <Animated.View style={[styles.tabContent, { transform: [{ scale }] }]}>
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
      </Animated.View>
    </Pressable>
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
        toValue: 1.15,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 12,
        stiffness: 260,
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
    ...shadows.dock,
  },
  dock: {
    minHeight: 66,
    borderRadius: radii.pill,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "stretch",
    padding: 5,
    position: "relative",
  },
  indicatorPill: {
    position: "absolute",
    top: 5,
    bottom: 5,
    left: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(0, 140, 172, 0.22)",
    overflow: "hidden",
  },
  indicatorPillHighlight: {
    position: "absolute",
    top: 0,
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  tab: {
    flex: 1,
    minHeight: 54,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 5,
    zIndex: 1,
  },
  tabContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  label: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "500",
    color: colors.muted,
    textAlign: "center",
  },
  activeLabel: {
    color: colors.teal,
    fontWeight: "600",
  },
});
