import type { PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, typography } from "@/shared/theme/tokens";
import { GlassSurface } from "./glass-surface";

type Props = PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
  dismissible?: boolean;
  allowSwipeDismissal?: boolean;
  scrollable?: boolean;
}>;

export function Sheet({
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
  const nativeSheet = Platform.OS === "ios";
  const close = () => {
    if (dismissible) onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={!nativeSheet}
      presentationStyle={nativeSheet ? "pageSheet" : "overFullScreen"}
      animationType={reduceMotion ? "none" : "slide"}
      allowSwipeDismissal={dismissible && allowSwipeDismissal}
      onRequestClose={close}
      statusBarTranslucent={!nativeSheet}
    >
      <KeyboardAvoidingView
        style={[styles.overlay, nativeSheet && styles.nativeOverlay]}
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
        <View
          accessibilityViewIsModal
          style={[styles.sheet, nativeSheet && styles.nativeSheet]}
        >
          {!nativeSheet && <View style={styles.handle} />}
          <GlassSurface variant="regular" style={styles.header}>
            <Text
              accessibilityRole="header"
              style={[typography.headline, styles.title]}
            >
              {title}
            </Text>
            <Pressable
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
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={nativeSheet ? "interactive" : "on-drag"}
              showsVerticalScrollIndicator={false}
              style={styles.scroll}
              contentContainerStyle={[
                styles.content,
                { paddingBottom: Math.max(insets.bottom, 24) },
              ]}
            >
              {children}
            </ScrollView>
          ) : (
            <View
              style={[
                styles.content,
                { flexShrink: 1, paddingBottom: Math.max(insets.bottom, 24) },
              ]}
            >
              {children}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  nativeOverlay: { backgroundColor: colors.canvas },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    width: "100%",
    maxWidth: 480,
    flexShrink: 1,
    overflow: "hidden",
  },
  nativeSheet: {
    flex: 1,
    maxHeight: "100%",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 99,
    backgroundColor: "#C7C7CC",
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
  closeText: { color: colors.teal, fontSize: 17, fontWeight: "600" },
  scroll: { flexShrink: 1 },
  content: { padding: 24, gap: 16 },
});
