import { Modal, StyleSheet, Text, View } from "react-native";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, fonts, shadows, typography } from "@/shared/theme/tokens";
import { WolfiScene, type WolfiSceneName } from "./brand/wolfi-scene";

/**
 * Blocks the screen while one write is in flight, without leaving it: the form stays
 * underneath and the result (a popup or an error) appears in place when the work ends.
 */
export function LoadingOverlay({ visible, title, message, scene = "sync" }: {
  visible: boolean; title: string; message?: string; scene?: WolfiSceneName;
}) {
  const { reduceMotion } = useAccessibilityPreferences();
  return <Modal visible={visible} transparent statusBarTranslucent animationType={reduceMotion ? "none" : "fade"} onRequestClose={() => { /* Not cancellable mid-write. */ }}>
    <View style={styles.overlay}>
      <View accessibilityViewIsModal accessibilityRole="progressbar" accessibilityLabel={message ? `${title}. ${message}` : title}
        accessibilityLiveRegion="polite" style={styles.card}>
        <WolfiScene name={scene} style={styles.scene} />
        <Text style={styles.title}>{title}</Text>
        {!!message && <Text style={styles.message}>{message}</Text>}
        <View style={styles.dots} importantForAccessibility="no-hide-descendants">
          {[0, 1, 2].map(index => <View key={index} style={[styles.dot, { opacity: 0.35 + index * 0.25 }]} />)}
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(31,42,68,0.45)", alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  card: { width: "100%", maxWidth: 334, alignItems: "center", backgroundColor: colors.surface, borderRadius: 34, padding: 18, paddingBottom: 24, gap: 10, ...shadows.card },
  scene: { borderRadius: 24 },
  title: { ...typography.section, fontSize: 20, lineHeight: 26, textAlign: "center", marginTop: 6 },
  message: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: "center" },
  dots: { flexDirection: "row", gap: 6, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue },
});
