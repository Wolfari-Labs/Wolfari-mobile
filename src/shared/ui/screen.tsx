import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type PropsWithChildren, type ReactNode } from "react";
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
import Animated, { useSharedValue } from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { usePressMotion } from "@/shared/hooks/use-press-motion";
import { colors, fonts, gradients, shadows, typography } from "@/shared/theme/tokens";
import { designIcons } from "./design-assets";
import { DesignIcon } from "./design-icon";
import { BottomTabBar, TabBarHostContext, type TabKey } from "./bottom-tab-bar";
import { BottomBarSurface } from "./bottom-bar-surface";
import { SnackbarHost } from "./feedback";
import { WolfiRefresh } from "./brand/wolfi-refresh";
import { setToastTop } from "./toast";
import { KeyboardScrollProvider, useKeyboardOverlap, useKeyboardScroll } from "./keyboard-scroll";
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
  scrollEnabled?: boolean;
  /** Figma D · M19/M20: larger header title and a floating action over a fade. */
  clay?: boolean;
  /** Round action above the tab bar or the bottom edge. */
  floating?: ReactNode;
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

export function Screen(props: Props) {
  return (
    <KeyboardScrollProvider>
      <ScreenInner {...props} />
    </KeyboardScrollProvider>
  );
}

function ScreenInner({
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
  scrollEnabled = true,
  clay = false,
  floating,
}: Props) {
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(56);
  const [ownTabHeight, setTabHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  // Inside the tabs layout the persistent bar belongs to the host; pages above draw their own.
  const tabHost = useContext(TabBarHostContext);
  const tabHeight = tabHost ? tabHost.height : ownTabHeight;
  const blurTarget = useRef<ViewInstance>(null);
  const keyboardScroll = useKeyboardScroll();
  const keyboardHeight = keyboardScroll?.keyboardHeight ?? 0;
  const insetFrame = useRef<ViewInstance | null>(null);
  // App-wide toasts drop in just under this screen's app bar (or the status bar when it has none).
  const toastTop = insets.top + (immersive ? 0 : headerHeight + 4) + 8;
  useFocusEffect(useCallback(() => { setToastTop(toastTop); }, [toastTop]));
  const scrollY = useSharedValue(0);
  const keyboardInset = useKeyboardOverlap(insetFrame, keyboardScroll?.keyboardTop ?? Infinity);
  const showTab = !!tab && keyboardHeight === 0;
  const tabClearance = showTab ? tabHeight || 74 + Math.max(insets.bottom, 12) : 0;
  const footerBottom = tabClearance + 8;
  // With the keyboard open the action bar joins the end of the form instead of floating
  // over it, so the fields stay visible and the button is one scroll away.
  const footerInline = !!footer && keyboardHeight > 0;
  const barClearance = footer && !footerInline
    ? footerBottom + (footerHeight || 64 + Math.max(insets.bottom, 16))
    : tabClearance;
  const setBottomInset = keyboardScroll?.setBottomInset;
  useEffect(() => { setBottomInset?.(barClearance); }, [setBottomInset, barClearance]);
  const contentBottom = Math.max(bottomPadding, barClearance ? barClearance + 16 : insets.bottom + 24) + (floating ? 76 : 0);
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
                source={designIcons.battery.line}
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
                style={[typography.headline, styles.headerTitle, clay && styles.clayTitle]}
              >
                {title}
              </Text>
              <View style={styles.headerSide}>{headerRight}</View>
            </>
          )}
        </View>}
        <View ref={insetFrame} onLayout={keyboardInset.onLayout} style={[styles.viewport, { paddingBottom: keyboardInset.overlap }]}>
        <KeyboardAvoidingView
          style={styles.viewport}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          enabled={Platform.OS === "ios"}
          keyboardVerticalOffset={insets.top + (immersive ? 0 : headerHeight)}
        >
          <View style={styles.viewport}>
            <SnackbarHost top={8}>
              <BlurTargetView
                ref={blurTarget}
                style={styles.viewport}
                onLayout={(e) => keyboardScroll?.onViewportLayout(e.nativeEvent.layout.height, insets.top + (immersive ? 0 : headerHeight))}
              >
                <WolfiRefresh enabled={scrollEnabled !== false} refreshing={refreshing} onRefresh={onRefresh} scrollY={scrollY}>
                <ScrollView
                  ref={keyboardScroll?.scrollRef}
                  onScroll={(event) => { scrollY.set(event.nativeEvent.contentOffset.y); keyboardScroll?.onScroll(event); }}
                  bounces={!onRefresh}
                  onContentSizeChange={keyboardScroll?.onContentSizeChange}
                  scrollEventThrottle={16}
                  scrollEnabled={scrollEnabled}
                  contentContainerStyle={[
                    styles.content,
                    immersive && styles.immersiveContent,
                    {
                      paddingBottom: contentBottom + (keyboardHeight > 0 ? Math.min(keyboardHeight, 220) : 0),
                    },
                    !tab && !footer && webSafeArea.content(bottomPadding),
                  ]}
                  keyboardShouldPersistTaps="handled"
                  contentInsetAdjustmentBehavior="automatic"
                  automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
                  keyboardDismissMode={
                    Platform.OS === "ios" ? "interactive" : "on-drag"
                  }
                  showsVerticalScrollIndicator={false}
                  // Web keeps the browser's own pull behaviour; native screens use WolfiRefresh.
                  refreshControl={
                    onRefresh && Platform.OS === "web" ? (
                      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />
                    ) : undefined
                  }
                >
                  {children}
                  {footerInline && <View testID="screen-action-bar" style={styles.inlineFooter}>{footer}</View>}
                </ScrollView>
                </WolfiRefresh>
              </BlurTargetView>
              {floating && keyboardHeight === 0 && <View pointerEvents="box-none" style={[styles.floating, { bottom: Math.max(barClearance, insets.bottom) + 16 }]}>{floating}</View>}
              {footer && clay && !footerInline && (
                <View testID="screen-action-bar" pointerEvents="box-none" onLayout={event => setFooterHeight(event.nativeEvent.layout.height)}
                  style={[styles.clayFooter, { paddingBottom: Math.max(insets.bottom, 24) }]}>
                  <LinearGradient pointerEvents="none" colors={["rgba(233,251,243,0)", colors.mintCanvas, colors.mintCanvas]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
                  {footer}
                </View>
              )}
              {footer && !clay && !footerInline && (
                <BottomBarSurface
                  blurTarget={blurTarget}
                  testID="screen-action-bar"
                  onLayout={event => setFooterHeight(event.nativeEvent.layout.height)}
                  style={[
                    styles.footer,
                    { bottom: footerBottom, paddingBottom: Math.max(insets.bottom, 16) },
                    webSafeArea.footer,
                  ]}
                >
                  {footer}
                </BottomBarSurface>
              )}
            </SnackbarHost>
          </View>
        </KeyboardAvoidingView>
        </View>
        {showTab && !tabHost && <BottomTabBar page activeTab={tab} onHeightChange={setTabHeight} blurTarget={blurTarget} />}
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
    position: "absolute",
    left: 16,
    right: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  floating: { position: "absolute", right: 24 },
  inlineFooter: { gap: 8, paddingTop: 4 },
  clayTitle: { fontSize: 20, lineHeight: 28 },
  clayFooter: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingTop: 48, gap: 8 },
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
