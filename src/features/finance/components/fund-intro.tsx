import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts, pastelTones, shadows } from "@/shared/theme/tokens";
import { WolfiScene } from "@/shared/ui/brand/wolfi-scene";
import { CardIcon, ClayButton, claySubtitle } from "@/shared/ui/setting-card";
import { money } from "../model";

const steps = [
  { icon: "wallet", tone: "blue", title: "Mở quỹ", text: "Chọn người giữ quỹ và tài khoản nhận tiền." },
  { icon: "users", tone: "lilac", title: "Gọi góp", text: "Gửi yêu cầu góp cho từng người, app tự nhắc." },
  { icon: "checkMint", tone: "mint", title: "Ghi chi và chốt", text: "Ghi từng khoản chi, cuối chuyến chốt sổ cho cả nhóm." },
] as const;

/** Fund tab before a fund exists: what the fund does, the trip's budget, and who can open it. */
export function FundIntro({ budget, members, canOpen, disabled, onOpen, feedback }: {
  budget?: string | null; members?: number; canOpen: boolean; disabled: boolean; onOpen: () => void; feedback?: ReactNode;
}) {
  const share = budget && members && members > 1 ? String(BigInt(budget) / BigInt(members)) : undefined;
  return <View style={styles.card}>
    <WolfiScene name="groupReady" />
    <View style={styles.copy}>
      <Text accessibilityRole="header" style={styles.title}>Quỹ chung cho cả nhóm</Text>
      <Text style={styles.body}>Góp tiền về một chỗ, ghi lại từng khoản chi và chốt sổ rõ ràng khi chuyến đi kết thúc.</Text>
    </View>
    {!!budget && <View style={styles.tiles}>
      <View style={[styles.tile, { backgroundColor: pastelTones.blue.surface }]}>
        <Text style={claySubtitle}>Ngân sách dự kiến</Text>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{money(budget)}</Text>
      </View>
      {share && <View style={[styles.tile, { backgroundColor: pastelTones.mint.surface }]}>
        <Text style={claySubtitle}>Mỗi người ({members})</Text>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>~{money(share)}</Text>
      </View>}
    </View>}
    <View style={styles.steps}>
      {steps.map((step, index) => <View key={step.title} style={styles.step}>
        <CardIcon icon={step.icon} tone={step.tone} size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.stepTitle}>{index + 1}. {step.title}</Text>
          <Text style={claySubtitle}>{step.text}</Text>
        </View>
      </View>)}
    </View>
    {feedback}
    {canOpen
      ? <ClayButton label="Mở quỹ nhóm" icon="arrowRight" disabled={disabled} onPress={onOpen} />
      : <Text style={styles.note}>Trưởng nhóm sẽ mở quỹ khi cả nhóm sẵn sàng. Bạn sẽ nhận thông báo khi có yêu cầu góp.</Text>}
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: 18, padding: 16, paddingBottom: 20, borderRadius: 32, borderCurve: "continuous", backgroundColor: colors.surface, ...shadows.card },
  copy: { gap: 6, paddingHorizontal: 4 },
  title: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.muted },
  tiles: { flexDirection: "row", gap: 10 },
  tile: { flex: 1, gap: 4, padding: 14, borderRadius: 20, borderCurve: "continuous" },
  value: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 24, color: colors.ink },
  steps: { gap: 12, paddingHorizontal: 4 },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepTitle: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 20, color: colors.ink },
  note: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: "center", paddingHorizontal: 8 },
});
