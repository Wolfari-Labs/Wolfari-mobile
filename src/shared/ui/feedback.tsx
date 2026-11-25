import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, fonts, radii, shadows, typography } from "@/shared/theme/tokens";

type Tone = "success" | "error" | "warning";
type Message = { message: string; tone: Tone };
const SnackbarContext = createContext<((notice: Message) => () => void) | null>(null);
const enter = FadeIn.duration(160);

const tones = {
  success: { title: "Thành công", symbol: "✓", border: "#54A883", background: "#F1FBF5", iconBackground: colors.mint, foreground: colors.pinGreen },
  error: { title: "Có lỗi", symbol: "!", border: "#D96B60", background: "#FFF7F5", iconBackground: colors.errorSurface, foreground: colors.error },
  warning: { title: "Cảnh báo", symbol: "!", border: "#DDAA32", background: "#FFFBED", iconBackground: colors.butter, foreground: "#785514" },
} satisfies Record<Tone, { title: string; symbol: string; border: string; background: string; iconBackground: string; foreground: string }>;

/** Use inline feedback for messages that need to stay next to a form field or section. */
export function Feedback({ message, success = false, tone = success ? "success" : "error", inline = false }: {
  message: string;
  success?: boolean;
  tone?: Tone;
  inline?: boolean;
}) {
  const register = useContext(SnackbarContext);

  useEffect(() => {
    if (!inline && message) return register?.({ message, tone });
  }, [inline, message, register, tone]);

  if (!message || (register && !inline)) return null;

  const palette = tones[tone];
  return (
    <View style={[styles.container, { backgroundColor: palette.iconBackground, borderLeftColor: palette.foreground }]}>
      <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={[styles.glyph, { color: palette.foreground }]}>{palette.symbol}</Text>
      </View>
      <Text
        accessibilityRole={tone === "error" ? "alert" : undefined}
        accessibilityLiveRegion={tone === "error" ? "assertive" : "polite"}
        style={[typography.body, styles.text, { color: palette.foreground }]}
      >
        {message}
      </Text>
    </View>
  );
}

/** Messages for the screen sit at its top, under the app bar, where the keyboard never reaches. */
export function SnackbarHost({ children, top }: PropsWithChildren<{ top: number }>) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [notices, setNotices] = useState<Message[]>([]);
  const register = useCallback((notice: Message) => {
    setNotices(current => [...current, notice]);
    return () => setNotices(current => current.filter(item => item !== notice));
  }, []);
  const notice = notices.at(-1);
  const dismiss = useCallback((notice: Message) => {
    setNotices(current => current.filter(item => item.tone !== notice.tone || item.message !== notice.message));
  }, []);

  return (
    <SnackbarContext.Provider value={register}>
      {children}
      {notice && (
        <View pointerEvents="box-none" style={[styles.position, { top }]}>
          <Snackbar key={`${notice.tone}:${notice.message}`} notice={notice} reduceMotion={reduceMotion} onDismiss={dismiss} />
        </View>
      )}
    </SnackbarContext.Provider>
  );
}

function Snackbar({ notice, reduceMotion, onDismiss }: {
  notice: Message;
  reduceMotion: boolean;
  onDismiss: (notice: Message) => void;
}) {
  const { message, tone } = notice;
  const palette = tones[tone];
  const live = tone === "error" ? "assertive" : "polite";

  useEffect(() => {
    if (Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibilityWithOptions(`${palette.title}. ${message}`, { queue: true });
    }
    if (tone !== "success") return;
    const duration = Math.max(6000, message.length * 55);
    const timeout = Platform.OS === "android"
      ? AccessibilityInfo.getRecommendedTimeoutMillis(duration).catch(() => duration)
      : Promise.resolve(duration);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let mounted = true;
    void timeout.then(delay => {
      if (mounted) timer = setTimeout(() => onDismiss(notice), delay);
    });
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [message, notice, onDismiss, palette.title, tone]);

  return (
    <Animated.View testID={`snackbar-${tone}`} entering={reduceMotion ? undefined : enter}
      style={[styles.snackbar, { borderColor: palette.border, backgroundColor: palette.background }]}>
      <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={[styles.symbol, { backgroundColor: palette.iconBackground }]}>
        <Text style={[typography.headline, { color: palette.foreground }]}>{palette.symbol}</Text>
      </View>
      <View role={tone === "error" ? "alert" : "status"} aria-live={live} aria-atomic={true}
        accessibilityLiveRegion={live} style={styles.copy}>
        <Text style={[typography.headline, { color: palette.foreground }]}>{palette.title}</Text>
        <Text style={typography.body}>{message}</Text>
      </View>
      <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Đóng thông báo"
        onPress={() => onDismiss(notice)} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
        <Text style={styles.closeIcon}>×</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: radii.control, borderLeftWidth: 4, paddingVertical: 12, paddingHorizontal: 14 },
  badge: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1, backgroundColor: colors.surface },
  glyph: { fontFamily: fonts.heading, fontSize: 13, lineHeight: 16 },
  text: { flex: 1, minWidth: 0, fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 },
  position: { position: "absolute", left: 16, right: 16, zIndex: 10, alignItems: "center" },
  snackbar: {
    width: "100%",
    maxWidth: 400,
    minHeight: 64,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 20,
    borderCurve: "continuous",
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    ...shadows.dock,
  },
  symbol: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  close: { minWidth: 44, minHeight: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  pressed: { backgroundColor: "rgba(35, 62, 112, 0.08)" },
  closeIcon: { color: colors.muted, fontSize: 23, lineHeight: 28 },
});
