import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { createContext, useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type ViewInstance } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { usePressMotion } from "@/shared/hooks/use-press-motion";
import { colors, fonts, radii, springs } from "@/shared/theme/tokens";
import { BottomBarSurface } from "./bottom-bar-surface";
import type { DesignIconName } from "./design-assets";
import { DesignIcon } from "./design-icon";
import { webSafeArea } from "./web-safe-area";

export type TabKey = "explore" | "trips" | "notifications" | "account";
const tabs: { key: TabKey; label: string; icon: DesignIconName; route: "/(tabs)" | "/(tabs)/trips" | "/notifications" | "/(tabs)/profile" }[] = [
  { key: "explore", label: "Khám phá", icon: "compass", route: "/(tabs)" },
  { key: "trips", label: "Chuyến đi", icon: "bag", route: "/(tabs)/trips" },
  { key: "notifications", label: "Thông báo", icon: "bell", route: "/notifications" },
  { key: "account", label: "Tài khoản", icon: "user", route: "/(tabs)/profile" },
];

// The tabs share one persistent bar (TabsLayout). Detail pages pushed above the
// tabs draw their own copy; remember the selection so a new copy slides from there.
let lastIndex = 0;

/** Present inside the tabs layout: screens leave the bar to the host and only pad for it. */
export const TabBarHostContext = createContext<{ height: number } | null>(null);

/**
 * Tab press. Inside the tabs, switch tabs. From a page pushed above them (a trip), pop
 * back to that tab instead of pushing another copy of the tabs, so Back never returns
 * to the page the user just left through the tab bar.
 */
export function openTab(route: (typeof tabs)[number]["route"], fromPage: boolean) {
  if (fromPage) router.dismissTo(route);
  else router.navigate(route);
}

const SCRUB_SPRING = { damping: 22, stiffness: 420, mass: 0.4 };
const activeGradient = [colors.tealSoft, colors.mint] as const;

