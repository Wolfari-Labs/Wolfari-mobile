import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSession } from "@/features/auth/session/session-provider";
import { colors, radii, shadows, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { designAssets, type DesignIconName } from "@/shared/ui/design-assets";
import { DesignIcon } from "@/shared/ui/design-icon";
import { Feedback } from "@/shared/ui/feedback";
import { Screen } from "@/shared/ui/screen";

const features: { icon: DesignIconName; title: string; description: string }[] = [
  { icon: "map", title: "Lịch trình & bản đồ", description: "Điểm đến và kế hoạch từng ngày" },
  { icon: "bag", title: "Cùng nhau chuẩn bị", description: "Dress code, hành lý và nhắc việc" },
  { icon: "wallet", title: "Quỹ nhóm minh bạch", description: "Theo dõi đóng góp và chi tiêu" },
];

export default function GuestScreen() {
  const { status, profile, restore } = useSession();
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const authenticated = status === "authenticated";
  const start = () => router.push(authenticated ? "/(tabs)" : "/sign-up");

  return (
    <Screen bottomPadding={126} header={
      <>
        <Image source={designAssets.logo} style={styles.logo} contentFit="contain" accessibilityLabel="Wolfari" />
        <View style={styles.headerSpace} />
        <Button label={authenticated ? "Tài khoản" : "Đăng nhập"} variant="soft" compact onPress={() => router.push(authenticated ? "/(tabs)/profile" : "/sign-in")} style={styles.headerButton} />
      </>
    }>
      {notice === "signed-in" && profile && <Feedback success message={`Đăng nhập thành công. Xin chào, ${profile.full_name}!`} />}
      {status === "unavailable" && (
        <View style={styles.recovery}>
          <Feedback message="Chưa thể khôi phục phiên của bạn. Vui lòng kiểm tra kết nối mạng." />
          <Button label="Thử lại" variant="soft" compact onPress={() => { void restore(); }} />
        </View>
      )}
      <View style={styles.heading}>
        <Text style={[typography.footnote, styles.eyebrow]}>CÙNG NHAU LÊN ĐƯỜNG</Text>
        <Text accessibilityRole="header" style={typography.largeTitle}>{"Cho những\nchuyến đi thật đẹp"}</Text>
      </View>
      <View style={styles.cover}>
        <Image source={designAssets.danang} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Minh họa Đà Nẵng và cầu Rồng" />
        <LinearGradient colors={["rgba(9,33,41,0)", "rgba(9,33,41,0.08)", "rgba(9,33,41,0.85)"]} locations={[0, 0.34, 1]} style={StyleSheet.absoluteFill} />
        <Image source={designAssets.mascot} style={styles.coverMascot} contentFit="contain" accessible={false} />
        <View style={styles.coverCaption}>
          <Text style={[typography.title, styles.coverTitle]}>Xin chào, Đà Nẵng</Text>
          <Text style={[typography.footnote, styles.coverSubtitle]}>Một điểm đến, thật nhiều kỷ niệm.</Text>
        </View>
      </View>
      <Text style={[typography.body, styles.description]}>Lên lịch, chuẩn bị hành lý và quản lý quỹ — cả nhóm cùng nhau, trong một nơi.</Text>
      <Button label={authenticated ? "Tiếp tục hành trình" : "Bắt đầu hành trình"} onPress={start} />
      {!authenticated && (
        <View style={styles.memberPrompt}>
          <Text style={[typography.body, styles.muted, styles.promptCopy]}>Đã có tài khoản?</Text>
          <Pressable accessibilityRole="link" onPress={() => router.push("/sign-in")} style={styles.promptAction}>
            <Text style={[typography.body, styles.link]}>Đăng nhập →</Text>
          </Pressable>
        </View>
      )}
      <Text accessibilityRole="header" style={typography.section}>Mọi thứ trong một nơi</Text>
      {features.map((feature) => (
        <Pressable key={feature.icon} onPress={start} accessibilityRole="button" accessibilityLabel={`${feature.title}. ${feature.description}`} style={({ pressed }) => [styles.featureRow, pressed && styles.featurePressed]}>
          <View style={styles.featureIcon}><DesignIcon name={feature.icon} /></View>
          <View style={styles.featureCopy}>
            <Text style={[typography.body, styles.featureTitle]}>{feature.title}</Text>
            <Text style={typography.footnote}>{feature.description}</Text>
          </View>
          <View style={styles.chevron}><DesignIcon name="chevron" /></View>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { width: 112, height: 38 },
  headerSpace: { flex: 1 },
  headerButton: { minWidth: 124 },
  heading: { gap: 6 },
  eyebrow: { color: colors.teal },
  cover: { width: "100%", aspectRatio: 354 / 234, borderRadius: radii.card, overflow: "hidden", ...shadows.card },
  coverMascot: { position: "absolute", top: 12, right: 12, width: 78, height: 78 },
  coverCaption: { position: "absolute", bottom: 26, left: 20, right: 20, gap: 4 },
  coverTitle: { color: colors.surface },
  coverSubtitle: { color: colors.surface },
  description: { color: colors.muted, lineHeight: 23, minHeight: 46 },
  memberPrompt: { flexDirection: "row", alignItems: "center", gap: 8 },
  promptCopy: { flex: 1 },
  promptAction: { flex: 1 },
  muted: { color: colors.muted },
  link: { color: colors.teal, fontWeight: "600" },
  featureRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radii.control, backgroundColor: colors.surface, ...shadows.card },
  featurePressed: { backgroundColor: colors.tealSoft, transform: [{ scale: 0.985 }] },
  featureIcon: { width: 24, height: 24, justifyContent: "center" },
  featureCopy: { flex: 1, gap: 4 },
  featureTitle: { lineHeight: 20 },
  chevron: { width: 18 },
  recovery: { gap: 8 },
});
