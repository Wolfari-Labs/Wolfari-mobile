import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "@/features/auth/session/session-provider";
import { colors, radii, shadows, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { designAssets, type DesignIconName } from "@/shared/ui/design-assets";
import { DesignIcon } from "@/shared/ui/design-icon";
import { Feedback } from "@/shared/ui/feedback";
import { PastelIcon, type PastelTone } from "@/shared/ui/pastel";
import { Screen } from "@/shared/ui/screen";

const features: { icon: DesignIconName; title: string; tone: PastelTone; color: string }[] = [
  { icon: "calendar", title: "Lịch trình", tone: "blue", color: colors.tealSoft },
  { icon: "map", title: "Bản đồ", tone: "lilac", color: colors.lilac },
  { icon: "bag", title: "Hành lý", tone: "butter", color: colors.butter },
  { icon: "wallet", title: "Quỹ nhóm", tone: "mint", color: colors.mint },
];
export default function GuestScreen() {
  const { status, profile, restore } = useSession();
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const authenticated = status === "authenticated";
  const start = () => router.push(authenticated ? "/(tabs)" : "/sign-up");
  return <Screen header={<>
    <Image source={designAssets.logo} style={styles.logo} contentFit="contain" accessibilityLabel="Wolfari" />
    <View style={styles.flex} />
    <Button label={authenticated ? "Tài khoản" : "Đăng nhập"} variant="glass" compact onPress={() => router.push(authenticated ? "/(tabs)/profile" : "/sign-in")} />
  </>}>
    {notice === "signed-in" && profile && <Feedback success message={`Đăng nhập thành công. Xin chào, ${profile.full_name}!`} />}
    {status === "unavailable" && <View style={styles.stack}>
      <Feedback message="Chưa thể khôi phục phiên của bạn. Vui lòng kiểm tra kết nối mạng." />
      <Button label="Thử lại" variant="soft" compact onPress={() => { void restore(); }} />
    </View>}
    <View style={styles.heroWrap}>
      <View style={styles.hero}>
        <Image source={designAssets.pastelDestination} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Minh họa hành trình biển Đà Nẵng" />
        <View style={styles.badge}><DesignIcon name="pin" size={14} tintColor={colors.teal} /><Text style={styles.badgeText}>Khám phá vẻ đẹp Việt Nam</Text></View>
      </View>
      <Image source={designAssets.pastelMascot} style={styles.mascot} contentFit="contain" accessible={false} />
    </View>
    <View style={styles.stack}>
      <Text accessibilityRole="header" style={styles.title}>Cho những chuyến đi{"\n"}<Text style={styles.accent}>thật đẹp</Text>, cùng nhau</Text>
      <Text style={[typography.body, styles.muted]}>Lên lịch, chuẩn bị hành lý và chia quỹ nhóm — tất cả trong một ứng dụng.</Text>
    </View>
    <View style={styles.features}>
      {features.map(feature => <Pressable cssInterop={false} key={feature.icon} accessibilityRole="button" accessibilityLabel={feature.title} onPress={start}
        style={({ pressed }) => [styles.feature, { backgroundColor: feature.color }, pressed && styles.pressed]}>
        <PastelIcon small icon={feature.icon} tone={feature.tone} />
        <Text style={styles.featureLabel}>{feature.title}</Text>
      </Pressable>)}
    </View>
    <Button label={authenticated ? "Tiếp tục hành trình" : "Bắt đầu hành trình"} icon="plane" onPress={start} />
    {!authenticated && <View style={styles.prompt}>
      <Text style={typography.footnote}>Đã có tài khoản?</Text>
      <Pressable accessibilityRole="link" onPress={() => router.push("/sign-in")} style={styles.link}><Text style={styles.linkText}>Đăng nhập</Text></Pressable>
    </View>}
    <Button label="Khám phá chuyến đi mẫu" variant="soft" onPress={() => router.push("/demo-trip")} />
    <Text style={[typography.footnote, styles.center]}>Tự do khám phá, không cần đăng nhập.</Text>
  </Screen>;
}
const styles = StyleSheet.create({
  logo: { width: 140, height: 44 },
  flex: { flex: 1 },
  stack: { gap: 8 },
  heroWrap: { marginTop: 4 },
  hero: { height: 280, borderRadius: radii.cardLarge, borderWidth: 6, borderColor: colors.surface, overflow: "hidden", ...shadows.card },
  mascot: { width: 100, height: 84, position: "absolute", right: -8, top: -32 },
  badge: { position: "absolute", bottom: 14, left: 12, maxWidth: "92%", borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 6 },
  badgeText: { ...typography.footnote, fontSize: 12, color: colors.ink, flexShrink: 1 },
  title: { ...typography.largeTitle, fontSize: 30, lineHeight: 38, letterSpacing: -0.5 },
  accent: { color: colors.teal },
  muted: { color: colors.muted },
  features: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  feature: { flexGrow: 1, flexBasis: 60, minHeight: 96, borderRadius: 24, paddingVertical: 14, alignItems: "center", justifyContent: "center", gap: 8, ...shadows.glass },
  featureLabel: { ...typography.footnote, fontSize: 12, color: colors.ink, textAlign: "center" },
  prompt: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 6 },
  link: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  linkText: { ...typography.headline, color: colors.teal, fontSize: 14 },
  center: { textAlign: "center" },
  pressed: { opacity: 0.7 },
});
