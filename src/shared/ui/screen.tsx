import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState, type PropsWithChildren, type ReactNode } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, typography } from "@/shared/theme/tokens";
import { designIcons } from "./design-assets";
import { DesignIcon } from "./design-icon";
import { BottomTabBar, type TabKey } from "./bottom-tab-bar";
import { GlassSurface } from "./glass-surface";
import { LinearGradient } from "expo-linear-gradient";

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
}>;

function ScreenBackButton({ onPress }: { onPress: () => void }) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [scale] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue: 0.9,
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
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel="Quay lại"
        style={styles.back}
      >
        <DesignIcon name="back" size={24} tintColor={colors.teal} />
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
}: Props) {
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(56);
  const [tabHeight, setTabHeight] = useState(0);
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  // Opt-in browser preview chrome mirrors Figma. Native devices use real OS bars.
  const devicePreview = Platform.OS === "web" && preview === "1";
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
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <LinearGradient
          pointerEvents="none"
          colors={["#E5F3F8", "#F3F3FA", "#F2F2F7"]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
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
        <GlassSurface
          variant="regular"
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
        </GlassSurface>
        <KeyboardAvoidingView
          style={styles.viewport}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={insets.top + headerHeight}
        >
          <ScrollView
            contentContainerStyle={[
              styles.content,
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
            ]}
            keyboardShouldPersistTaps="handled"
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
          {footer && (
            <GlassSurface
              variant="prominent"
              style={[
                styles.footer,
                { paddingBottom: Math.max(insets.bottom, 16) },
              ]}
            >
              {footer}
            </GlassSurface>
          )}
        </KeyboardAvoidingView>
        {tab && <BottomTabBar activeTab={tab} onHeightChange={setTabHeight} />}
        {devicePreview && <View style={styles.homeIndicator} />}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.canvas, alignItems: "center" },
  screen: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
    backgroundColor: colors.canvas,
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
    marginHorizontal: 16,
    marginTop: 6,
    paddingHorizontal: 8,
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
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  backPressed: { opacity: 0.7 },
  headerTitle: { flex: 1, textAlign: "center", paddingVertical: 8 },
  viewport: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 16, gap: 20 },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    marginHorizontal: 12,
    borderRadius: 24,
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
