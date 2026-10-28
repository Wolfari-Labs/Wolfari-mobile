import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { designAssets } from "@/shared/ui/design-assets";
import { Progress, SectionLink, ui } from "@/shared/ui/journal";
import {
  ConfirmSheet,
  DemoScreen,
  MemberBadge,
  Stat,
  demoStyles as s,
} from "./components";
import { demoMembers, formatMoney, fundTotals } from "./model";
import { useTripDemo } from "./provider";

export default function DemoOverviewScreen() {
  const { state, send } = useTripDemo();
  const [resetting, setResetting] = useState(false);
  const { details, packing, dress } = state;
  const done = packing.filter((p) => p.done).length;
  const totals = fundTotals(state.entries);
  return (
    <DemoScreen title="Một chuyến đi cùng nhau" home>
      <View style={styles.cover}>
        <Image
          source={
            details.coverUri
              ? { uri: details.coverUri }
              : designAssets[details.cover]
          }
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityLabel="Ảnh bìa chuyến đi mẫu"
        />
        <LinearGradient
          colors={["transparent", "rgba(12,32,41,0.9)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.caption}>
          <Text style={styles.kicker}>12 — 14 THÁNG 11, 2026</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {details.name}
          </Text>
          <Text style={styles.destination}>{details.destination}</Text>
        </View>
      </View>
      <View style={s.split}>
        <Stat
          label="Ngân sách dự kiến"
          value={formatMoney(details.budget)}
          accent
        />
        <Stat
          label="Bạn đồng hành"
          value={`${details.travelers} người dự kiến`}
        />
      </View>
      <Text style={s.subtle}>{details.description}</Text>
      <Button
        label="Chỉnh sửa chuyến đi mẫu"
        icon="edit"
        variant="soft"
        onPress={() => router.push("/demo-trip/details")}
      />
      <View style={ui.card}>
        <Text style={s.eyebrow}>NHÓM MẪU CỦA BẠN</Text>
        <View style={s.row}>
          {demoMembers.map((m) => (
            <MemberBadge key={m.id} id={m.id} />
          ))}
        </View>
        <Text style={typography.footnote}>
          Bốn nhân vật minh họa, không phải thành viên thật. Bạn đang thử giao
          diện với vai trò Mai.
        </Text>
      </View>
      <Text accessibilityRole="header" style={typography.section}>
        Chuẩn bị cho những ngày vui
      </Text>
      <View style={[ui.card, { backgroundColor: colors.mint }]}>
        <Text style={typography.headline}>
          Hành lý đã sẵn sàng {done}/{packing.length}
        </Text>
        <Progress done={done} total={packing.length} />
        <Text style={typography.footnote}>
          {packing.length - done} vật dụng còn lại · {dress.length} dress code
          đã lên ý tưởng
        </Text>
      </View>
      <View style={ui.group}>
        <SectionLink
          grouped
          title="Hành lý mẫu"
          subtitle="Checklist, phân công và đánh dấu đã chuẩn bị"
          icon="bag"
          onPress={() => router.push("/demo-trip/packing")}
        />
        <SectionLink
          grouped
          last
          title="Dress code mẫu"
          subtitle="Bảng màu, trang phục theo ngày và hoạt động"
          icon="shirt"
          onPress={() => router.push("/demo-trip/dress-code")}
        />
      </View>
      <SectionLink
        title="Quỹ nhóm mẫu"
        subtitle={`Khả dụng mô phỏng: ${formatMoney(totals.available)}`}
        icon="wallet"
        onPress={() => router.push("/demo-trip/fund")}
      />
      <Text style={typography.footnote}>
        Thay đổi được giữ khi chuyển màn hình trong khu vực mẫu. Tải lại trang,
        đóng app hoặc thoát khu vực mẫu sẽ đặt lại. Không đồng bộ giữa thiết bị.
      </Text>
      <Button
        label="Đặt lại dữ liệu mẫu"
        variant="soft"
        onPress={() => setResetting(true)}
      />
      <ConfirmSheet
        visible={resetting}
        title="Bắt đầu lại bản mẫu?"
        message="Các thay đổi thử nghiệm trong chuyến đi mẫu sẽ được thay bằng dữ liệu ban đầu. Chuyến đi thật không bị ảnh hưởng."
        label="Xác nhận đặt lại"
        destructive
        onClose={() => setResetting(false)}
        onConfirm={() => {
          send({ type: "reset" });
          setResetting(false);
        }}
      />
    </DemoScreen>
  );
}
const styles = StyleSheet.create({
  cover: {
    minHeight: 270,
    borderRadius: 26,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  caption: { padding: 22, paddingTop: 100, gap: 10 },
  kicker: {
    ...typography.footnote,
    color: "#E3EEF2",
    letterSpacing: 2,
    fontWeight: "700",
  },
  title: {
    ...typography.largeTitle,
    fontSize: 32,
    lineHeight: 38,
    color: colors.surface,
  },
  destination: { ...typography.body, color: colors.surface },
});
