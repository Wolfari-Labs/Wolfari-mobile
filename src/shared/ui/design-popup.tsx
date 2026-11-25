import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, fonts, pastelTones, shadows, typography } from "@/shared/theme/tokens";
import { designAssets, type ClayIconName } from "./design-assets";
import { ClayButton, ClayIcon } from "./setting-card";

type Spec = { title: string; primary: string; secondary?: string; icon: ClayIconName; tone: keyof typeof pastelTones };
const saved = { icon: "checkWhite", tone: "mint", secondary: "Tiếp tục chỉnh sửa" } as const;
const popups = {
  tripCreated: { title: "Chuyến đi đã sẵn sàng!", primary: "Mở chuyến đi", secondary: "Tiếp tục chỉnh sửa", icon: "sparkle", tone: "lilac" },
  activity: { ...saved, title: "Đã lưu hoạt động", primary: "Về lịch trình" },
  packing: { ...saved, title: "Đã lưu vật dụng", primary: "Về hành lý" },
  expense: { ...saved, title: "Đã lưu khoản chi", primary: "Về quỹ nhóm" },
  invitation: { ...saved, title: "Lời mời đã sẵn sàng", primary: "Xem thành viên", icon: "inviteReady", tone: "blue" },
  profile: { ...saved, title: "Đã lưu hồ sơ", primary: "Về tài khoản" },
  settings: { ...saved, title: "Đã lưu cài đặt", primary: "Về chuyến đi" },
  tripEdited: { ...saved, title: "Đã lưu chuyến đi", primary: "Về cài đặt" },
  threshold: { title: "Đã lưu ngưỡng giá", primary: "Hoàn tất", icon: "priceAlert", tone: "mint" },
  pdf: { title: "Xuất lịch trình PDF", primary: "Xem bản xuất", secondary: "Để sau", icon: "pdfReady", tone: "blue" },
  link: { title: "Liên kết chia sẻ", primary: "Mở bản xem trước", secondary: "Đóng", icon: "publicLink", tone: "blue" },
  logout: { title: "Đăng xuất khỏi Wolfari?", primary: "Đăng xuất", secondary: "Ở lại", icon: "signOut", tone: "peach" },
  archive: { title: "Lưu trữ chuyến đi?", primary: "Lưu trữ", secondary: "Hủy", icon: "archiveTrip", tone: "butter" },
  device: { title: "Thiết bị đang đăng nhập", primary: "Đã hiểu", icon: "device", tone: "blue" },
  ready: { title: "Sẵn sàng lên đường!", primary: "Tuyệt, đi thôi!", icon: "sparkle", tone: "lilac" },
} as const satisfies Record<string, Spec>;

export function DesignPopup({ kind, message, onPrimary, onClose, secondaryLabel, primaryLabel, busy, disabled, error }: {
  kind: keyof typeof popups; message: string; onPrimary: () => void; onClose: () => void; secondaryLabel?: string; primaryLabel?: string;
  busy?: boolean; disabled?: boolean; error?: string;
}) {
  const spec: Spec = popups[kind];
  const { reduceMotion } = useAccessibilityPreferences();
  const celebration = kind === "ready" || kind === "tripCreated";
  const secondary = secondaryLabel ?? spec.secondary;
  return <Modal visible transparent statusBarTranslucent animationType={reduceMotion ? "none" : "fade"} onRequestClose={() => { if (!busy) onClose(); }}>
    <SafeAreaView style={styles.overlay}>
      <ScrollView keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={[styles.center, celebration && styles.celebrationCenter]}>
        <View accessibilityViewIsModal style={styles.card}>
          {celebration && <View pointerEvents="none" style={styles.art} accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden>
            <Image source={designAssets.tripWave} style={styles.mascot} contentFit="contain" accessible={false} />
            <Image source={designAssets.popupConfetti} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
          </View>}
          <LinearGradient colors={pastelTones[spec.tone].gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
            <ClayIcon name={spec.icon} size={32} />
          </LinearGradient>
          <Text accessibilityRole="header" style={styles.title}>{spec.title}</Text>
          <Text style={styles.copy}>{message}</Text>
          {!!error && <Text accessibilityRole="alert" style={[styles.copy, { color: colors.error }]}>{error}</Text>}
          <View style={styles.actions}><ClayButton label={primaryLabel ?? spec.primary} loading={busy} disabled={disabled} onPress={onPrimary} />
          {secondary && <Pressable accessibilityRole="button" accessibilityLabel={secondary} disabled={busy} onPress={onClose} style={styles.secondary}><Text style={styles.secondaryText}>{secondary}</Text></Pressable>}</View>
        </View>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(31,42,68,0.45)" },
  center: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24, paddingVertical: 72 },
  celebrationCenter: { paddingTop: 130, paddingBottom: 72 },
  card: { width: "100%", maxWidth: 334, alignItems: "center", backgroundColor: colors.surface, borderRadius: 34, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 22, gap: 14, ...shadows.card },
  art: { position: "absolute", alignSelf: "center", alignItems: "center", justifyContent: "flex-end", top: -110, width: "100%", maxWidth: 300, height: 120 },
  mascot: { width: 120, height: 100 },
  ring: { width: 76, height: 76, borderRadius: 38, borderWidth: 5, borderColor: colors.surface, justifyContent: "center", alignItems: "center", ...shadows.glass },
  title: { ...typography.section, fontSize: 22, lineHeight: 28, textAlign: "center" },
  copy: { ...typography.body, color: colors.muted, textAlign: "center" },
  actions: { marginTop: 16, alignSelf: "stretch" },
  secondary: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontFamily: fonts.heading, fontSize: 15, color: colors.teal },
});
