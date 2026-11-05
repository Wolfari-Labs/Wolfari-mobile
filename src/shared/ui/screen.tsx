import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState, useSyncExternalStore, type PropsWithChildren, type ReactNode } from "react";
import { BlurTargetView } from "expo-blur";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewInstance,
} from "react-native";
import Animated from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { usePressMotion } from "@/shared/hooks/use-press-motion";
import { colors, fonts, gradients, shadows, typography } from "@/shared/theme/tokens";
import { designIcons } from "./design-assets";
import { DesignIcon } from "./design-icon";
import { BottomTabBar, type TabKey } from "./bottom-tab-bar";
import { GlassSurface } from "./glass-surface";
import { webSafeArea } from "./web-safe-area";

const ScreenArea = Platform.OS === "web" ? View : SafeAreaView;

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

type Props = PropsWithChildren<{
  title?: string;
  header?: ReactNode;
  headerRight?: ReactNode;
  showBack?: boolean;
  bottomPadding?: number;
  tab?: TabKey;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  onBack?: () => void;
  /** A full-width opening section supplies its own accessible navigation. */
  immersive?: boolean;
}>;

function ScreenBackButton({ onPress }: { onPress: () => void }) {
  const motion = usePressMotion(false, 0.92);

  return (
    <Animated.View style={motion.animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={motion.onPressIn}
        onPressOut={motion.onPressOut}
        accessibilityRole="button"
        accessibilityLabel="Quay lại"
        hitSlop={4}
        pressRetentionOffset={16}
        style={styles.backHit}
      >
        <View style={styles.back}>
          <DesignIcon name="back" size={22} tintColor={colors.ink} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function Screen({
  title,
  header,
  headerRight,
  showBack = true,
  children,
  bottomPadding = 24,
  tab,
  footer,
  refreshing = false,
  onRefresh,
  onBack,
  immersive = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(56);
  const [tabHeight, setTabHeight] = useState(0);
  const blurTarget = useRef<ViewInstance>(null);
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  // Opt-in browser preview chrome mirrors Figma. Native devices use real OS bars.
  // Static HTML cannot know query parameters; enable chrome only after hydration.
  const devicePreview = Platform.OS === "web" && hydrated && preview === "1";
  function goBack() {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  return (
    <View style={styles.outer}>
      <LinearGradient pointerEvents="none" colors={gradients.canvas} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <ScreenArea style={[styles.screen, webSafeArea.screen]} edges={Platform.OS === "web" ? undefined : ["top", "left", "right"]}>
        {devicePreview && (
          <View style={styles.statusBar} accessible={false}>
            <Text style={[typography.body, styles.clock]}>9:41</Text>
            <View style={styles.indicators}>
              <View style={{ width: 17 }}>
                <DesignIcon name="signal" />
              </View>
              <View style={{ width: 18 }}>
                <DesignIcon name="wifi" />
              </View>
              <Image
                source={designIcons.battery}
                style={{ width: 22, height: 22 }}
                contentFit="contain"
              />
            </View>
          </View>
        )}
        {!immersive && <View
          style={styles.header}
          onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
        >
          {header ?? (
            <>
              <View style={styles.headerSide}>
                {showBack && <ScreenBackButton onPress={goBack} />}
              </View>
              <Text
                accessibilityRole="header"
                numberOfLines={2}
                style={[typography.headline, styles.headerTitle]}
              >
                {title}
              </Text>
              <View style={styles.headerSide}>{headerRight}</View>
            </>
          )}
        </View>}
        <KeyboardAvoidingView
          style={styles.viewport}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={insets.top + (immersive ? 0 : headerHeight)}
        >
          <BlurTargetView ref={blurTarget} style={styles.viewport}>
            <ScrollView
              contentContainerStyle={[
                styles.content,
                immersive && styles.immersiveContent,
                {
                  paddingBottom: Math.max(
                    bottomPadding,
                    tab
                      ? Math.max(tabHeight, 74 + Math.max(insets.bottom, 12)) + 16
                      : footer
                        ? 24
                        : insets.bottom + 24,
                  ),
                },
                !tab && !footer && webSafeArea.content(bottomPadding),
              ]}
              keyboardShouldPersistTaps="handled"
              contentInsetAdjustmentBehavior="automatic"
              keyboardDismissMode={
                Platform.OS === "ios" ? "interactive" : "on-drag"
              }
              showsVerticalScrollIndicator={false}
              refreshControl={
                onRefresh ? (
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={colors.teal}
                  />
                ) : undefined
              }
            >
              {children}
            </ScrollView>
          </BlurTargetView>
          {footer && (
            <GlassSurface
              variant="prominent"
              blurTarget={blurTarget}
              style={[
                styles.footer,
                { paddingBottom: Math.max(insets.bottom, 16) },
                webSafeArea.footer,
              ]}
            >
              {footer}
            </GlassSurface>
          )}
        </KeyboardAvoidingView>
        {tab && <BottomTabBar activeTab={tab} onHeightChange={setTabHeight} blurTarget={blurTarget} />}
        {devicePreview && <View style={styles.homeIndicator} />}
      </ScreenArea>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.canvas, alignItems: "center" },
  screen: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
    backgroundColor: "transparent",
  },
  statusBar: {
    height: 54,
    paddingLeft: 28,
    paddingRight: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  clock: { flex: 1 },
  indicators: { width: 86, flexDirection: "row", alignItems: "center", gap: 5 },
  header: {
    minHeight: 56,
    marginHorizontal: 24,
    marginTop: 4,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerSide: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backHit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    ...shadows.floating,
  },
  headerTitle: { flex: 1, textAlign: "center", paddingVertical: 8, fontFamily: fonts.heading },
  viewport: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 20, gap: 20 },
  immersiveContent: { paddingHorizontal: 0, paddingTop: 0, gap: 0 },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 22,
    gap: 8,
  },
  homeIndicator: {
    position: "absolute",
    bottom: 9,
    width: 134,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.ink,
    opacity: 0.85,
    alignSelf: "center",
    pointerEvents: "none",
  },
});
