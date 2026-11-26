import { useRef, type PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewInstance,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, typography } from "@/shared/theme/tokens";
import { SnackbarHost } from "./feedback";
import { GlassSurface } from "./glass-surface";
import { KeyboardScrollProvider, useKeyboardOverlap, useKeyboardScroll } from "./keyboard-scroll";
import { webSafeArea } from "./web-safe-area";

type Props = PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
  dismissible?: boolean;
  allowSwipeDismissal?: boolean;
  scrollable?: boolean;
}>;

export function Sheet(props: Props) {
  return (
    <KeyboardScrollProvider>
      <SheetInner {...props} />
    </KeyboardScrollProvider>
  );
}

function SheetInner({
  visible,
  title,
  onClose,
  dismissible = true,
  allowSwipeDismissal = dismissible,
  scrollable = true,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useAccessibilityPreferences();
  const keyboardScroll = useKeyboardScroll();
  const keyboardHeight = keyboardScroll?.keyboardHeight ?? 0;
  const insetFrame = useRef<ViewInstance | null>(null);
  const keyboardInset = useKeyboardOverlap(insetFrame, keyboardScroll?.keyboardTop ?? Infinity);
  const nativeSheet = Platform.OS === "ios";
  // Float above short dialogs and keep the actions at the bottom of tall sheets clear.
  const close = () => {
    if (dismissible) onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={!nativeSheet}
      presentationStyle={nativeSheet ? "pageSheet" : "overFullScreen"}
      animationType={reduceMotion ? "none" : "fade"}
      allowSwipeDismissal={dismissible && allowSwipeDismissal}
      onRequestClose={close}
      statusBarTranslucent={!nativeSheet}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View ref={insetFrame} onLayout={keyboardInset.onLayout} style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={[
            styles.overlay,
            nativeSheet && styles.nativeOverlay,
            !nativeSheet && keyboardHeight > 0 && { paddingBottom: Platform.OS === "android" ? keyboardInset.overlap : keyboardHeight },
          ]}
          behavior={nativeSheet ? "padding" : undefined}
        >
          {!nativeSheet && (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={close}
              disabled={!dismissible}
              accessibilityLabel="Đóng hộp thoại"
              accessibilityRole="button"
            />
          )}
          <View accessibilityViewIsModal pointerEvents="box-none" style={styles.sheetViewport}>
            <SnackbarHost top={nativeSheet ? 12 : insets.top + 12}>
              <View style={[styles.sheet, nativeSheet && styles.nativeSheet]} onLayout={event => {
                const { height } = event.nativeEvent.layout;
                keyboardScroll?.onViewportLayout(height);
              }}>
                {!nativeSheet && <View style={styles.handle} />}
                <GlassSurface variant="regular" style={styles.header}>
                  <Text
                    accessibilityRole="header"
                    style={[typography.headline, styles.title]}
                  >
                    {title}
                  </Text>
                  <Pressable
                    cssInterop={false}
                    onPress={close}
                    disabled={!dismissible}
                    accessibilityRole="button"
                    accessibilityLabel="Đóng"
                    accessibilityState={{ disabled: !dismissible }}
                    style={({ pressed }) => [
                      styles.close,
                      (pressed || !dismissible) && { opacity: 0.4 },
                    ]}
                  >
                    <Text style={styles.closeText}>Đóng</Text>
                  </Pressable>
                </GlassSurface>
                {scrollable ? (
                  <ScrollView
                    ref={keyboardScroll?.scrollRef}
                    onScroll={keyboardScroll?.onScroll}
                    scrollEventThrottle={16}
                    keyboardShouldPersistTaps="handled"
                    automaticallyAdjustKeyboardInsets={nativeSheet}
                    keyboardDismissMode={nativeSheet ? "interactive" : "on-drag"}
                    showsVerticalScrollIndicator={false}
                    style={styles.scroll}
                    contentContainerStyle={[
                      styles.content,
                      {
                        paddingBottom:
                          Math.max(insets.bottom, 24) +
                          (keyboardHeight > 0 ? Math.min(keyboardHeight * 0.5, 180) : 0),
                      },
                      webSafeArea.sheetContent,
                    ]}
                  >
                    {children}
                  </ScrollView>
                ) : (
                  <View
                    style={[
                      styles.content,
                      { flexShrink: 1, paddingBottom: Math.max(insets.bottom, 24) },
                      webSafeArea.sheetContent,
                    ]}
                  >
                    {children}
                  </View>
                )}
              </View>
            </SnackbarHost>
          </View>
        </KeyboardAvoidingView>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(31, 49, 84, 0.26)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  nativeOverlay: { backgroundColor: colors.canvas },
  sheetViewport: { flex: 1, alignSelf: "stretch", justifyContent: "flex-end", alignItems: "center" },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    width: "100%",
    maxWidth: 480,
    flexShrink: 1,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: colors.line,
  },
  nativeSheet: {
    flex: 1,
    maxHeight: "100%",
    borderWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 99,
    backgroundColor: "rgba(23, 63, 99, 0.3)",
    alignSelf: "center",
    marginTop: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingLeft: 24,
    paddingRight: 12,
    margin: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  title: { flex: 1, paddingVertical: 16 },
  close: {
    minWidth: 56,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: colors.ink, fontSize: 16, fontWeight: "800", textDecorationLine: "underline" },
  scroll: { flexShrink: 1 },
  content: { padding: 24, gap: 16 },
});
