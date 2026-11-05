import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, shadows, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { designAssets } from "@/shared/ui/design-assets";
import { IconButton, Progress } from "@/shared/ui/journal";
import { StatGrid, StatTile } from "@/shared/ui/pastel";
import { Screen } from "@/shared/ui/screen";
import { ConfirmSheet } from "./components";
import { demoMembers, formatMoney, fundTotals } from "./model";
import { useTripDemo } from "./provider";

// Keep the amount readable in a two-column tile on a 320pt phone.
// The fund screen retains the exact, fully formatted balance.
const tileMoney = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1, style: "currency", currency: "VND" });

export default function DemoOverviewScreen() {
  const { state, send } = useTripDemo();
  const [resetting, setResetting] = useState(false);
  const { details, packing, dress } = state;
  const done = packing.filter(p => p.done).length;
  const totals = fundTotals(state.entries);
  return <Screen title={details.name} headerRight={<IconButton icon="edit" label="Chỉnh sửa chuyến đi mẫu" onPress={() => router.push("/demo-trip/details")} />}>
    <View style={styles.notice}><Text style={typography.eyebrow}>CHUYẾN ĐI MẪU</Text><Text style={typography.footnote}>Không lưu lên máy chủ</Text></View>
    <View style={styles.hero}>
      <Image source={details.coverUri ? { uri: details.coverUri } : details.cover === "tripCover" ? designAssets.pastelDestination : designAssets[details.cover]}
        style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Ảnh bìa chuyến đi mẫu" />
      <View style={styles.heroPill}><Text style={styles.destination}>{details.destination}</Text></View>
    </View>
    <View style={styles.crew}>
      <View accessible accessibilityLabel={demoMembers.map(member => member.name).join(", ")} style={styles.avatars}>
        {demoMembers.map((member, index) => <View key={member.id} style={[styles.avatar, { backgroundColor: member.color }, index > 0 && styles.overlap]}><Text style={styles.initials}>{member.initials}</Text></View>)}
      </View>
      <View style={styles.crewCopy}><Text style={typography.headline}>Nhóm bạn đồng hành</Text><Text style={typography.footnote}>4 nhân vật mẫu · Bạn là Mai</Text></View>
    </View>
    <Text style={typography.footnote}>12 — 14/11/2026 · 3 ngày, 2 đêm · Dự kiến {details.travelers} người</Text>
    <StatGrid>
      <StatTile icon="calendar" tone="blue" value="3 ngày, 2 đêm" label="Thông tin chuyến đi mẫu" onPress={() => router.push("/demo-trip/details")} />
      <StatTile icon="wallet" tone="mint" value={tileMoney.format(totals.available)} label="Quỹ khả dụng mô phỏng" accessibilityLabel="Quỹ nhóm mẫu" onPress={() => router.push("/demo-trip/fund")} />
      <StatTile icon="bag" tone="butter" value={`${done}/${packing.length} món`} label="Hành lý đã sẵn sàng" accessibilityLabel="Hành lý mẫu" onPress={() => router.push("/demo-trip/packing")} />
      <StatTile icon="shirt" tone="peach" value={`${dress.length} gợi ý`} label="Cùng chọn dress code" accessibilityLabel="Dress code mẫu" onPress={() => router.push("/demo-trip/dress-code")} />
    </StatGrid>
    <View style={styles.preparation}>
      <Text accessibilityRole="header" style={typography.section}>Sẵn sàng lên đường</Text>
      <Progress done={done} total={packing.length} />
      <Text style={typography.footnote}>{packing.length - done} vật dụng còn lại · Ngân sách dự kiến {formatMoney(details.budget)}</Text>
    </View>
    {!!details.description && <Text style={styles.description}>{details.description}</Text>}
    <Text style={typography.footnote}>Thử tự do trong phiên này, không thay đổi chuyến đi thật. Thay đổi được giữ khi chuyển màn hình trong khu vực mẫu; tải lại, đóng app hoặc thoát khu vực mẫu sẽ đặt lại. Không đồng bộ giữa thiết bị.</Text>
    <Button label="Đặt lại dữ liệu mẫu" variant="text" onPress={() => setResetting(true)} />
    <ConfirmSheet visible={resetting} title="Bắt đầu lại bản mẫu?" message="Các thay đổi thử nghiệm trong chuyến đi mẫu sẽ được thay bằng dữ liệu ban đầu. Chuyến đi thật không bị ảnh hưởng."
      label="Xác nhận đặt lại" destructive onClose={() => setResetting(false)} onConfirm={() => { send({ type: "reset" }); setResetting(false); }} />
  </Screen>;
}
const styles = StyleSheet.create({
  notice: { gap: 2 },
  hero: { height: 200, borderRadius: 32, borderWidth: 5, borderColor: colors.surface, overflow: "hidden", ...shadows.card },
  heroPill: { position: "absolute", bottom: 12, left: 12, maxWidth: "90%", backgroundColor: colors.surface, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6 },
  destination: { ...typography.footnote, color: colors.ink },
  crew: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 },
  avatars: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.surface, alignItems: "center", justifyContent: "center" },
  overlap: { marginLeft: -10 },
  initials: { ...typography.footnote, fontSize: 10, color: colors.ink },
  crewCopy: { flexGrow: 1, flexBasis: 160, gap: 2 },
  description: { ...typography.body, color: colors.muted },
  preparation: { backgroundColor: colors.surface, borderRadius: radii.card, padding: 20, gap: 12, ...shadows.glass },
});
