import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { colors, gradients, shadows, typography } from "@/shared/theme/tokens";
import { designAssets } from "./design-assets";

export function AuthIntro({ registration = false }: { registration?: boolean }) {
  return (
    <View style={styles.intro}>
      <LinearGradient colors={gradients.mascot} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.blob, registration && styles.smallBlob]}>
        <Image source={designAssets.pastelMascot} style={styles.mascot} contentFit="contain" accessible={false} />
      </LinearGradient>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={[typography.title, styles.center]}>{registration ? "Cùng Wolfari lên đường" : "Chào mừng trở lại!"}</Text>
        <Text style={[typography.body, styles.muted]}>{registration ? "Tạo tài khoản, bắt đầu những hành trình đẹp." : "Tiếp tục lên kế hoạch cùng nhóm bạn"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: "center", gap: 20 },
  blob: { width: 150, height: 150, borderRadius: 75, alignItems: "center", justifyContent: "center", ...shadows.card },
  smallBlob: { width: 104, height: 104, borderRadius: 52 },
  mascot: { width: "80%", height: "75%" },
  copy: { gap: 6, alignSelf: "stretch" },
  center: { textAlign: "center" },
  muted: { color: colors.muted, textAlign: "center" },
});