export function BottomTabBar({ activeTab, onHeightChange, blurTarget, page = false }: {
  activeTab: TabKey; onHeightChange?: (height: number) => void; blurTarget?: RefObject<ViewInstance | null>;
  /** True on detail pages above the tabs (their own bar copy). */
  page?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useAccessibilityPreferences();
  const [dockWidth, setDockWidth] = useState(0);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const dockWrapRef = useRef<ViewInstance | null>(null);
  const dockPageX = useRef(0);
  const startPageX = useRef<number | null>(null);
  const hoveredRef = useRef(0);

  const activeIndex = Math.max(0, tabs.findIndex(tab => tab.key === activeTab));
  const tabWidth = Math.max(0, (dockWidth - 10) / tabs.length);
  // A new bar copy starts where the previous one ended, then slides to its tab.
  const position = useSharedValue(reduceMotion ? activeIndex : lastIndex);
  const dragScale = useSharedValue(1);

  useEffect(() => {
    // A finished scrub already cleared its own index; only the indicator moves here.
    dragScale.set(1);
    if (reduceMotion || lastIndex === activeIndex) {
      // Already there (or a scrub already springs toward it): settle without a jump.
      position.set(reduceMotion ? activeIndex : withSpring(activeIndex, springs.snappy));
    } else {
      position.set(withSpring(activeIndex, springs.snappy));
    }
    lastIndex = activeIndex;
    hoveredRef.current = activeIndex;
  }, [activeIndex, dragScale, position, reduceMotion]);
  useEffect(() => () => {
    cancelAnimation(position);
    cancelAnimation(dragScale);
  }, [dragScale, position]);

  const measureDock = useCallback(() => {
    dockWrapRef.current?.measureInWindow?.((x) => {
      if (typeof x === "number") dockPageX.current = x;
    });
  }, []);

  const updateScrubFromPageX = useCallback((pageX: number) => {
    if (tabWidth <= 0) return;
    const relX = pageX - dockPageX.current - 5;
    const continuous = Math.max(0, Math.min(tabs.length - 1, (relX - tabWidth / 2) / tabWidth));
    const discrete = Math.max(0, Math.min(tabs.length - 1, Math.floor(relX / tabWidth)));
    hoveredRef.current = discrete;
    setScrubIndex(prev => (prev === discrete ? prev : discrete));
    position.set(reduceMotion ? discrete : withSpring(continuous, SCRUB_SPRING));
  }, [position, reduceMotion, tabWidth]);

  const finishScrub = useCallback((commit: boolean) => {
    startPageX.current = null;
    const targetIdx = commit ? hoveredRef.current : activeIndex;
    setScrubIndex(null);
    dragScale.set(reduceMotion ? 1 : withSpring(1, springs.snappy));
    position.set(reduceMotion ? targetIdx : withSpring(targetIdx, springs.snappy));
    if (commit) {
      lastIndex = targetIdx;
      const targetTab = tabs[targetIdx];
      if (targetTab && (targetIdx !== activeIndex || page)) openTab(targetTab.route, page);
    }
  }, [activeIndex, dragScale, page, position, reduceMotion]);

  const onMoveShouldSetResponderCapture = useCallback((event: GestureResponderEvent) => {
    if (tabWidth <= 0) return false;
    const pageX = event.nativeEvent.pageX;
    if (startPageX.current === null) {
      startPageX.current = pageX;
      return false;
    }
    return Math.abs(pageX - startPageX.current) > 6;
  }, [tabWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: position.get() * tabWidth },
      { scale: dragScale.get() },
    ],
  }));

  const visualActiveIndex = scrubIndex ?? activeIndex;

  return (
    <View testID="glass-tab-bar" style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }, webSafeArea.tab]}
      pointerEvents="box-none" onLayout={event => onHeightChange?.(event.nativeEvent.layout.height)}>
      <View
        ref={dockWrapRef}
        collapsable={false}
        style={styles.row}
        pointerEvents="box-none"
        onLayout={measureDock}
        onTouchStart={event => {
          measureDock();
          startPageX.current = event.nativeEvent.pageX;
          hoveredRef.current = activeIndex;
        }}
        onMoveShouldSetResponderCapture={onMoveShouldSetResponderCapture}
        onResponderGrant={event => {
          dragScale.set(reduceMotion ? 1 : withSpring(1.04, springs.snappy));
          updateScrubFromPageX(event.nativeEvent.pageX);
        }}
        onResponderMove={event => {
          updateScrubFromPageX(event.nativeEvent.pageX);
        }}
        onResponderRelease={() => finishScrub(true)}
        onResponderTerminate={() => finishScrub(false)}
      >
        <BottomBarSurface radius={radii.pill} blurTarget={blurTarget} style={styles.dock} onLayout={event => {
          setDockWidth(event.nativeEvent.layout.width);
          measureDock();
        }}>
          {tabWidth > 0 && (
            <Animated.View pointerEvents="none" style={[styles.indicator, { width: tabWidth }, indicatorStyle]}>
              <LinearGradient colors={activeGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          )}
          {tabs.map((tab, index) => <TabItem key={tab.key} tab={tab} active={tab.key === activeTab} highlighted={index === visualActiveIndex} onPress={() => {
            lastIndex = index;
            // A detail route can share the active tab. Tapping it must still
            // return to that tab's root instead of trapping the user here.
            openTab(tab.route, page);
          }} />)}
        </BottomBarSurface>
      </View>
    </View>
  );
}

function TabItem({ tab, active, highlighted, onPress }: { tab: (typeof tabs)[number]; active: boolean; highlighted: boolean; onPress: () => void }) {
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
            transform: [{ translateY: highlighted && !reduceMotion ? -1.5 : 0 }, { scale: highlighted && !reduceMotion ? 1.08 : 1 }],
            transitionProperty: "transform",
            transitionDuration: reduceMotion ? 0 : 200,
          }}>
            <DesignIcon name={tab.icon} size={21} tintColor={highlighted ? colors.tealPressed : colors.muted} spark={highlighted} pop />
          </Animated.View>
          <Text style={[styles.tabLabel, { color: highlighted ? colors.tealPressed : colors.muted }]}>{tab.label}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center", paddingHorizontal: 24, paddingTop: 8 },
  row: { width: "100%", maxWidth: 400, flexDirection: "row", alignItems: "center", gap: 10 },
  dock: { flex: 1, minHeight: 66, flexDirection: "row", alignItems: "stretch", padding: 5 },
  indicator: { position: "absolute", top: 5, bottom: 5, left: 5, borderRadius: radii.pill, backgroundColor: colors.tealSoft, overflow: "hidden" },
  tabLabel: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
