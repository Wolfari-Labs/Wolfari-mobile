import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState, type RefObject } from "react";
import { Pressable, StyleSheet, Text, View, type ViewInstance } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { usePressMotion } from "@/shared/hooks/use-press-motion";
import { colors, fonts, gradients, radii, springs } from "@/shared/theme/tokens";
import type { DesignIconName } from "./design-assets";
import { DesignIcon } from "./design-icon";
import { GlassSurface } from "./glass-surface";
import { webSafeArea } from "./web-safe-area";

export type TabKey = "explore" | "trips" | "account";
const tabs: { key: TabKey; label: string; icon: DesignIconName; route: "/(tabs)" | "/(tabs)/trips" | "/(tabs)/profile" }[] = [
  { key: "explore", label: "Khám phá", icon: "compass", route: "/(tabs)" },
  { key: "trips", label: "Chuyến đi", icon: "bag", route: "/(tabs)/trips" },
  { key: "account", label: "Tài khoản", icon: "user", route: "/(tabs)/profile" },
];

// Every screen owns its own tab bar, so remember where the selection was and
// slide it from there when the next screen gains focus.
let lastIndex = 0;

export function BottomTabBar({ activeTab, onHeightChange, blurTarget }: {
  activeTab: TabKey; onHeightChange?: (height: number) => void; blurTarget?: RefObject<ViewInstance | null>;
}) {
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useAccessibilityPreferences();
  const [dockWidth, setDockWidth] = useState(0);
  const activeIndex = Math.max(0, tabs.findIndex(tab => tab.key === activeTab));
  const tabWidth = Math.max(0, (dockWidth - 10) / tabs.length);
  const position = useSharedValue(activeIndex);

  useFocusEffect(useCallback(() => {
    if (reduceMotion || lastIndex === activeIndex) {
      position.set(activeIndex);
    } else {
      position.set(lastIndex);
      position.set(withSpring(activeIndex, springs.snappy));
    }
    lastIndex = activeIndex;
    return () => cancelAnimation(position);
  }, [activeIndex, reduceMotion, position]));

  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.get() * tabWidth }] }));

  return (
    <View testID="glass-tab-bar" style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }, webSafeArea.tab]}
      pointerEvents="box-none" onLayout={event => onHeightChange?.(event.nativeEvent.layout.height)}>
      <View style={styles.row} pointerEvents="box-none">
        <GlassSurface variant="dock" blurTarget={blurTarget} style={styles.dock} onLayout={event => setDockWidth(event.nativeEvent.layout.width)}>
          {tabWidth > 0 && <Animated.View pointerEvents="none" style={[styles.indicator, { width: tabWidth }, indicatorStyle]}><LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /></Animated.View>}
          {tabs.map(tab => <TabItem key={tab.key} tab={tab} active={tab.key === activeTab} onPress={() => {
            // A detail route can share the active tab. Tapping it must still
            // return to that tab's root instead of trapping the user here.
            router.navigate(tab.route);
          }} />)}
        </GlassSurface>

      </View>
    </View>
  );
}

function TabItem({ tab, active, onPress }: { tab: (typeof tabs)[number]; active: boolean; onPress: () => void }) {
  const motion = usePressMotion(false, 0.97);
  const { reduceMotion } = useAccessibilityPreferences();
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: active }} aria-selected={active} onPress={onPress}
      onPressIn={motion.onPressIn} onPressOut={motion.onPressOut}
      className="z-10 min-h-[50px] flex-1 items-center justify-center rounded-pill px-1 py-1">
      <Animated.View style={motion.animatedStyle}>
        <View className="items-center justify-center gap-0.5">
          {/* Keep the active destination visible without changing tab layout. */}
          <Animated.View style={{
            transform: [{ translateY: active && !reduceMotion ? -1.5 : 0 }, { scale: active && !reduceMotion ? 1.08 : 1 }],
            transitionProperty: "transform",
            transitionDuration: reduceMotion ? 0 : 220,
          }}>
            <DesignIcon name={tab.icon} size={21} tintColor={active ? colors.onAccent : colors.muted} />
          </Animated.View>
          <Text style={[styles.tabLabel, { color: active ? colors.onAccent : colors.muted }]}>{tab.label}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center", paddingHorizontal: 24, paddingTop: 8 },
  row: { width: "100%", maxWidth: 400, flexDirection: "row", alignItems: "center", gap: 10 },
  dock: { flex: 1, minHeight: 70, borderRadius: radii.pill, flexDirection: "row", alignItems: "stretch", padding: 5 },
  indicator: { position: "absolute", top: 5, bottom: 5, left: 5, borderRadius: radii.pill, backgroundColor: colors.gradientBlue, overflow: "hidden" },
  tabLabel: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
