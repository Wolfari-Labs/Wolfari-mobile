import { DesignPopup } from "@/shared/ui/design-popup";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { errorMessage } from "@/shared/api/errors";
import { presentPrivateFile } from "@/shared/files/private-file";
import { colors, fonts, radii, shadows, typography } from "@/shared/theme/tokens";
import { Feedback } from "@/shared/ui/feedback";
import { ResourceFeedback } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { CardIcon, CardSection, ClayButton, ClayIcon, claySubtitle, SettingCard } from "@/shared/ui/setting-card";
import { Snackbar } from "@/shared/ui/toast";
import { useTrip } from "../hooks/use-trip";
import { planCalendar, planText } from "../model/share-plan";
import { tripPeriod } from "../utils";

type Task = "share" | "preview" | "pdf" | "calendar" | "copy";

export default function TripExportScreen() {
  const resource = useTrip(), { api, id, data } = resource;
  const [task, setTask] = useState<Task>(), [error, setError] = useState<string>(), [notice, setNotice] = useState<string>();
  const [popup, setPopup] = useState<"pdf" | "link">();
  const ready = !!data && !resource.loading && !resource.error;
  const locked = !ready || !!task;
  async function run(next: Task, work: () => Promise<string>) {
    if (locked) return;
    setTask(next); setError(undefined); setNotice(undefined);
    try { setNotice(await work()); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setTask(undefined); }
  }
  const pdf = (next: Task, mode: "share" | "preview") => run(next, async () => {
    const file = await api.request<Blob>(`/trips/${encodeURIComponent(id)}/plan.pdf`, { responseType: "blob" });
    if (file.type !== "application/pdf") throw Error("Máy chủ chưa trả kế hoạch PDF hợp lệ.");
    await presentPrivateFile(file, `wolfari-plan-${data!.trip.name}.pdf`, mode);
    return mode === "preview" ? "Đã mở bản xem trước." : "Đã mở tùy chọn tệp. Chọn nơi lưu hoặc ứng dụng nhận.";
  });
  const copy = () => run("copy", async () => {
    await Clipboard.setStringAsync(planText(data!.trip, data!.plan));
    return "Đã sao chép lịch trình. Dán vào tin nhắn để gửi.";
  });
  const calendar = () => run("calendar", async () => {
    const ics = planCalendar(data!.trip, data!.plan);
    if (!ics) throw Error("Chưa có hoạt động nào được xếp ngày.");
    await presentPrivateFile(new Blob([ics], { type: "text/calendar" }), `wolfari-plan-${data!.trip.name}.ics`);
    return "Đã mở tệp lịch. Chọn ứng dụng lịch để thêm.";
  });

  return <Screen clay title="Xuất & chia sẻ" onRefresh={() => { void resource.reload(); }} refreshing={resource.loading && !!data}
    footer={<ClayButton label="Chia sẻ kế hoạch" icon="arrowRight" loading={task === "share"} disabled={locked && task !== "share"} onPress={() => { void pdf("share", "share"); }} />}>
    <View style={styles.intro}>
      <Text accessibilityRole="header" style={styles.title}>Chia sẻ hành trình</Text>
      <Text style={styles.lead}>Gửi kế hoạch đẹp đến những người bạn.</Text>
    </View>
    <ResourceFeedback {...resource} hasData={!!data} onRetry={() => { void resource.reload(); }} />
    {error && <Feedback message={error} />}

    <View style={styles.card}>
      <View style={styles.row}>
        <CardIcon icon="link" tone="blue" />
        <View style={styles.copy}>
          <Text style={styles.linkTitle}>Bản chỉ xem</Text>
          <Text style={claySubtitle}>Người nhận xem lịch trình mà không cần tham gia nhóm.</Text>
        </View>
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldText} numberOfLines={1}>{data ? `${data.trip.name} · ${tripPeriod(data.trip).label}` : "Đang tải kế hoạch…"}</Text>
        <ClayButton label="Sao chép" accessibilityLabel="Sao chép lịch trình" compact icon="copy" disabled={locked} onPress={() => { void copy(); }} />
      </View>
      <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Mở bản xem trước" accessibilityState={{ disabled: locked, busy: task === "preview" }} disabled={locked}
        onPress={() => { void pdf("preview", "preview"); }} style={({ pressed }) => [styles.preview, (pressed || locked) && { opacity: 0.6 }]}>
        <ClayIcon name="eye" size={16} />
        <Text style={styles.previewText}>{task === "preview" ? "Đang mở…" : "Mở bản xem trước"}</Text>
      </Pressable>
    </View>

    <View style={styles.included}>
      <Text accessibilityRole="header" style={styles.cardTitle}>Nội dung được chia sẻ</Text>
      <Included text="Lịch trình và địa điểm" />
      <Included text="Dress code và danh sách chuẩn bị chung" />
      <Included hidden text="Quỹ nhóm và thông tin riêng của thành viên — ẩn" />
    </View>

    <CardSection title="Mang kế hoạch theo bạn">
      <SettingCard icon="file" tone="peach" title="Xuất bản PDF" subtitle="Lịch trình và địa điểm của chuyến đi" busy={task === "pdf"} disabled={locked} onPress={() => setPopup("pdf")} />
      <SettingCard icon="calendar" tone="mint" title="Thêm vào lịch" subtitle="Đồng bộ các hoạt động vào Lịch" busy={task === "calendar"} disabled={locked} onPress={() => { void calendar(); }} />
    </CardSection>
    <SettingCard icon="link" tone="blue" title="Liên kết chia sẻ" subtitle="Xem các cách gửi bản chỉ xem" disabled={locked} onPress={() => setPopup("link")} />
    {popup && <DesignPopup kind={popup} message={popup === "pdf" ? "Bản xuất gồm lịch trình, địa điểm và thông tin chuyến đi. Xem bố cục trước khi chia sẻ." : "Chuyến đi chưa có liên kết công khai. Bạn có thể xem trước nội dung và gửi bản PDF cho người nhận."}
      onPrimary={() => { setPopup(undefined); void pdf("preview", "preview"); }} onClose={() => setPopup(undefined)} />}
    <Snackbar message={notice} />
  </Screen>;
}

function Included({ text, hidden = false }: { text: string; hidden?: boolean }) {
  return <View style={styles.includedRow}>
    <View style={[styles.mark, { backgroundColor: hidden ? colors.peach : colors.mint }]}>
      <ClayIcon name={hidden ? "x" : "check"} size={12} />
    </View>
    <Text style={[styles.includedText, hidden && { color: claySubtitle.color }]}>{text}</Text>
  </View>;
}

const styles = StyleSheet.create({
  intro: { gap: 4, marginTop: -10 },
  title: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 32, color: colors.ink },
  lead: { ...typography.body, color: claySubtitle.color },
  card: { gap: 12, padding: 16, borderRadius: 30, backgroundColor: colors.surface, ...shadows.card },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  linkTitle: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 22, color: colors.ink },
  cardTitle: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 22, color: colors.ink },
  field: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingLeft: 14, paddingRight: 6, borderRadius: radii.pill, backgroundColor: "#F4F6FD" },
  fieldText: { ...typography.body, flex: 1, minWidth: 0, fontSize: 14 },
  // 44pt touch target around an 18pt line; negative margins keep the Figma rhythm.
  preview: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, minHeight: 44, marginVertical: -13 },
  previewText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18, color: colors.blue },
  included: { gap: 10, padding: 16, borderRadius: 28, backgroundColor: colors.surface, ...shadows.glass },
  includedRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  includedText: { flex: 1, fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: colors.ink },
});
